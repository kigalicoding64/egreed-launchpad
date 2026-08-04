import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Build a real, sandboxed preview of a project's repository at its latest
 * commit. Preview-only env overrides are injected without touching the
 * project's production environment variables.
 */
export const rebuildPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      projectId: string;
      branch?: string;
      envOverrides?: Record<string, string>;
      record?: boolean;
      path?: string;
    }) => {
      if (!data?.projectId || typeof data.projectId !== "string") {
        throw new Error("projectId is required");
      }
      const env = data.envOverrides ?? {};
      if (Object.keys(env).length > 100) throw new Error("Too many environment overrides");
      for (const [k, v] of Object.entries(env)) {
        if (typeof k !== "string" || typeof v !== "string" || k.length > 256 || v.length > 8192) {
          throw new Error("Invalid environment override");
        }
      }
      const path = typeof data.path === "string" ? data.path.slice(0, 512) : "/";
      return { ...data, envOverrides: env, path };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!project || project.user_id !== userId) throw new Error("Project not found");

    // Stored preview-target env vars are the baseline; UI overrides win.
    const { data: stored } = await supabase
      .from("env_vars")
      .select("key, value, target")
      .eq("project_id", project.id);

    const env: Record<string, string> = {};
    for (const row of stored ?? []) {
      if (row.target === "preview" || row.target === "development") env[row.key] = row.value;
    }
    Object.assign(env, data.envOverrides);

    const { buildRepoPreview } = await import("@/lib/preview.server");
    const result = await buildRepoPreview({
      repositoryUrl: project.repository_url,
      repositoryName: project.repository_name,
      branch: data.branch ?? project.branch ?? "main",
      projectName: project.name,
      framework: project.framework,
      env,
    });

    if (data.record !== false) {
      await supabase.from("deployments").insert({
        user_id: userId,
        project_id: project.id,
        commit_hash: result.commitHash,
        commit_message: `Preview build — ${result.commitMessage ?? "latest commit"}`,
        branch: data.branch ?? project.branch ?? "main",
        status: "online",
        progress: 100,
        triggered_by: "preview",
        github_event: "preview",
        finished_at: new Date().toISOString(),
        build_logs: [
          `→ Fetching ${project.repository_name}@${data.branch ?? project.branch}`,
          `→ Commit ${result.commitHash?.slice(0, 7)} — ${result.commitMessage ?? ""}`,
          `→ Preview env vars injected: ${Object.keys(env).length}`,
          `→ Entry: ${result.entryPath ?? "repository overview"}`,
          ...result.warnings.map((w) => `! ${w}`),
          "✓ Preview build ready",
        ].join("\n"),
      });
    }

    return {
      html: result.html,
      commitHash: result.commitHash,
      commitMessage: result.commitMessage,
      commitAuthor: result.commitAuthor,
      commitDate: result.commitDate,
      source: result.source,
      entryPath: result.entryPath,
      warnings: result.warnings,
      envKeys: Object.keys(env),
    };
  });
