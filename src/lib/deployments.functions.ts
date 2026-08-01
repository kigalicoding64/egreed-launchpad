import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Create a new deployment for a project and run the deployment job.
 * Streams status/progress to the UI via realtime as the engine advances.
 */
export const triggerDeployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      projectId: string;
      commitMessage?: string;
      branch?: string;
      commitHash?: string;
      triggeredBy?: string;
    }) => {
      if (!data?.projectId || typeof data.projectId !== "string") {
        throw new Error("projectId is required");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project || project.user_id !== userId) throw new Error("Project not found");

    const { data: deployment, error: insErr } = await supabase
      .from("deployments")
      .insert({
        user_id: userId,
        project_id: project.id,
        commit_hash: data.commitHash ?? Math.random().toString(16).slice(2, 9),
        commit_message: data.commitMessage ?? "Manual deployment",
        branch: data.branch ?? project.branch ?? "main",
        status: "queued",
        progress: 0,
        triggered_by: data.triggeredBy ?? "manual",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { runDeploymentJob } = await import("@/lib/deploy-engine.server");
    await runDeploymentJob(supabase as unknown as { from: (t: string) => unknown }, deployment.id);

    return { deploymentId: deployment.id as string };
  });

/**
 * Run (or resume) an existing deployment job — used for queued deployments
 * created by incoming GitHub webhook events.
 */
export const runDeployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deploymentId: string }) => {
    if (!data?.deploymentId || typeof data.deploymentId !== "string") {
      throw new Error("deploymentId is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("id, user_id, status")
      .eq("id", data.deploymentId)
      .maybeSingle();
    if (error) throw error;
    if (!deployment || deployment.user_id !== userId) throw new Error("Deployment not found");

    const { runDeploymentJob } = await import("@/lib/deploy-engine.server");
    await runDeploymentJob(supabase as unknown as { from: (t: string) => unknown }, deployment.id);

    return { ok: true };
  });
