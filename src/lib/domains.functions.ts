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
          full_domain: project.domain ?? subdomainFor(project.name),
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
