import { createFileRoute } from "@tanstack/react-router";

/**
 * Deploys / refreshes the Cloudflare ingress worker that makes every
 * *.egreedtech.org project subdomain serve a real page.
 * Guarded by the project's publishable key (same pattern as the cron hooks).
 */
export const Route = createFileRoute("/api/public/hooks/edge-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin = process.env.EGREED_PLATFORM_ORIGIN ?? "https://deploy-spark-africa.lovable.app";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: active } = await supabaseAdmin
            .from("platform_domains").select("zone_id").eq("is_active", true).maybeSingle();
          const { syncIngressWorker } = await import("@/lib/cf-worker.server");
          const result = await syncIngressWorker(origin, (active?.zone_id as string) || undefined);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[edge-sync] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
