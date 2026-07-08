import { createFileRoute } from "@tanstack/react-router";

// Scheduled SSL renewal workflow.
// Called by pg_cron. Finds domains whose SSL is within the renewal window
// (or missing an expiry) and renews the certificate via Cloudflare.
// Auth: the caller must present the project anon key in the `apikey` header.

const RENEWAL_WINDOW_DAYS = 30;

export const Route = createFileRoute("/api/public/hooks/ssl-renew")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey");
        if (!anonKey || provided !== anonKey) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as unknown as { from: (t: string) => any };

        const cutoff = new Date(
          Date.now() + RENEWAL_WINDOW_DAYS * 24 * 3600 * 1000,
        ).toISOString();

        // Active domains expiring soon, or missing an expiry timestamp.
        const { data: domains, error } = await admin
          .from("domains")
          .select("id, full_domain, subdomain, ssl_expires_at, cloudflare_record_id")
          .eq("dns_status", "active")
          .or(`ssl_expires_at.lte.${cutoff},ssl_expires_at.is.null`);
        if (error) {
          console.error("[ssl-renew] query failed", error);
          return new Response(JSON.stringify({ error: "Query failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { renewDomainSsl } = await import("@/lib/deploy-engine.server");
        let renewed = 0;
        for (const domain of domains ?? []) {
          const ok = await renewDomainSsl(admin, domain);
          if (ok) renewed += 1;
        }

        return new Response(
          JSON.stringify({ ok: true, checked: domains?.length ?? 0, renewed }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
