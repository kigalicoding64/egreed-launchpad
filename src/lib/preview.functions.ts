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

    // Workspace edits / uploaded files live in project_files.
    const { data: fileRows, error: filesError } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", project.id);
    if (filesError) {
      throw new Error(
        "We couldn't read this project's source files. Check your project permissions and try again.",
      );
    }
    const fileMap: Record<string, string> = {};
    for (const row of fileRows ?? []) fileMap[row.path] = row.content;

    const { buildRepoPreview, buildUploadPreview } = await import("@/lib/preview.server");
    const result =
      project.source_type === "upload"
        ? await buildUploadPreview({
            projectName: project.name,
            framework: project.framework,
            env,
            files: fileMap,
            path: data.path ?? "/",
          })
        : await buildRepoPreview({
            repositoryUrl: project.repository_url,
            repositoryName: project.repository_name,
            branch: data.branch ?? project.branch ?? "main",
            projectName: project.name,
            framework: project.framework,
            env,
            path: data.path ?? "/",
            overlay: fileMap,
          });


    const logs = [
      `→ Fetching ${project.repository_name}@${data.branch ?? project.branch ?? "main"}`,
      `→ Commit ${result.commitHash?.slice(0, 7) ?? "unknown"} — ${result.commitMessage ?? ""}`,
      `→ Preview env vars injected: ${Object.keys(env).length}${Object.keys(env).length ? ` (${Object.keys(env).join(", ")})` : ""}`,
      `→ Source: ${result.source}`,
      `→ Entry: ${result.entryPath ?? "repository overview"}`,
      `→ Path: ${result.path} · pages discovered: ${result.routes.length}`,
      ...result.warnings.map((w) => `! ${w}`),
      "✓ Preview build ready",
    ];

    if (data.record !== false && (data.path ?? "/") === "/") {
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
        build_logs: logs.join("\n"),
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
      path: result.path,
      routes: result.routes,
      warnings: result.warnings,
      envKeys: Object.keys(env),
      logs,
    };
  });
