import { createFileRoute } from "@tanstack/react-router";

// Public env vars only — never expose server secrets to visitors.
const PUBLIC_PREFIXES = ["VITE_", "NEXT_PUBLIC_", "PUBLIC_", "REACT_APP_", "NUXT_PUBLIC_"];

function page(title: string, body: string, status: number) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1319;color:#e6e8ea;font-family:system-ui,sans-serif;text-align:center;padding:24px}p{color:#9aa3ad;max-width:480px}</style></head><body><div><h1>${title}</h1><p>${body}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** Serves a project's real app on its assigned subdomain (called by the edge worker). */
export const Route = createFileRoute("/api/public/serve/$subdomain")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const sub = String(params.subdomain ?? "").toLowerCase();
        if (!/^[a-z0-9-]{1,63}$/.test(sub)) return page("Not found", "Unknown project address.", 404);
        const url = new URL(request.url);
        const path = (url.searchParams.get("__path") || "/").slice(0, 512);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project, error: lookupError } = await supabaseAdmin
          .from("projects")
          .select("id, name, framework, source_type, repository_url, repository_name, branch, domain")
          .like("domain", `${sub}.%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lookupError) console.error("[serve] lookup", lookupError.message);
        if (!project) return page("Project not found", `No project is deployed at ${sub}.`, 404);

        const { data: envRows } = await supabaseAdmin
          .from("env_vars").select("key, value, target").eq("project_id", project.id);
        const env: Record<string, string> = {};
        for (const r of envRows ?? []) {
          if (r.target === "production" && PUBLIC_PREFIXES.some((p) => r.key.startsWith(p))) env[r.key] = r.value;
        }
        const { data: fileRows } = await supabaseAdmin
          .from("project_files").select("path, content").eq("project_id", project.id);
        const files: Record<string, string> = {};
        for (const r of fileRows ?? []) files[r.path] = r.content;

        try {
          const { buildRepoPreview, buildUploadPreview } = await import("@/lib/preview.server");
          const result =
            project.source_type === "upload"
              ? await buildUploadPreview({ projectName: project.name, framework: project.framework, env, files, path })
              : await buildRepoPreview({
                  repositoryUrl: project.repository_url,
                  repositoryName: project.repository_name,
                  branch: project.branch ?? "main",
                  projectName: project.name,
                  framework: project.framework,
                  env,
                  path,
                  overlay: files,
                });
          return new Response(result.html, {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "public, max-age=30",
              "x-egreed-project": project.name,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "This app could not be loaded.";
          return page(`${project.name} is unavailable`, msg.replace(/[<>&]/g, ""), 200);
        }
      },
    },
  },
});
