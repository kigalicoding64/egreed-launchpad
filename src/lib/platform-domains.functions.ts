import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) throw error;
  if (!data?.length) throw new Error("Only admins can manage platform domains");
}

function cleanDomain(raw: unknown) {
  const d = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\*\./, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) {
    throw new Error("Enter a valid domain, e.g. example.com");
  }
  return d;
}

/** Look the domain up in the Cloudflare account; returns zone id + nameservers. */
async function lookupZone(domain: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_API_Token;
  if (!token) return { zoneId: null, status: "pending", nameservers: [] as string[], error: "Cloudflare token is not configured." };
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    result?: { id: string; status: string; name_servers?: string[] }[];
    errors?: { message?: string }[];
  };
  const zone = body.result?.[0];
  if (!zone) {
    return {
      zoneId: null,
      status: "pending",
      nameservers: [],
      error: res.ok
        ? `${domain} isn't in the EGREED Cloudflare account yet. Add it as a site in Cloudflare (or grant the API token access to it), then click Re-check.`
        : `Cloudflare lookup failed: ${body.errors?.map((e) => e.message).join("; ") || res.status}`,
    };
  }
  return {
    zoneId: zone.id,
    status: zone.status === "active" ? "active" : "awaiting_nameservers",
    nameservers: zone.name_servers ?? [],
    error:
      zone.status === "active"
        ? null
        : `Point ${domain}'s nameservers at your registrar to: ${(zone.name_servers ?? []).join(", ")}`,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

export const addPlatformDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain: string }) => ({ domain: cleanDomain(d?.domain) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    const z = await lookupZone(data.domain);
    const { data: row, error } = await db
      .from("platform_domains")
      .insert({
        domain: data.domain,
        zone_id: z.zoneId,
        status: z.status,
        nameservers: z.nameservers,
        last_error: z.error,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.code === "23505" ? `${data.domain} is already added` : error.message);
    return row;
  });

export const recheckPlatformDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    const { data: row } = await db.from("platform_domains").select("*").eq("id", data.id).single();
    if (!row) throw new Error("Domain not found");
    const z = await lookupZone(row.domain);
    await db
      .from("platform_domains")
      .update({ zone_id: z.zoneId, status: z.status, nameservers: z.nameservers, last_error: z.error, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { status: z.status, error: z.error };
  });

/**
 * Make a domain the platform's main domain. With `migrate`, every existing
 * project subdomain moves from the old root to the new one and DNS + SSL is re-provisioned.
 */
export const activatePlatformDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; migrate?: boolean }) => ({ id: d.id, migrate: d.migrate === true }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    const { data: next } = await db.from("platform_domains").select("*").eq("id", data.id).single();
    if (!next) throw new Error("Domain not found");
    if (next.status !== "active" || !next.zone_id) {
      throw new Error(`${next.domain} isn't ready yet — finish the Cloudflare setup and re-check first.`);
    }
    const { data: prev } = await db.from("platform_domains").select("*").eq("is_active", true).maybeSingle();
    if (prev?.id === next.id) return { moved: 0, logs: ["Already the main domain."] };

    if (prev) await db.from("platform_domains").update({ is_active: false }).eq("id", prev.id);
    await db.from("platform_domains").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", next.id);

    const logs = [`✓ ${next.domain} is now the main platform domain.`];
    let moved = 0;
    if (data.migrate && prev) {
      const { data: rows } = await db.from("domains").select("id, project_id, subdomain, full_domain, is_primary").like("full_domain", `%.${prev.domain}`);
      const { provisionDnsAndSsl } = await import("@/lib/deploy-engine.server");
      for (const r of rows ?? []) {
        const label = r.full_domain.slice(0, -(prev.domain.length + 1));
        const full = `${label}.${next.domain}`;
        await db.from("domains").update({ full_domain: full, dns_status: "pending", ssl_status: "pending", cloudflare_record_id: null }).eq("id", r.id);
        if (r.is_primary) await db.from("projects").update({ domain: full }).eq("id", r.project_id);
        try {
          await provisionDnsAndSsl(db, { id: r.id, full_domain: full, subdomain: r.subdomain });
          logs.push(`✓ ${r.full_domain} → ${full}`);
        } catch (e) {
          logs.push(`✗ ${full}: ${e instanceof Error ? e.message : String(e)}`);
        }
        moved++;
      }
    }
    return { moved, logs };
  });

export const removePlatformDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    const { data: row } = await db.from("platform_domains").select("is_active").eq("id", data.id).single();
    if (row?.is_active) throw new Error("Make another domain the main one before removing this.");
    await db.from("platform_domains").delete().eq("id", data.id);
    return { ok: true };
  });
