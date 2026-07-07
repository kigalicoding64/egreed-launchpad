import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeployments, useProjects } from "@/lib/queries";
import { DEPLOY_STATUS_META } from "@/lib/egreed";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/deployments")({
  component: DeploymentsPage,
});

function DeploymentsPage() {
  const { data: deployments, isLoading } = useDeployments();
  const { data: projects } = useProjects();

  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? "Project";

  return (
    <div>
      <PageHeader title="Deployments" description="Full history of builds across your projects." />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (deployments ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Rocket className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-foreground">No deployments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Deploy a project to see build history here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border">
            {(deployments ?? []).map((d) => {
              const meta = DEPLOY_STATUS_META[d.status];
              return (
                <Link
                  key={d.id}
                  to="/projects/$id"
                  params={{ id: d.project_id }}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40"
                >
                  <StatusBadge tone={meta.tone} label={meta.label} pulse={d.status === "online"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {projectName(d.project_id)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.commit_message ?? "Deployment"}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-mono text-xs text-foreground">
                      {d.commit_hash?.slice(0, 7) ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.branch}</p>
                  </div>
                  <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
