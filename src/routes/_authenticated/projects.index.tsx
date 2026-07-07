import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Boxes, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/lib/queries";
import { PROJECT_STATUS_META, frameworkMeta } from "@/lib/egreed";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div>
      <PageHeader
        title="Projects"
        description="All repositories you've deployed to EGREED Deploy."
        actions={
          <Button asChild variant="hero">
            <Link to="/deploy">
              <Plus className="h-4 w-4" /> New Deployment
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (projects ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Boxes className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-foreground">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Connect GitHub and deploy your first repository to get a live URL.
          </p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/deploy">
              <Plus className="h-4 w-4" /> Deploy a project
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p) => {
            const fm = frameworkMeta(p.framework);
            const meta = PROJECT_STATUS_META[p.status];
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <fm.icon className="h-5 w-5" />
                  </span>
                  <StatusBadge tone={meta.tone} label={meta.label} pulse={p.status === "online"} />
                </div>
                <h3 className="mt-4 truncate text-base font-semibold text-foreground">{p.name}</h3>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {p.repository_name}
                </p>
                <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-4">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate font-mono text-xs text-primary">{p.domain}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fm.label} · updated{" "}
                  {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
