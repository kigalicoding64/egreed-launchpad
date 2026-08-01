import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { triggerDeployment } from "@/lib/deployments.functions";
import { provisionDomain, refreshDomain } from "@/lib/domains.functions";
import {
  buildLogsFor,
  subdomainFor,
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
          branch: input.branch || "main",
          status: "online",
          domain,
          auto_deploy: true,
        })
        .select()
        .single();
      if (error) throw error;
      const p = project as Project;

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
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("egreed-live")
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
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
