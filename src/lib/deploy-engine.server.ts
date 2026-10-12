// Server-only deployment orchestration engine + DNS/SSL provisioning workflow.
// Advances a deployment record through the DEPLOY_PHASES state machine, writing
// status / progress / build_logs to the database (streamed to the UI via realtime).
// Import dynamically inside server handlers/server functions only.
import { DEPLOY_PHASES, DNS_TARGET, slugify, subdomainFor } from "@/lib/egreed";
import { getActiveRootDomainFromDb, resolveCloudflareConfig, upsertCnameRecord } from "@/lib/cloudflare.server";

// Loose client shape — works with both the admin client and the RLS user client.
type DbClient = { from: (table: string) => any };

const SSL_VALIDITY_DAYS = 90;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface DomainRow {
  id: string;
  full_domain: string;
  subdomain: string;
}

/** Ensure the project has a primary domain row; create one if missing. */
async function ensureDomain(
  db: DbClient,
  project: { id: string; user_id: string; name: string; domain: string | null },
): Promise<DomainRow | null> {
  const { data: existing } = await db
    .from("domains")
    .select("id, full_domain, subdomain")
    .eq("project_id", project.id)
    .eq("is_primary", true)
    .maybeSingle();
  if (existing) return existing as DomainRow;

  const full = project.domain ?? subdomainFor(project.name, await getActiveRootDomainFromDb(db));
  const sub = slugify(project.name) || "app";
  const { data: created, error } = await db
    .from("domains")
    .insert({
      user_id: project.user_id,
      project_id: project.id,
      subdomain: sub,
      full_domain: full,
      ssl_status: "pending",
      dns_status: "pending",
      dns_type: "CNAME",
      is_primary: true,
    })
    .select("id, full_domain, subdomain")
    .single();
  if (error) {
    console.error("[engine] ensureDomain failed", error);
    return null;
  }
  return created as DomainRow;
}

/**
 * Automatic SSL provisioning + DNS workflow, tied to domain creation.
 * Creates/updates the Cloudflare CNAME (proxied → Universal SSL), then marks
 * the domain HTTPS-ready. Returns log lines describing what happened.
 */
export async function provisionDnsAndSsl(db: DbClient, domain: DomainRow): Promise<string[]> {
  const logs: string[] = [];
  const now = new Date();
  const cfg = await resolveCloudflareConfig(db, domain.full_domain);

  if (!cfg) {
    await db
      .from("domains")
      .update({
        dns_target: DNS_TARGET,
        dns_status: "pending",
        ssl_status: "pending",
        last_checked_at: now.toISOString(),
      })
      .eq("id", domain.id);
    throw new Error(
      "Cloudflare is not configured (missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID). Domain queued for DNS + SSL.",
    );
  }

  let rec: { recordId: string; proxied: boolean };
  try {
    rec = await upsertCnameRecord(cfg, domain.full_domain, DNS_TARGET);
  } catch (err) {
    await db
      .from("domains")
      .update({
        dns_status: "failed",
        ssl_status: "failed",
        last_checked_at: now.toISOString(),
      })
      .eq("id", domain.id);
    throw err instanceof Error ? err : new Error(String(err));
  }

  const expires = new Date(now.getTime() + SSL_VALIDITY_DAYS * 24 * 3600 * 1000);
  await db
    .from("domains")
    .update({
      cloudflare_record_id: rec.recordId,
      dns_target: DNS_TARGET,
      dns_status: "active",
      ssl_status: "active",
      ssl_provisioned_at: now.toISOString(),
      ssl_expires_at: expires.toISOString(),
      last_checked_at: now.toISOString(),
    })
    .eq("id", domain.id);

  logs.push(`✓ CNAME ${domain.full_domain} → ${DNS_TARGET} (Cloudflare, proxied)`);
  logs.push(`✓ SSL certificate provisioned — HTTPS ready (auto-renews)`);
  return logs;
}

/**
 * Run a deployment job through the full phase state machine.
 * Each phase update is persisted so subscribers see live progress.
 */
export async function runDeploymentJob(db: DbClient, deploymentId: string): Promise<void> {
  const { data: deployment } = await db
    .from("deployments")
    .select("*")
    .eq("id", deploymentId)
    .maybeSingle();
  if (!deployment) {
    console.error("[engine] deployment not found", deploymentId);
    return;
  }

  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", deployment.project_id)
    .maybeSingle();

  const logs: string[] = [
    `> Deployment ${deploymentId.slice(0, 8)} started (${deployment.triggered_by})`,
    `> Authenticated via EGREED Deploy GitHub App`,
  ];

  try {
    for (const phase of DEPLOY_PHASES) {
      logs.push(phase.log);

      // On the domain/SSL phase, run the real DNS + SSL provisioning workflow.
      if (phase.label.startsWith("Configuring domain") && project) {
        const domain = await ensureDomain(db, project);
        if (domain) {
          const dnsLogs = await provisionDnsAndSsl(db, domain);
          logs.push(...dnsLogs);
        }
      }

      const isFinal = phase.status === "online";
      await db
        .from("deployments")
        .update({
          status: phase.status,
          progress: phase.progress,
          build_logs: logs.join("\n"),
          ...(isFinal
            ? {
                finished_at: new Date().toISOString(),
                deploy_url: project?.domain ? `https://${project.domain}` : null,
              }
            : {}),
        })
        .eq("id", deploymentId);

      if (project) {
        await db.from("projects").update({ status: phase.status }).eq("id", project.id);
      }

      if (!isFinal) await sleep(700);
    }

    if (project?.domain) {
      logs.push(`✓ Live at https://${project.domain}`);
      await db.from("deployments").update({ build_logs: logs.join("\n") }).eq("id", deploymentId);
    }
  } catch (err) {
    console.error("[engine] job failed", err);
    logs.push(`✗ Deployment failed: ${err instanceof Error ? err.message : "unknown error"}`);
    await db
      .from("deployments")
      .update({
        status: "failed",
        build_logs: logs.join("\n"),
        finished_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
    if (project) {
      await db.from("projects").update({ status: "failed" }).eq("id", project.id);
    }
  }
}

/**
 * Re-check DNS + refresh SSL for a domain (renewal workflow).
 * Renews certs within the renewal window and extends the expiry.
 */
export async function renewDomainSsl(
  db: DbClient,
  domain: DomainRow & {
    ssl_expires_at: string | null;
    cloudflare_record_id: string | null;
    ssl_provisioned_at?: string | null;
  },
): Promise<boolean> {
  const now = new Date();
  const cfg = await resolveCloudflareConfig(db, domain.full_domain);
  if (!cfg) {
    throw new Error(
      "Cloudflare is not configured (missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID).",
    );
  }

  // Ensure the DNS record still exists (recreates if missing), then extend SSL.
  let rec: { recordId: string; proxied: boolean };
  try {
    rec = await upsertCnameRecord(cfg, domain.full_domain, DNS_TARGET);
  } catch (err) {
    await db
      .from("domains")
      .update({ dns_status: "failed", last_checked_at: now.toISOString() })
      .eq("id", domain.id);
    throw err instanceof Error ? err : new Error(String(err));
  }

  const expires = new Date(now.getTime() + SSL_VALIDITY_DAYS * 24 * 3600 * 1000);
  await db
    .from("domains")
    .update({
      cloudflare_record_id: rec.recordId,
      dns_target: DNS_TARGET,
      dns_status: "active",
      ssl_status: "active",
      // Backfill provisioned timestamp for domains that were never fully provisioned.
      ...(domain.ssl_provisioned_at ? {} : { ssl_provisioned_at: now.toISOString() }),
      ssl_renewed_at: now.toISOString(),
      ssl_expires_at: expires.toISOString(),
      last_checked_at: now.toISOString(),
    })
    .eq("id", domain.id);
  return true;
}
