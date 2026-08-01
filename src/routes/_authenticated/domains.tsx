import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, ExternalLink, ShieldCheck, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useDomains, useProjects, useRefreshDomain, useSyncEdgeRouting } from "@/lib/queries";
import { SSL_STATUS_META, DNS_STATUS_META, ROOT_DOMAIN } from "@/lib/egreed";


export const Route = createFileRoute("/_authenticated/domains")({
  component: DomainsPage,
});

function DomainsPage() {
  const { data: domains, isLoading } = useDomains();
  const { data: projects } = useProjects();
  const refresh = useRefreshDomain();
  const syncEdge = useSyncEdgeRouting();

  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? "Project";

  return (
    <div>
      <PageHeader
        title="Domains"
        description={`Subdomains assigned under ${ROOT_DOMAIN} with automatic DNS + SSL.`}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Edge routing serves every <span className="font-mono">*.{ROOT_DOMAIN}</span> subdomain
            from the EGREED edge network. Re-sync after changing DNS or the platform origin.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={syncEdge.isPending}
          onClick={() =>
            syncEdge.mutate(undefined, {
              onSuccess: (r: { pattern: string }) => toast.success(`Edge routing synced — ${r.pattern}`),
              onError: (e: unknown) =>
                toast.error(e instanceof Error ? e.message : "Edge routing sync failed"),
            })
          }
        >
          {syncEdge.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Sync edge routing
        </Button>
      </div>


      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (domains ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Globe className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-foreground">No domains yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy a project to get a domain automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[1fr_130px_110px_110px_90px] gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Domain</span>
            <span>Project</span>
            <span>DNS</span>
            <span>SSL</span>
            <span className="text-right">Renew</span>
          </div>
          <div className="divide-y divide-border">
            {(domains ?? []).map((d) => {
              const ssl = SSL_STATUS_META[d.ssl_status];
              const dns = DNS_STATUS_META[d.dns_status];
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_130px_110px_110px_90px] sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-primary" />
                    <a
                      href={`https://${d.full_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-mono text-sm text-foreground hover:text-primary"
                    >
                      {d.full_domain}
                    </a>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <Link
                    to="/projects/$id"
                    params={{ id: d.project_id }}
                    className="truncate text-sm text-muted-foreground hover:text-foreground"
                  >
                    {projectName(d.project_id)}
                  </Link>
                  <StatusBadge tone={dns.tone} label={dns.label} pulse={d.dns_status === "active"} />
                  <StatusBadge tone={ssl.tone} label={ssl.label} pulse={d.ssl_status === "active"} />
                  <div className="sm:text-right">
                    <button
                      onClick={() =>
                        refresh.mutate(d.id, {
                          onSuccess: () => toast.success("DNS re-checked & SSL renewed"),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : "Refresh failed"),
                        })
                      }
                      disabled={refresh.isPending}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Renew SSL"
                    >
                      {refresh.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Custom domains are available on Pro and Team plans. Point your own domain and EGREED
          Deploy provisions SSL automatically.
        </p>
      </div>
    </div>
  );
}
