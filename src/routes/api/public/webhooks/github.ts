import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

// GitHub webhook receiver.
// - Verifies the HMAC SHA-256 signature (x-hub-signature-256).
// - Handles `push`, `installation`, and `repository` events.
// - Logs every delivery to webhook_events and triggers deployment jobs on push.
// Lives under /api/public/* so external GitHub deliveries bypass site auth;
// security is enforced here via signature verification.

function verifySignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type Admin = { from: (t: string) => any };

async function logEvent(
  admin: Admin,
  row: {
    event_type: string;
    delivery_id: string | null;
    signature_valid: boolean;
    processed: boolean;
    user_id?: string | null;
    project_id?: string | null;
    error?: string | null;
    payload?: unknown;
  },
) {
  try {
    await admin.from("webhook_events").insert({ provider: "github", ...row });
  } catch (e) {
    console.error("[github-webhook] failed to log event", e);
  }
}

async function handlePush(admin: Admin, payload: any) {
  const fullName: string | undefined = payload?.repository?.full_name;
  const htmlUrl: string | undefined = payload?.repository?.html_url;
  const branch = String(payload?.ref ?? "refs/heads/main").replace("refs/heads/", "");
  const head = payload?.head_commit;
  if (!fullName) return { processed: false, userId: null, projectId: null };

  // Find matching project(s) by repository name or URL.
  let { data: projects } = await admin
    .from("projects")
    .select("*")
    .eq("repository_name", fullName);
  if ((!projects || projects.length === 0) && htmlUrl) {
    const alt = await admin.from("projects").select("*").eq("repository_url", htmlUrl);
    projects = alt.data ?? [];
  }
  if (!projects || projects.length === 0) {
    return { processed: false, userId: null, projectId: null };
  }

  const { runDeploymentJob } = await import("@/lib/deploy-engine.server");
  let firstProjectId: string | null = null;
  let firstUserId: string | null = null;

  for (const project of projects) {
    firstProjectId = firstProjectId ?? project.id;
    firstUserId = firstUserId ?? project.user_id;
    if (project.auto_deploy === false || project.branch !== branch) continue;

    const { data: deployment } = await admin
      .from("deployments")
      .insert({
        user_id: project.user_id,
        project_id: project.id,
        commit_hash: head?.id ? String(head.id).slice(0, 7) : Math.random().toString(16).slice(2, 9),
        commit_message: head?.message ?? "Push from GitHub",
        branch,
        status: "queued",
        progress: 0,
        triggered_by: "github",
        github_event: "push",
      })
      .select("id")
      .single();

    if (deployment?.id) {
      await runDeploymentJob(admin, deployment.id);
    }
  }

  return { processed: true, userId: firstUserId, projectId: firstProjectId };
}

async function handleInstallation(admin: Admin, payload: any) {
  const login: string | undefined = payload?.installation?.account?.login;
  const installationId = payload?.installation?.id ? String(payload.installation.id) : null;
  const action: string = payload?.action ?? "";
  if (!login) return { userId: null };

  const { data: conn } = await admin
    .from("github_connections")
    .select("id, user_id")
    .eq("github_username", login)
    .maybeSingle();

  if (conn) {
    if (action === "deleted") {
      await admin.from("github_connections").update({ installation_id: null }).eq("id", conn.id);
    } else {
      await admin
        .from("github_connections")
        .update({ installation_id: installationId })
        .eq("id", conn.id);
    }
  }
  return { userId: conn?.user_id ?? null };
}

async function handleRepository(admin: Admin, payload: any) {
  const action: string = payload?.action ?? "";
  const fullName: string | undefined = payload?.repository?.full_name;
  // On rename, keep project repository metadata in sync.
  if (action === "renamed" && fullName && payload?.changes?.repository?.name?.from) {
    const oldName = `${payload.repository.owner?.login}/${payload.changes.repository.name.from}`;
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("repository_name", oldName)
      .maybeSingle();
    if (project) {
      await admin
        .from("projects")
        .update({ repository_name: fullName, repository_url: payload.repository.html_url })
        .eq("id", project.id);
      return { userId: project.user_id, projectId: project.id };
    }
  }
  return { userId: null, projectId: null };
}

export const Route = createFileRoute("/api/public/webhooks/github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        const event = request.headers.get("x-github-event") ?? "unknown";
        const delivery = request.headers.get("x-github-delivery");
        const signature = request.headers.get("x-hub-signature-256");
        const rawBody = await request.text();

        if (!secret) {
          return new Response(
            JSON.stringify({ error: "Webhook secret not configured" }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as unknown as Admin;

        const valid = verifySignature(secret, rawBody, signature);
        if (!valid) {
          await logEvent(admin, {
            event_type: event,
            delivery_id: delivery,
            signature_valid: false,
            processed: false,
            error: "Invalid signature",
          });
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let payload: any = {};
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = {};
        }

        // GitHub sends `ping` when a webhook is first created.
        if (event === "ping") {
          await logEvent(admin, {
            event_type: "ping",
            delivery_id: delivery,
            signature_valid: true,
            processed: true,
            payload,
          });
          return new Response(JSON.stringify({ ok: true, pong: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          let userId: string | null = null;
          let projectId: string | null = null;
          let processed = true;

          if (event === "push") {
            const r = await handlePush(admin, payload);
            userId = r.userId;
            projectId = r.projectId;
            processed = r.processed;
          } else if (event === "installation" || event === "installation_repositories") {
            const r = await handleInstallation(admin, payload);
            userId = r.userId;
          } else if (event === "repository") {
            const r = await handleRepository(admin, payload);
            userId = r.userId;
            projectId = r.projectId;
          } else {
            processed = false;
          }

          await logEvent(admin, {
            event_type: event,
            delivery_id: delivery,
            signature_valid: true,
            processed,
            user_id: userId,
            project_id: projectId,
            payload,
          });

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[github-webhook] handler error", err);
          await logEvent(admin, {
            event_type: event,
            delivery_id: delivery,
            signature_valid: true,
            processed: false,
            error: err instanceof Error ? err.message : "handler error",
            payload,
          });
          return new Response(JSON.stringify({ error: "Processing error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
