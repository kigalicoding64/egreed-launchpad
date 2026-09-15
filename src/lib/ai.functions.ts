import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EnvChecklistItem {
  key: string;
  required: boolean;
  secret: boolean;
  example: string;
  why: string;
  /** Present in the project's stored environment variables. */
  present?: boolean;
}

export interface EnvChecklistResult {
  framework: string;
  items: EnvChecklistItem[];
  warnings: string[];
  template: string;
}

const RISKY = /(secret|token|password|passwd|private[_-]?key|api[_-]?key|credential)/i;
const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)/;

/**
 * Analyse a project's files with Lovable AI and return an environment-variable
 * checklist, a sample .env template, and warnings for missing / risky secrets.
 */
export const generateEnvChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { projectId: string }) => {
    if (!data?.projectId || typeof data.projectId !== "string") {
      throw new Error("projectId is required");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<EnvChecklistResult> => {
    const { supabase, userId } = context;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project || project.user_id !== userId) throw new Error("Project not found");

    const { data: fileRows } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", project.id)
      .limit(300);

    const { data: envRows } = await supabase
      .from("env_vars")
      .select("key, value, target")
      .eq("project_id", project.id);

    const existing = new Set((envRows ?? []).map((e) => String(e.key).toUpperCase()));

    // Build a compact, token-safe view of the codebase for the model.
    const interesting = (fileRows ?? []).filter((f) =>
      /(package\.json|requirements\.txt|\.env(\.example|\.sample)?$|next\.config|vite\.config|docker-compose|Dockerfile|README)/i.test(
        f.path,
      ),
    );
    const sourceSnippets = (fileRows ?? [])
      .filter((f) => /\.(t|j)sx?$|\.py$|\.html$/i.test(f.path))
      .slice(0, 40)
      .map((f) => {
        const hits = String(f.content ?? "")
          .split("\n")
          .filter((l) => /process\.env|import\.meta\.env|os\.environ|getenv|__ENV__/.test(l))
          .slice(0, 12);
        return hits.length ? `# ${f.path}\n${hits.join("\n")}` : "";
      })
      .filter(Boolean);

    const context_text = [
      `Project: ${project.name}`,
      `Framework: ${project.framework}`,
      `Repository: ${project.repository_name}`,
      `Existing variables already configured: ${[...existing].join(", ") || "(none)"}`,
      "",
      ...interesting.slice(0, 12).map((f) => `--- ${f.path} ---\n${String(f.content ?? "").slice(0, 3000)}`),
      "",
      "--- environment usage found in source ---",
      ...sourceSnippets,
    ]
      .join("\n")
      .slice(0, 40_000);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { streamText } = await import("ai");

    const gateway = createLovableAiGatewayProvider(apiKey);

    const result = streamText({
      model: gateway("google/gemini-3.8-flash"),
      system:
        "You are a deployment engineer. Given a project's files, list the environment variables it needs to run in production. " +
        "Reply with STRICT JSON only, no markdown fences, shaped as: " +
        '{"items":[{"key":"UPPER_SNAKE","required":true,"secret":true,"example":"placeholder value, never a real secret","why":"one short sentence"}],"warnings":["short sentence"]}. ' +
        "Include at most 20 items. Flag risky patterns in warnings (secrets exposed with a public VITE_/NEXT_PUBLIC_ prefix, hardcoded keys found in files, missing required variables).",
      prompt: context_text,
    });

    const raw = await result.text;
    const json = raw.replace(/^```(?:json)?|```$/gm, "").trim();

    let parsed: { items?: EnvChecklistItem[]; warnings?: string[] } = {};
    try {
      parsed = JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1));
    } catch {
      throw new Error("The AI response could not be read. Try again.");
    }

    const items: EnvChecklistItem[] = (parsed.items ?? [])
      .filter((i) => i && typeof i.key === "string")
      .slice(0, 20)
      .map((i) => {
        const key = i.key.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        return {
          key,
          required: i.required !== false,
          secret: i.secret === true || RISKY.test(key),
          example: String(i.example ?? "").slice(0, 120) || "changeme",
          why: String(i.why ?? "").slice(0, 200),
          present: existing.has(key),
        };
      });

    const warnings = [...new Set((parsed.warnings ?? []).map((w) => String(w).slice(0, 240)))];

    // Deterministic safety checks on top of the model's findings.
    for (const item of items) {
      if (item.secret && PUBLIC_PREFIX.test(item.key)) {
        warnings.unshift(
          `${item.key} is exposed to the browser by its prefix — never store a real secret in it.`,
        );
      }
      if (item.required && !item.present) {
        warnings.push(`${item.key} is required but not set on this project yet.`);
      }
    }
    for (const env of envRows ?? []) {
      const key = String(env.key).toUpperCase();
      if (RISKY.test(key) && PUBLIC_PREFIX.test(key)) {
        warnings.unshift(`${key} looks like a secret but is published to the browser bundle.`);
      }
    }

    const template = [
      `# ${project.name} — sample environment file`,
      `# Framework: ${project.framework}. Replace every placeholder before deploying.`,
      "",
      ...items.flatMap((i) => [
        `# ${i.why}${i.required ? "" : " (optional)"}${i.secret ? " [secret — keep out of git]" : ""}`,
        `${i.key}=${i.example}`,
        "",
      ]),
    ].join("\n");

    return {
      framework: project.framework,
      items,
      warnings: [...new Set(warnings)].slice(0, 12),
      template,
    };
  });
