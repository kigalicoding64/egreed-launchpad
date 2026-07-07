import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  Rocket,
  Globe,
  Activity,
  ArrowUpRight,
  Plus,
  GitBranch,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProjects,
  useDeployments,
  useDomains,
  useGithubConnection,
  useProfile,
} from "@/lib/queries";
import {
  DEPLOY_STATUS_META,
  PROJECT_STATUS_META,
  frameworkMeta,
} from "@/lib/egreed";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { data: profile } = useProfile();
  const { data: projects, isLoading: pl } = useProjects();
  const { data: deployments } = useDeployments();
  const { data: domains } = useDomains();
  const { data: gh } = useGithubConnection();

  const online = (projects ?? []).filter((p) => p.status === "online").length;
  const firstName = (profile?.name ?? "there").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening across your deployments."
        actions={
          <Button asChild variant="hero">
            <Link to="/deploy">
              <Plus className="h-4 w-4" /> New Deployment
            </Link>
          </Button>
        }
      />

      {!gh && (
        <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-foreground">Connect your GitHub account</p>
              <p className="text-sm text-muted-foreground">
                Authorize the EGREED Deploy GitHub App to import repositories.
              </p>
            </div>
          </div>
          <Button asChild variant="hero" size="sm">
            <Link to="/deploy">Connect GitHub</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Boxes} label="Projects" value={projects?.length ?? 0} loading={pl} />
        <Metric icon={Activity} label="Online" value={online} loading={pl} tone="primary" />
        <Metric icon={Rocket} label="Deployments" value={deployments?.length ?? 0} />
        <Metric icon={Globe} label="Domains" value={domains?.length ?? 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent projects */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-foreground">Recent projects</h2>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {pl ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="mx-5 my-4 h-10" />)
            ) : (projects ?? []).length === 0 ? (
              <EmptyRow text="No projects yet." />
            ) : (
              (projects ?? []).slice(0, 4).map((p) => {
                const fm = frameworkMeta(p.framework);
                const meta = PROJECT_STATUS_META[p.status];
                return (
                  <Link
                    key={p.id}
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/40"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <fm.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {p.domain}
                      </p>
                    </div>
                    <StatusBadge tone={meta.tone} label={meta.label} pulse={p.status === "online"} />
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Recent deployments */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-foreground">Recent deployments</h2>
            <Link to="/deployments" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(deployments ?? []).length === 0 ? (
              <EmptyRow text="No deployments yet." />
            ) : (
              (deployments ?? []).slice(0, 5).map((d) => {
                const meta = DEPLOY_STATUS_META[d.status];
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.commit_hash?.slice(0, 7) ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {d.commit_message ?? "Deployment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.triggered_by} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <Link
          to="/docs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Read the deployment docs <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  loading?: boolean;
  tone?: "primary";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            "inline-flex h-8 w-8 items-center justify-center rounded-lg " +
            (tone === "primary" ? "bg-primary/12 text-primary" : "bg-secondary text-foreground")
          }
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-12" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
