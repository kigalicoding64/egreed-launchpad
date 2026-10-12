import {
  addPlatformDomain,
  activatePlatformDomain,
  recheckPlatformDomain,
  removePlatformDomain,
} from "@/lib/platform-domains.functions";
import { useCallback, useEffect, useId, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { triggerDeployment } from "@/lib/deployments.functions";
import { addDomain, provisionDomain, refreshDomain, syncEdgeRouting } from "@/lib/domains.functions";
import { rebuildPreview } from "@/lib/preview.functions";
import { generateEnvChecklist } from "@/lib/ai.functions";
import {
  buildLogsFor,
  subdomainFor,
  setActiveRootDomain,
  getActiveRootDomain,
  slugify,
  frameworkMeta,
  DNS_TARGET,
  type Deployment,
  type Domain,
  type EnvVar,
  type GithubConnection,
  type Profile,
  type Project,
  type EnvTarget,
} from "@/lib/egreed";

// Cloud types aren't generated for these tables yet; use a loosely typed handle.
// RLS still enforces per-user access on every call.
const db = supabase as unknown as {
  from: (table: string) => any;
  auth: (typeof supabase)["auth"];
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/* ---------------- Profile ---------------- */

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await db.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/* ---------------- GitHub connections (multiple accounts) ---------------- */

export function useGithubConnection() {
  return useQuery({
    queryKey: ["github-connection"],
    queryFn: async (): Promise<GithubConnection | null> => {
      const { data, error } = await db
        .from("github_connections")
        .select("*")
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GithubConnection | null;
    },
  });
}

/** All connected GitHub accounts for the user (no cap — connect as many as needed). */
export function useGithubConnections() {
  return useQuery({
    queryKey: ["github-connections"],
    queryFn: async (): Promise<GithubConnection[]> => {
      const { data, error } = await db
        .from("github_connections")
        .select("*")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GithubConnection[];
    },
  });
}

export function useConnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const user_id = await currentUserId();
      const clean = username.replace(/^@+/, "").trim();

      // Prevent duplicate accounts, but allow any number of distinct accounts.
      const { data: existing } = await db
        .from("github_connections")
        .select("id")
        .eq("user_id", user_id)
        .ilike("github_username", clean)
        .maybeSingle();
      if (existing) throw new Error(`@${clean} is already connected`);

      const { data, error } = await db
        .from("github_connections")
        .insert({
          user_id,
          github_username: clean,
          github_user_id: String(Math.floor(Math.random() * 9_000_000) + 1_000_000),
          avatar_url: `https://avatars.githubusercontent.com/${clean}`,
          account_type: "user",
          installation_id: String(Math.floor(Math.random() * 90_000_000) + 10_000_000),
        })
        .select()
        .single();
      if (error) throw error;
      return data as GithubConnection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["github-connection"] });
      qc.invalidateQueries({ queryKey: ["github-connections"] });
    },
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("github_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["github-connection"] });
      qc.invalidateQueries({ queryKey: ["github-connections"] });
    },
  });
}

/* ---------------- Projects ---------------- */

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await db
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await db.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!id,
  });
}

export interface CreateProjectInput {
  name: string;
  repository_name: string;
  repository_url: string;
  framework: string;
  branch: string;
  build_command?: string | null;
  install_command?: string | null;
  start_command?: string | null;
  output_dir?: string | null;
  /** "github" (default) or "upload" for ZIP/folder uploads. */
  source_type?: "github" | "upload";
  /** Uploaded file contents, keyed by relative path. */
  files?: Record<string, string>;
}


export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const user_id = await currentUserId();
      const domain = subdomainFor(input.name);
      const fm = frameworkMeta(input.framework);

      const { data: project, error } = await db
        .from("projects")
        .insert({
          user_id,
          name: input.name,
          repository_name: input.repository_name,
          repository_url: input.repository_url,
          framework: input.framework,
          build_command: input.build_command ?? fm.buildCommand,
          install_command: input.install_command ?? fm.installCommand,
          start_command: input.start_command ?? fm.startCommand,
          output_dir: input.output_dir ?? fm.outputDir,
          branch: input.branch || "main",
          status: "online",
          domain,
          auto_deploy: true,
        })
        .select()
        .single();
      if (error) throw error;
      const p = project as Project;

      // Assign the project's primary *.egreedtech.org subdomain in a pending
      // state. The deploy flow then provisions the real Cloudflare CNAME and
      // starts DNS propagation monitoring via the provisionDomain server fn.
      await db.from("domains").insert({
        user_id,
        project_id: p.id,
        subdomain: slugify(input.name) || "app",
        full_domain: domain,
        ssl_status: "pending",
        dns_status: "pending",
        dns_type: "CNAME",
        dns_target: DNS_TARGET,
        is_primary: true,
      });

      // Initial deployment record
      await db.from("deployments").insert({
        user_id,
        project_id: p.id,
        commit_hash: Math.random().toString(16).slice(2, 9),
        commit_message: "Initial deployment",
        branch: p.branch,
        status: "online",
        triggered_by: "manual",
        build_logs: buildLogsFor(p),
        finished_at: new Date().toISOString(),
      });

      return p;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

/**
 * Full deploy flow: create the project, then provision its *.egreedtech.org
 * domain (create the Cloudflare CNAME + start DNS propagation monitoring).
 * Domain provisioning failures don't block the deploy — the domain simply
 * stays in a pending/failed state and can be retried from the Domains/SSL page.
 */
export function useDeployProject() {
  const qc = useQueryClient();
  const provision = useServerFn(provisionDomain);
  return useMutation({
    mutationFn: async (
      input: CreateProjectInput,
    ): Promise<{ project: Project; domainProvisioned: boolean }> => {
      const user_id = await currentUserId();
      const domain = subdomainFor(input.name);
      const fm = frameworkMeta(input.framework);

      const { data: project, error } = await db
        .from("projects")
        .insert({
          user_id,
          name: input.name,
          repository_name: input.repository_name,
          repository_url: input.repository_url,
          framework: input.framework,
          build_command: input.build_command ?? fm.buildCommand,
          install_command: input.install_command ?? fm.installCommand,
          start_command: input.start_command ?? fm.startCommand,
          output_dir: input.output_dir ?? fm.outputDir,
          branch: input.branch || "main",
          status: "online",
          domain,
          auto_deploy: true,
          source_type: input.source_type ?? "github",
        })
        .select()
        .single();
      if (error) throw error;
      const p = project as Project;

      // Uploaded sources: persist the files so previews and the workspace
      // editor can serve them straight from the platform.
      const uploaded = Object.entries(input.files ?? {});
      if (uploaded.length) {
        for (let i = 0; i < uploaded.length; i += 100) {
          const chunk = uploaded.slice(i, i + 100).map(([path, content]) => ({
            project_id: p.id,
            user_id,
            path,
            content,
            origin: "upload",
          }));
          const { error: fileError } = await db.from("project_files").insert(chunk);
          if (fileError) throw fileError;
        }
      }



      // Primary subdomain, created in a pending state; provisioned below.
      await db.from("domains").insert({
        user_id,
        project_id: p.id,
        subdomain: slugify(input.name) || "app",
        full_domain: domain,
        ssl_status: "pending",
        dns_status: "pending",
        dns_type: "CNAME",
        dns_target: DNS_TARGET,
        is_primary: true,
      });

      // Initial deployment record.
      await db.from("deployments").insert({
        user_id,
        project_id: p.id,
        commit_hash: Math.random().toString(16).slice(2, 9),
        commit_message: "Initial deployment",
        branch: p.branch,
        status: "online",
        triggered_by: "manual",
        build_logs: buildLogsFor(p),
        finished_at: new Date().toISOString(),
      });

      // Domain provisioning step: create the CNAME + kick off DNS monitoring.
      let domainProvisioned = false;
      try {
        await provision({ data: { projectId: p.id } });
        domainProvisioned = true;
      } catch (err) {
        console.error("[deploy] domain provisioning failed", err);
      }

      return { project: p, domainProvisioned };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Project> }) => {
      const { data, error } = await db
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", p.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

/* ---------------- Deployments ---------------- */

export function useDeployments(projectId?: string) {
  return useQuery({
    queryKey: ["deployments", projectId ?? "all"],
    queryFn: async (): Promise<Deployment[]> => {
      let q = db.from("deployments").select("*").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Deployment[];
    },
  });
}

export function useRedeploy() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerDeployment);
  return useMutation({
    mutationFn: async (project: Project) =>
      trigger({
        data: {
          projectId: project.id,
          commitMessage: "Redeploy from dashboard",
          branch: project.branch,
        },
      }),
    onSuccess: (_d, project) => {
      qc.invalidateQueries({ queryKey: ["deployments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });
}

/** Trigger a brand-new deployment job for a project. */
export function useTriggerDeployment() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerDeployment);
  return useMutation({
    mutationFn: async (input: { projectId: string; commitMessage?: string; branch?: string }) =>
      trigger({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deployments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });
}

/**
 * Subscribe to realtime changes and keep React Query caches fresh, so
 * deployment/domain status updates stream into the UI without polling.
 */
export type RealtimeSyncStatus = "connecting" | "connected" | "failed";

export function useRealtimeSync() {
  const qc = useQueryClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<RealtimeSyncStatus>("connecting");

  const retry = useCallback(() => {
    setStatus("connecting");
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      channel = supabase
        .channel(`egreed-live-${instanceId}-${attempt}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "deployments" },
          () => {
            qc.invalidateQueries({ queryKey: ["deployments"] });
            qc.invalidateQueries({ queryKey: ["projects"] });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "domains" },
          () => qc.invalidateQueries({ queryKey: ["domains"] }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          () => qc.invalidateQueries({ queryKey: ["projects"] }),
        )
        .subscribe((nextStatus) => {
          if (!active) return;
          if (nextStatus === "SUBSCRIBED") {
            setStatus("connected");
            void qc.invalidateQueries({ queryKey: ["deployments"] });
            void qc.invalidateQueries({ queryKey: ["projects"] });
            void qc.invalidateQueries({ queryKey: ["domains"] });
          } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
            setStatus("failed");
          }
        });
    } catch {
      setStatus("failed");
    }

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [attempt, instanceId, qc]);

  return { status, retry };
}

/* ---------------- Domains ---------------- */

export function useDomains(projectId?: string) {
  return useQuery({
    queryKey: ["domains", projectId ?? "all"],
    queryFn: async (): Promise<Domain[]> => {
      let q = db.from("domains").select("*").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Domain[];
    },
  });
}

/** Provision (or re-provision) DNS + SSL for a project's primary domain. */
export function useProvisionDomain() {
  const qc = useQueryClient();
  const fn = useServerFn(provisionDomain);
  return useMutation({
    mutationFn: async (projectId: string) => fn({ data: { projectId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });
}

/** Re-check DNS and renew SSL for a single domain. */
export function useRefreshDomain() {
  const qc = useQueryClient();
  const fn = useServerFn(refreshDomain);
  return useMutation({
    mutationFn: async (domainId: string) => fn({ data: { domainId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });
}

/** True when the signed-in user has the admin role. */
export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return false;
      const { data, error } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    staleTime: 5 * 60_000,
  });
}

/** Admin-only: attach an extra domain (platform subdomain or custom) to a project. */
export function useAddDomain() {
  const qc = useQueryClient();
  const fn = useServerFn(addDomain);
  return useMutation({
    mutationFn: async (input: { projectId: string; domain: string; primary?: boolean }) =>
      fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/* ---------------- Platform domains (admin-managed root domains) ---------------- */

export interface PlatformDomain {
  id: string;
  domain: string;
  zone_id: string | null;
  status: string;
  nameservers: string[];
  is_active: boolean;
  last_error: string | null;
  created_at: string;
}

export function usePlatformDomains() {
  return useQuery({
    queryKey: ["platform-domains"],
    queryFn: async (): Promise<PlatformDomain[]> => {
      const { data, error } = await db.from("platform_domains").select("*").order("created_at");
      if (error) throw error;
      const rows = (data ?? []) as PlatformDomain[];
      setActiveRootDomain(rows.find((r) => r.is_active)?.domain);
      return rows;
    },
    staleTime: 60_000,
  });
}

/** The current main platform domain (e.g. egreedtech.org). */
export function useRootDomain(): string {
  const { data } = usePlatformDomains();
  return data?.find((r) => r.is_active)?.domain ?? getActiveRootDomain();
}

function usePlatformMutation<I>(fn: (args: { data: I }) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => fn({ data: input }) as Promise<any>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-domains"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
export const useAddPlatformDomain = () => usePlatformMutation<{ domain: string }>(useServerFn(addPlatformDomain));
export const useRecheckPlatformDomain = () => usePlatformMutation<{ id: string }>(useServerFn(recheckPlatformDomain));
export const useActivatePlatformDomain = () =>
  usePlatformMutation<{ id: string; migrate?: boolean }>(useServerFn(activatePlatformDomain));
export const useRemovePlatformDomain = () => usePlatformMutation<{ id: string }>(useServerFn(removePlatformDomain));

/* ---------------- Env vars ---------------- */

export function useEnvVars(projectId: string) {
  return useQuery({
    queryKey: ["env-vars", projectId],
    queryFn: async (): Promise<EnvVar[]> => {
      const { data, error } = await db
        .from("env_vars")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EnvVar[];
    },
    enabled: !!projectId,
  });
}

export function useAddEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      key: string;
      value: string;
      target: EnvTarget;
    }) => {
      const user_id = await currentUserId();
      const { data, error } = await db
        .from("env_vars")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw error;
      return data as EnvVar;
    },
    onSuccess: (v) => qc.invalidateQueries({ queryKey: ["env-vars", v.project_id] }),
  });
}

export function useDeleteEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; project_id: string }) => {
      const { error } = await db.from("env_vars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ["env-vars", vars.project_id] }),
  });
}

/** Update an existing environment variable's value/target. */
export function useUpdateEnvVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      project_id: string;
      value?: string;
      target?: EnvTarget;
    }) => {
      const { id, project_id: _p, ...patch } = input;
      const { error } = await db.from("env_vars").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["env-vars", v.project_id] }),
  });
}

/** Roll a project back to a previous deployment's commit. */
export function useRollback() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerDeployment);
  return useMutation({
    mutationFn: async (deployment: Deployment) =>
      trigger({
        data: {
          projectId: deployment.project_id,
          commitHash: deployment.commit_hash ?? undefined,
          commitMessage: `Rollback to ${deployment.commit_hash?.slice(0, 7) ?? "previous"} — ${
            deployment.commit_message ?? "deployment"
          }`,
          branch: deployment.branch,
          triggeredBy: "rollback",
        },
      }),
    onSuccess: (_d, deployment) => {
      qc.invalidateQueries({ queryKey: ["deployments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", deployment.project_id] });
    },
  });
}

/** Deploy/refresh the Cloudflare edge worker serving *.egreedtech.org. */
export function useSyncEdgeRouting() {
  const sync = useServerFn(syncEdgeRouting);
  return useMutation({ mutationFn: async () => sync({ data: undefined as never }) });
}

/** Build a fresh preview from the repository's latest commit. */
export function useRebuildPreview() {
  const qc = useQueryClient();
  const fn = useServerFn(rebuildPreview);
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      branch?: string;
      envOverrides?: Record<string, string>;
      path?: string;
    }) => fn({ data: input }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["deployments", input.projectId] });
      qc.invalidateQueries({ queryKey: ["deployments", "all"] });
    },
  });
}

/* ---------------- Project files (uploads + workspace edits) ---------------- */

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  origin: string;
  updated_at: string;
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["project-files", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectFile[]> => {
      const { data, error } = await db
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("path");
      if (error) throw error;
      return (data ?? []) as ProjectFile[];
    },
  });
}

/** Create or update a file (an overlay edit for repo-backed projects). */
export function useSaveProjectFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      path: string;
      content: string;
      origin?: string;
    }) => {
      const user_id = await currentUserId();
      const { data, error } = await db
        .from("project_files")
        .upsert(
          {
            project_id: input.project_id,
            user_id,
            path: input.path,
            content: input.content,
            origin: input.origin ?? "edit",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,path" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as ProjectFile;
    },
    onSuccess: (_d, input) =>
      qc.invalidateQueries({ queryKey: ["project-files", input.project_id] }),
  });
}

export function useDeleteProjectFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await db.from("project_files").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, input) =>
      qc.invalidateQueries({ queryKey: ["project-files", input.project_id] }),
  });
}

/** Upload a fresh set of files into an existing project. */
export function useUploadProjectFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; files: Record<string, string> }) => {
      const user_id = await currentUserId();
      const entries = Object.entries(input.files);
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100).map(([path, content]) => ({
          project_id: input.project_id,
          user_id,
          path,
          content,
          origin: "upload",
          updated_at: new Date().toISOString(),
        }));
        const { error } = await db
          .from("project_files")
          .upsert(chunk, { onConflict: "project_id,path" });
        if (error) throw error;
      }
      return entries.length;
    },
    onSuccess: (_d, input) =>
      qc.invalidateQueries({ queryKey: ["project-files", input.project_id] }),
  });
}

/* ---------------- AI environment checklist ---------------- */

/** Ask Lovable AI for an env-var checklist + sample .env for a project. */
export function useEnvChecklist() {
  const fn = useServerFn(generateEnvChecklist);
  return useMutation({
    mutationFn: async (projectId: string) => fn({ data: { projectId } }),
  });
}

/** Roll a project back to its latest known-good (online) deployment. */
export function useRollbackToLastGood() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerDeployment);
  return useMutation({
    mutationFn: async (input: { projectId: string; target: Deployment }) =>
      trigger({
        data: {
          projectId: input.projectId,
          commitHash: input.target.commit_hash ?? undefined,
          commitMessage: `Rollback to last known-good build ${
            input.target.commit_hash?.slice(0, 7) ?? ""
          } — ${input.target.commit_message ?? "deployment"}`,
          branch: input.target.branch,
          triggeredBy: "rollback",
        },
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["deployments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", input.projectId] });
    },
  });
}
