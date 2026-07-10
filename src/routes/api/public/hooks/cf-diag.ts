import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY diagnostic: verifies the Cloudflare token + DNS access from the
// real server runtime (which holds the current secrets). Returns booleans
// only — never the token value. Delete after verification.
export const Route = createFileRoute("/api/public/hooks/cf-diag")({
  server: {
    handlers: {
      GET: async () => {
        const { getCloudflareConfig } = await import("@/lib/cloudflare.server");
        const cfg = getCloudflareConfig();
        if (!cfg) {
          return Response.json({ configured: false });
        }
        const CF = "https://api.cloudflare.com/client/v4";
        const auth = { Authorization: `Bearer ${cfg.token}` };

        const verify = await fetch(`${CF}/user/tokens/verify`, { headers: auth })
          .then((r) => r.json())
          .catch((e) => ({ success: false, errors: [String(e)] }));

        const dns = await fetch(
          `${CF}/zones/${cfg.zoneId}/dns_records?per_page=1`,
          { headers: auth },
        )
          .then((r) => r.json())
          .catch((e) => ({ success: false, errors: [String(e)] }));

        return Response.json({
          configured: true,
          tokenPrefix: cfg.token.slice(0, 4),
          verify: { success: verify.success, status: verify.result?.status, errors: verify.errors },
          dns: { success: dns.success, errors: dns.errors },
        });
      },
    },
  },
});
