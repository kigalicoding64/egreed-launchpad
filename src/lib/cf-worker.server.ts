// Server-only: deploys the EGREED ingress Cloudflare Worker + zone route so that
// every *.egreedtech.org project subdomain actually serves a live page instead
// of a 404 from a non-existent origin.
import { getCloudflareConfig, type CloudflareConfig } from "@/lib/cloudflare.server";

const CF_API = "https://api.cloudflare.com/client/v4";
export const WORKER_NAME = "egreed-ingress";

/** Hosts inside the zone that must NOT be handled by the ingress worker. */
const RESERVED = ["deploy", "www", "api", "ingress"];

/** The worker source deployed to Cloudflare (ESM module syntax). */
function workerSource(platformOrigin: string): string {
  return `const PLATFORM = ${JSON.stringify(platformOrigin)};
const RESERVED = ${JSON.stringify(RESERVED)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;
    const parts = host.split(".");
    const sub = parts.length > 2 ? parts.slice(0, parts.length - 2).join(".") : "";

    // Apex / reserved hosts pass straight through to their real origin.
    if (!sub || RESERVED.includes(sub)) return fetch(request);

    const target = new URL(PLATFORM);
    target.pathname = "/hosted/" + encodeURIComponent(sub);
    target.search = url.search;

    const upstream = await fetch(target.toString(), {
      headers: {
        "user-agent": request.headers.get("user-agent") || "egreed-ingress",
        accept: request.headers.get("accept") || "text/html",
      },
      cf: { cacheTtl: 30 },
    });

    const headers = new Headers(upstream.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("x-egreed-ingress", sub);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
`;
}

async function cfJson<T>(
  cfg: CloudflareConfig,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; result: T | null; errors: unknown[]; status: number }> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: unknown[];
  };
  const ok = res.ok && body.success !== false;
  if (!ok) console.error(`[cf-worker] ${path} [${res.status}]`, JSON.stringify(body.errors));
  return { ok, result: (body.result ?? null) as T | null, errors: body.errors ?? [], status: res.status };
}

function fmt(errors: unknown[]): string {
  if (!errors.length) return "unknown Cloudflare error";
  return errors
    .map((e) => {
      const o = e as { code?: number; message?: string };
      return o?.message ? (o.code ? `${o.code}: ${o.message}` : o.message) : String(e);
    })
    .join("; ");
}

export interface EdgeSyncResult {
  accountId: string;
  scriptDeployed: boolean;
  routeId: string | null;
  pattern: string;
  logs: string[];
}

/**
 * Idempotently deploy the ingress worker and bind it to `*.<zone>/*`.
 * Safe to call repeatedly — updates the script and reuses the existing route.
 */
export async function syncIngressWorker(platformOrigin: string): Promise<EdgeSyncResult> {
  const cfg = getCloudflareConfig();
  if (!cfg) {
    throw new Error("Cloudflare is not configured (missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID).");
  }
  const logs: string[] = [];

  // 1. Resolve zone name + account id.
  const zone = await cfJson<{ id: string; name: string; account: { id: string; name: string } }>(
    cfg,
    `/zones/${cfg.zoneId}`,
  );
  if (!zone.ok || !zone.result) throw new Error(`Zone lookup failed — ${fmt(zone.errors)}`);
  const zoneName = zone.result.name;
  const accountId = zone.result.account.id;
  logs.push(`✓ Zone ${zoneName} (account ${zone.result.account.name})`);

  // 2. Upload / update the worker script (ESM multipart upload).
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ main_module: "worker.js", compatibility_date: "2024-11-01" })], {
      type: "application/json",
    }),
  );
  form.append(
    "worker.js",
    new Blob([workerSource(platformOrigin)], { type: "application/javascript+module" }),
    "worker.js",
  );

  const upload = await cfJson<{ id: string }>(
    cfg,
    `/accounts/${accountId}/workers/scripts/${WORKER_NAME}`,
    { method: "PUT", body: form },
  );
  if (!upload.ok) {
    // Fallback: a zone-level forwarding Page Rule still gets every subdomain
    // onto a real page, just via redirect instead of transparent proxying.
    const fallback = await ensureForwardingPageRule(cfg, zoneName, platformOrigin);
    if (fallback.ok) {
      logs.push(`• Worker upload unavailable — using forwarding rule instead`);
      logs.push(...fallback.logs);
      return { accountId, scriptDeployed: false, routeId: null, pattern: `*.${zoneName}/*`, logs };
    }
    throw new Error(
      `Worker upload failed — ${fmt(upload.errors)}. Add "Account → Workers Scripts → Edit" (or "Zone → Page Rules → Edit") to the Cloudflare API token, then sync again.`,
    );
  }
  logs.push(`✓ Worker "${WORKER_NAME}" deployed → ${platformOrigin}/hosted/*`);

  // 3. Bind the wildcard route for the zone.
  const pattern = `*.${zoneName}/*`;
  const routes = await cfJson<{ id: string; pattern: string; script: string }[]>(
    cfg,
    `/zones/${cfg.zoneId}/workers/routes`,
  );
  if (!routes.ok) {
    throw new Error(
      `Route lookup failed — ${fmt(routes.errors)}. The API token needs "Zone → Workers Routes → Edit".`,
    );
  }
  const existing = (routes.result ?? []).find((r) => r.pattern === pattern);

  let routeId: string | null = existing?.id ?? null;
  if (existing) {
    if (existing.script !== WORKER_NAME) {
      const upd = await cfJson<{ id: string }>(
        cfg,
        `/zones/${cfg.zoneId}/workers/routes/${existing.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pattern, script: WORKER_NAME }),
        },
      );
      if (!upd.ok) throw new Error(`Route update failed — ${fmt(upd.errors)}`);
    }
    logs.push(`✓ Route ${pattern} → ${WORKER_NAME} (existing)`);
  } else {
    const created = await cfJson<{ id: string }>(cfg, `/zones/${cfg.zoneId}/workers/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern, script: WORKER_NAME }),
    });
    if (!created.ok || !created.result) {
      throw new Error(`Route create failed — ${fmt(created.errors)}`);
    }
    routeId = created.result.id;
    logs.push(`✓ Route ${pattern} → ${WORKER_NAME} (created)`);
  }

  return { accountId, scriptDeployed: true, routeId, pattern, logs };
}
