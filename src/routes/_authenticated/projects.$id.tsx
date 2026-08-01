import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Copy,
  Rocket,
  Terminal,
} from "lucide-react";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useProject,
  useDeployments,
  useDomains,
  useEnvVars,
  useRedeploy,
  useDeleteProject,
  useUpdateProject,
  useAddEnvVar,
  useDeleteEnvVar,
  useProvisionDomain,
  useRefreshDomain,
} from "@/lib/queries";
import {
  PROJECT_STATUS_META,
  DEPLOY_STATUS_META,
  SSL_STATUS_META,
  DNS_STATUS_META,
  DNS_TARGET,
  frameworkMeta,
  buildLogsFor,
  type EnvTarget,
  type Deployment,
} from "@/lib/egreed";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const redeploy = useRedeploy();
  const del = useDeleteProject();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground">Project not found</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const fm = frameworkMeta(project.framework);
  const meta = PROJECT_STATUS_META[project.status];

  return (
    <div>
      <Link
        to="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
            <fm.icon className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
              <StatusBadge tone={meta.tone} label={meta.label} pulse={project.status === "online"} />
            </div>
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
            >
              {project.domain} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              redeploy.mutate(project, {
                onSuccess: () => toast.success("Redeploy triggered"),
                onError: (e) => toast.error(e instanceof Error ? e.message : "Redeploy failed"),
              })
            }
            disabled={redeploy.isPending}
          >
            {redeploy.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Redeploy
          </Button>
          <Button asChild variant="hero">
            <a href={`https://${project.domain}`} target="_blank" rel="noreferrer">
              Visit <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="domain">Domain</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab project={project} />
        </TabsContent>
        <TabsContent value="deployments" className="mt-6">
          <DeploymentsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsTab projectId={project.id} fallback={buildLogsFor(project)} />
        </TabsContent>
        <TabsContent value="env" className="mt-6">
          <EnvTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="domain" className="mt-6">
          <DomainTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab
            project={project}
            onDeleted={() => {
              toast.success("Project deleted");
              navigate({ to: "/projects" });
            }}
            del={del}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Overview ---------- */
function OverviewTab({ project }: { project: ReturnType<typeof useProject>["data"] & {} }) {
  const fm = frameworkMeta(project.framework);
  const rows = [
    { label: "Repository", value: project.repository_name, mono: true },
    { label: "Framework", value: fm.label },
    { label: "Branch", value: project.branch, mono: true },
    { label: "Build command", value: project.build_command || fm.buildCommand, mono: true },
    { label: "Domain", value: project.domain ?? "—", mono: true },
    { label: "Created", value: format(new Date(project.created_at), "PPP") },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold text-foreground">Project details</h3>
        </div>
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd
                className={
                  "truncate text-sm text-foreground " + (r.mono ? "font-mono text-xs" : "")
                }
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl border border-primary/25 bg-primary/8 p-5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Rocket className="h-5 w-5" />
        </span>
        <h3 className="mt-4 font-semibold text-foreground">Continuous deployment</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {project.auto_deploy
            ? "Every push to your branch triggers a new build automatically."
            : "Auto-deploy is off. Redeploy manually from this page."}
        </p>
      </div>
    </div>
  );
}

/* ---------- Deployments ---------- */
function DeploymentsTab({ projectId }: { projectId: string }) {
  const { data: deployments, isLoading } = useDeployments(projectId);
  const rollback = useRollback();
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if ((deployments ?? []).length === 0)
    return <EmptyCard icon={Rocket} text="No deployments yet." />;

  const current = deployments?.[0]?.id;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
      {(deployments ?? []).map((d) => {
        const meta = DEPLOY_STATUS_META[d.status];
        const inProgress = d.status === "building" || d.status === "deploying";
        const canRollback = d.id !== current && d.status === "online";
        return (
          <div key={d.id} className="px-5 py-4">
            <div className="flex items-center gap-4">
              <StatusBadge tone={meta.tone} label={meta.label} pulse={d.status === "online"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {d.commit_message ?? "Deployment"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.triggered_by} · {d.branch}
                  {d.github_event ? ` · ${d.github_event}` : ""}
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {d.commit_hash?.slice(0, 7)}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">
                {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
              </span>
              {d.id === current ? (
                <StatusBadge tone="info" label="Current" />
              ) : canRollback ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rollback.isPending}
                  onClick={() => {
                    setRollingBack(d.id);
                    rollback.mutate(d, {
                      onSuccess: () => toast.success("Rollback deployment started"),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Rollback failed"),
                      onSettled: () => setRollingBack(null),
                    });
                  }}
                >
                  {rollingBack === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <History className="h-3.5 w-3.5" />
                  )}
                  Rollback
                </Button>
              ) : null}
            </div>
            {inProgress && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${d.progress ?? 0}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                  {d.progress ?? 0}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Logs ---------- */
function LogsTab({ projectId, fallback }: { projectId: string; fallback: string }) {
  const { data: deployments } = useDeployments(projectId);
  const latest: Deployment | undefined = deployments?.[0];
  const logs = latest?.build_logs || fallback;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs text-muted-foreground">
          build logs · {latest?.commit_hash?.slice(0, 7) ?? "latest"}
        </span>
      </div>
      <pre className="max-h-[480px] overflow-auto bg-background/60 p-5 font-mono text-xs leading-relaxed text-foreground/90">
        {logs.split("\n").map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith("✓")
                ? "text-primary"
                : line.startsWith(">")
                  ? "text-foreground"
                  : "text-muted-foreground"
            }
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ---------- Env ---------- */
function EnvTab({ projectId }: { projectId: string }) {
  const { data: vars, isLoading } = useEnvVars(projectId);
  const add = useAddEnvVar();
  const remove = useDeleteEnvVar();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState<EnvTarget>("production");

  async function handleAdd() {
    if (!key.trim() || !value.trim()) return;
    try {
      await add.mutateAsync({ project_id: projectId, key: key.trim(), value, target });
      setKey("");
      setValue("");
      toast.success("Variable added");
    } catch {
      toast.error("Failed to add variable");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground">Add environment variable</h3>
        <p className="text-sm text-muted-foreground">
          Values like DATABASE_URL, OPENAI_API_KEY or SECRET_KEYS.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="k">Key</Label>
            <Input
              id="k"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="OPENAI_API_KEY"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v">Value</Label>
            <Input
              id="v"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-…"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as EnvTarget)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="hero" onClick={handleAdd} disabled={add.isPending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <Skeleton className="m-5 h-10" />
        ) : (vars ?? []).length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No environment variables yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {(vars ?? []).map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="font-mono text-sm font-medium text-foreground">{v.key}</span>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                  {"•".repeat(Math.min(v.value.length, 16))}
                </span>
                <StatusBadge tone="muted" label={v.target} />
                <button
                  onClick={() =>
                    remove.mutate(
                      { id: v.id, project_id: projectId },
                      { onSuccess: () => toast.success("Removed") },
                    )
                  }
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Delete variable"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Domain ---------- */
function DomainTab({ projectId }: { projectId: string }) {
  const { data: domains, isLoading } = useDomains(projectId);
  const provision = useProvisionDomain();
  const refresh = useRefreshDomain();
  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/40 p-4">
        <p className="text-sm text-muted-foreground">
          DNS records are created on Cloudflare and SSL is provisioned automatically.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            provision.mutate(projectId, {
              onSuccess: () => toast.success("DNS + SSL provisioning triggered"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Provisioning failed"),
            })
          }
          disabled={provision.isPending}
        >
          {provision.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Provision DNS + SSL
        </Button>
      </div>

      {(domains ?? []).map((d) => {
        const ssl = SSL_STATUS_META[d.ssl_status];
        const dns = DNS_STATUS_META[d.dns_status];
        return (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={`https://${d.full_domain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-sm text-foreground hover:text-primary"
              >
                {d.full_domain} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="flex items-center gap-2">
                {d.is_primary && <StatusBadge tone="info" label="Primary" />}
                <StatusBadge tone={dns.tone} label={`DNS ${dns.label}`} pulse={d.dns_status === "active"} />
                <StatusBadge tone={ssl.tone} label={`SSL ${ssl.label}`} pulse={d.ssl_status === "active"} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-background/50 p-4 font-mono text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="text-foreground/60">Type</p>
                <p className="text-foreground">{d.dns_type || "CNAME"}</p>
              </div>
              <div>
                <p className="text-foreground/60">Name</p>
                <p className="text-foreground">{d.subdomain}</p>
              </div>
              <div>
                <p className="text-foreground/60">Target</p>
                <p className="text-foreground">{d.dns_target ?? DNS_TARGET}</p>
              </div>
            </div>
            {(d.ssl_provisioned_at || d.ssl_expires_at) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {d.ssl_provisioned_at
                  ? `SSL issued ${format(new Date(d.ssl_provisioned_at), "MMM d, yyyy")}`
                  : ""}
                {d.ssl_expires_at
                  ? ` · renews ${format(new Date(d.ssl_expires_at), "MMM d, yyyy")}`
                  : ""}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(d.full_domain);
                  toast.success("Domain copied");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Copy className="h-3 w-3" /> Copy domain
              </button>
              <button
                onClick={() =>
                  refresh.mutate(d.id, {
                    onSuccess: () => toast.success("DNS re-checked & SSL renewed"),
                    onError: (e) =>
                      toast.error(e instanceof Error ? e.message : "Refresh failed"),
                  })
                }
                disabled={refresh.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" /> Re-check DNS & renew SSL
              </button>
            </div>
          </div>
        );
      })}
      {(domains ?? []).length === 0 && <EmptyCard icon={ExternalLink} text="No domain assigned." />}
    </div>
  );
}


/* ---------- Settings ---------- */
function SettingsTab({
  project,
  onDeleted,
  del,
}: {
  project: ReturnType<typeof useProject>["data"] & {};
  onDeleted: () => void;
  del: ReturnType<typeof useDeleteProject>;
}) {
  const update = useUpdateProject();
  const [name, setName] = useState(project.name);
  const [branch, setBranch] = useState(project.branch);
  const [autoDeploy, setAutoDeploy] = useState(project.auto_deploy);

  const dirty =
    name !== project.name || branch !== project.branch || autoDeploy !== project.auto_deploy;

  async function save() {
    try {
      await update.mutateAsync({
        id: project.id,
        patch: { name, branch, auto_deploy: autoDeploy },
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground">General</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sname">Project name</Label>
            <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sbranch">Production branch</Label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sbranch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-deploy on push</p>
              <p className="text-xs text-muted-foreground">
                Trigger a build whenever the branch updates.
              </p>
            </div>
            <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
          </div>
          <Button variant="hero" onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="font-semibold text-foreground">Danger zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleting a project removes its deployments, domain and environment variables.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              <Trash2 className="h-4 w-4" /> Delete project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All associated data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => del.mutate(project.id, { onSuccess: onDeleted })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function EmptyCard({ icon: Icon, text }: { icon: typeof Rocket; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
