import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Provision (or re-provision) DNS + SSL for a project's primary domain.
 * Creates the Cloudflare CNAME record and marks the domain HTTPS-ready.
 */
export const provisionDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { projectId: string }) => {
    if (!data?.projectId || typeof data.projectId !== "string") {
      throw new Error("projectId is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!project || project.user_id !== userId) throw new Error("Project not found");

    const client = supabase as unknown as { from: (t: string) => any };

    // Ensure a primary domain exists for the project.
    let { data: domain } = await client
      .from("domains")
      .select("id, full_domain, subdomain")
      .eq("project_id", project.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (!domain) {
      const { subdomainFor, slugify } = await import("@/lib/egreed");
      const { data: created, error: cErr } = await client
        .from("domains")
        .insert({
          user_id: userId,
          project_id: project.id,
          subdomain: slugify(project.name) || "app",
          full_domain:
            project.domain ??
            subdomainFor(
              project.name,
              await (await import("@/lib/cloudflare.server")).getActiveRootDomainFromDb(client),
            ),
          ssl_status: "pending",
          dns_status: "pending",
          dns_type: "CNAME",
          is_primary: true,
        })
        .select("id, full_domain, subdomain")
        .single();
      if (cErr) throw cErr;
      domain = created;
    }

    const { provisionDnsAndSsl } = await import("@/lib/deploy-engine.server");
    const logs = await provisionDnsAndSsl(client, domain);
    return { ok: true, logs };
  });

/**
 * Re-check DNS and renew SSL for a specific domain (renewal workflow).
 */
export const refreshDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { domainId: string }) => {
    if (!data?.domainId || typeof data.domainId !== "string") {
      throw new Error("domainId is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: domain, error } = await supabase
      .from("domains")
      .select(
        "id, full_domain, subdomain, user_id, ssl_expires_at, cloudflare_record_id, ssl_provisioned_at",
      )
      .eq("id", data.domainId)
      .maybeSingle();
    if (error) throw error;
    if (!domain || domain.user_id !== userId) throw new Error("Domain not found");

    const client = supabase as unknown as { from: (t: string) => any };
    const { renewDomainSsl } = await import("@/lib/deploy-engine.server");
    const ok = await renewDomainSsl(client, domain);
    return { ok };
  });

/**
 * Deploy / refresh the Cloudflare edge worker that makes every project
 * subdomain (*.egreedtech.org) serve a real page instead of a 404.
 */
export const syncEdgeRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const origin =
      process.env.EGREED_PLATFORM_ORIGIN ?? "https://deploy-spark-africa.lovable.app";
    const { syncIngressWorker } = await import("@/lib/cf-worker.server");
    const result = await syncIngressWorker(origin);
    return { ok: true, logs: result.logs, pattern: result.pattern };
  });

/**
 * Admin-only: attach an additional domain (platform subdomain or an external
 * custom domain) to a project and start DNS + SSL provisioning.
 */
export const addDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { projectId: string; domain: string; primary?: boolean }) => {
    if (!data?.projectId || typeof data.projectId !== "string") {
      throw new Error("projectId is required");
    }
    const raw = (data.domain ?? "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(raw)) {
      throw new Error("Enter a valid domain or subdomain label");
    }
    if (raw.length > 253) throw new Error("Domain is too long");
    return { projectId: data.projectId, domain: raw, primary: data.primary === true };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (rErr) throw rErr;
    if (!roles?.length) throw new Error("Only admins can add domains");

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, name, user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project) throw new Error("Project not found");

    const { slugify } = await import("@/lib/egreed");
    const { getActiveRootDomainFromDb } = await import("@/lib/cloudflare.server");
    const client = supabase as unknown as { from: (t: string) => any };
    const ROOT_DOMAIN = await getActiveRootDomainFromDb(client);
    // A bare label is treated as a platform subdomain.
    const fullDomain = data.domain.includes(".")
      ? data.domain
      : `${data.domain}.${ROOT_DOMAIN}`;
    const isPlatform = fullDomain.endsWith(`.${ROOT_DOMAIN}`);
    const subdomain = isPlatform
      ? fullDomain.slice(0, -(ROOT_DOMAIN.length + 1))
      : slugify(fullDomain);


    const { data: existing } = await client
      .from("domains")
      .select("id")
      .eq("full_domain", fullDomain)
      .maybeSingle();
    if (existing) throw new Error(`${fullDomain} is already attached to a project`);

    if (data.primary) {
      await client.from("domains").update({ is_primary: false }).eq("project_id", project.id);
    }

    const { data: created, error: cErr } = await client
      .from("domains")
      .insert({
        user_id: project.user_id,
        project_id: project.id,
        subdomain,
        full_domain: fullDomain,
        ssl_status: "pending",
        dns_status: "pending",
        dns_type: "CNAME",
        is_primary: data.primary,
      })
      .select("id, full_domain, subdomain")
      .single();
    if (cErr) throw cErr;

    if (data.primary) {
      await client.from("projects").update({ domain: fullDomain }).eq("id", project.id);
    }

    if (!isPlatform) {
      return {
        ok: true,
        domain: created,
        external: true,
        logs: [
          `Domain ${fullDomain} registered for ${project.name}.`,
          `Add a CNAME record at your registrar: ${fullDomain} → ingress.${ROOT_DOMAIN}`,
          "SSL is issued automatically once the record resolves.",
        ],
      };
    }

    const { provisionDnsAndSsl } = await import("@/lib/deploy-engine.server");
    const logs = await provisionDnsAndSsl(client, created);
    return { ok: true, domain: created, external: false, logs };
  });
