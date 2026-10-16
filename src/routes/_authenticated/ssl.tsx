import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useDomains,
  useProjects,
  useRefreshDomain,
  useProvisionDomain,
} from "@/lib/queries";
import {
  sslProgress,
  SSL_STATUS_META,
  DNS_STATUS_META,
  type Domain,
} from "@/lib/egreed";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/ssl")({
  component: SslStatusPage,
});

function fmt(date: string | null): string {
  if (!date) return "—";
  try {
    return format(new Date(date), "PP p");
  } catch {
    return "—";
  }
}

function SslStatusPage() {
  const { data: domains, isLoading } = useDomains();
  const { data: projects } = useProjects();
  const refresh = useRefreshDomain();
  const provision = useProvisionDomain();

  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? "Project";

  const list = domains ?? [];
  const active = list.filter((d) => d.ssl_status === "active").length;
  const issuing = list.filter((d) => d.ssl_status === "pending").length;
  const failed = list.filter(
    (d) => d.ssl_status === "failed" || d.dns_status === "failed",
  ).length;

  return (
    <div>
      <PageHeader
        title="SSL Certificates"
        description="Certificate issuance & renewal status for every project domain."
      />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={CheckCircle2}
          tone="success"
          label="Active certificates"
          value={active}
        />
        <SummaryCard icon={Clock} tone="warning" label="Issuing / pending" value={issuing} />
        <SummaryCard icon={AlertTriangle} tone="danger" label="Needs attention" value={failed} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Lock className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-foreground">No certificates yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy a project and its certificate issuance will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((d) => (
            <CertCard
              key={d.id}
              domain={d}
              projectName={projectName(d.project_id)}
              onRetry={() =>
                provision.mutate(d.project_id, {
                  onSuccess: () => toast.success("Re-provisioning DNS & certificate"),
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Provisioning failed"),
                })
              }
              onRenew={() =>
                refresh.mutate(d.id, {
                  onSuccess: () => toast.success("Certificate re-checked & renewed"),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Renewal failed"),
                })
              }
              busy={refresh.isPending || provision.isPending}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Certificates are issued automatically once DNS resolves and renew before expiry. A daily
          job renews any certificate within 30 days of expiring.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  tone: "success" | "warning" | "danger";
  label: string;
  value: number;
}) {
  const toneMap = {
    success: "bg-primary/12 text-primary",
    warning: "bg-accent/12 text-accent",
    danger: "bg-destructive/12 text-destructive",
  } as const;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <span
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-xl",
          toneMap[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CertCard({
  domain,
  projectName,
  onRetry,
  onRenew,
  busy,
}: {
  domain: Domain;
  projectName: string;
  onRetry: () => void;
  onRenew: () => void;
  busy: boolean;
}) {
  const prog = sslProgress(domain);
  const ssl = SSL_STATUS_META[domain.ssl_status];
  const dns = DNS_STATUS_META[domain.dns_status];

  const barColor =
    prog.tone === "success"
      ? "[&>div]:bg-primary"
      : prog.tone === "danger"
        ? "[&>div]:bg-destructive"
        : "[&>div]:bg-accent";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl",
              prog.error
                ? "bg-destructive/12 text-destructive"
                : domain.ssl_status === "active"
                  ? "bg-primary/12 text-primary"
                  : "bg-accent/12 text-accent",
            )}
          >
            {prog.error ? (
              <ShieldAlert className="h-5 w-5" />
            ) : domain.ssl_status === "active" ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </span>
          <div className="min-w-0">
            <a
              href={`https://${domain.full_domain}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm font-medium text-foreground hover:text-primary"
            >
              {domain.full_domain}
            </a>
            <p className="text-xs text-muted-foreground">
              <Link
                to="/projects/$id"
                params={{ id: domain.project_id }}
                className="hover:text-foreground"
              >
                {projectName}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={dns.tone} label={`DNS · ${dns.label}`} />
          <StatusBadge tone={ssl.tone} label={`SSL · ${ssl.label}`} />
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span
            className={cn(
              "font-medium",
              prog.error ? "text-destructive" : "text-foreground",
            )}
          >
            {prog.stage}
          </span>
          <span className="text-muted-foreground">{prog.percent}%</span>
        </div>
        <Progress value={prog.percent} className={cn("h-2", barColor)} />
        <p
          className={cn(
            "mt-2 text-xs",
            prog.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {prog.detail}
        </p>
      </div>

      {/* Meta grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-4">
        <Meta label="Issued" value={fmt(domain.ssl_provisioned_at)} />
        <Meta label="Expires" value={fmt(domain.ssl_expires_at)} />
        <Meta label="Last renewed" value={fmt(domain.ssl_renewed_at)} />
        <Meta label="Last checked" value={fmt(domain.last_checked_at)} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        {prog.error ? (
          <button
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Retry provisioning
          </button>
        ) : (
          <button
            onClick={onRenew}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-check & renew
          </button>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
