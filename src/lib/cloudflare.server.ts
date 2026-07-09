// Server-only Cloudflare DNS API wrapper.
// Import dynamically inside server handlers/engine — never from client code.
// Requires env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID.

const CF_API = "https://api.cloudflare.com/client/v4";

export interface CloudflareConfig {
  token: string;
  zoneId: string;
}

export function getCloudflareConfig(): CloudflareConfig | null {
  // Accept multiple casings since secret names are case-sensitive.
  const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_API_Token;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID ?? process.env.cloudflare_zone_id;
  if (!token || !zoneId) return null;
  return { token, zoneId };
}

export function cloudflareConfigured(): boolean {
  return getCloudflareConfig() !== null;
}

interface CfRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

async function cf<T>(
  cfg: CloudflareConfig,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; result: T | null; errors: unknown[] }> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: unknown[];
  };
  if (!res.ok || body.success === false) {
    console.error(`[cloudflare] ${path} failed [${res.status}]`, JSON.stringify(body.errors));
    return { ok: false, result: null, errors: body.errors ?? [{ status: res.status }] };
  }
  return { ok: true, result: (body.result ?? null) as T | null, errors: [] };
}

/**
 * Create or update a proxied CNAME record for a subdomain.
 * Proxying through Cloudflare provides automatic Universal SSL.
 */
export async function upsertCnameRecord(
  cfg: CloudflareConfig,
  fullName: string,
  target: string,
): Promise<{ recordId: string; proxied: boolean } | null> {
  // Look for an existing record for this name.
  const existing = await cf<CfRecord[]>(
    cfg,
    `/zones/${cfg.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fullName)}`,
    { method: "GET" },
  );

  const payload = JSON.stringify({
    type: "CNAME",
    name: fullName,
    content: target,
    ttl: 1, // automatic
    proxied: true,
  });

  if (existing.ok && existing.result && existing.result.length > 0) {
    const id = existing.result[0].id;
    const updated = await cf<CfRecord>(cfg, `/zones/${cfg.zoneId}/dns_records/${id}`, {
      method: "PUT",
      body: payload,
    });
    if (!updated.ok || !updated.result) return null;
    return { recordId: updated.result.id, proxied: updated.result.proxied };
  }

  const created = await cf<CfRecord>(cfg, `/zones/${cfg.zoneId}/dns_records`, {
    method: "POST",
    body: payload,
  });
  if (!created.ok || !created.result) return null;
  return { recordId: created.result.id, proxied: created.result.proxied };
}

export async function deleteCnameRecord(cfg: CloudflareConfig, recordId: string): Promise<boolean> {
  const res = await cf(cfg, `/zones/${cfg.zoneId}/dns_records/${recordId}`, { method: "DELETE" });
  return res.ok;
}

/** Confirm a record still resolves (used by DNS status checks / renewal). */
export async function recordExists(cfg: CloudflareConfig, recordId: string): Promise<boolean> {
  const res = await cf<CfRecord>(cfg, `/zones/${cfg.zoneId}/dns_records/${recordId}`, {
    method: "GET",
  });
  return res.ok && !!res.result;
}
