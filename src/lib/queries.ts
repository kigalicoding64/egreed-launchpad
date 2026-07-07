import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildLogsFor,
  subdomainFor,
  slugify,
  frameworkMeta,
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

/* ---------------- GitHub connection ---------------- */

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

export function useConnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const user_id = await currentUserId();
      const { data, error } = await db
        .from("github_connections")
        .insert({
          user_id,
          github_username: username,
          github_user_id: String(Math.floor(Math.random() * 9_000_000) + 1_000_000),
          avatar_url: `https://avatars.githubusercontent.com/${username}`,
          account_type: "user",
          installation_id: String(Math.floor(Math.random() * 90_000_000) + 10_000_000),
        })
        .select()
        .single();
      if (error) throw error;
      return data as GithubConnection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["github-connection"] }),
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("github_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["github-connection"] }),
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

      // Assign domain
      await db.from("domains").insert({
        user_id,
        project_id: p.id,
        subdomain: slugify(input.name) || "app",
        full_domain: domain,
        ssl_status: "active",
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
  return useMutation({
    mutationFn: async (project: Project) => {
      const user_id = await currentUserId();
      const { data, error } = await db
        .from("deployments")
        .insert({
          user_id,
          project_id: project.id,
          commit_hash: Math.random().toString(16).slice(2, 9),
          commit_message: "Redeploy from dashboard",
          branch: project.branch,
          status: "online",
          triggered_by: "manual",
          build_logs: buildLogsFor(project),
          finished_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      await db.from("projects").update({ status: "online" }).eq("id", project.id);
      return data as Deployment;
    },
    onSuccess: (_d, project) => {
      qc.invalidateQueries({ queryKey: ["deployments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
    },
  });
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
