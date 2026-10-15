import { useState } from "react";
import { Globe2, Loader2, Plus, RefreshCw, Star, Trash2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/brand/StatusBadge";
import {
  useActivatePlatformDomain,
  useAddPlatformDomain,
  usePlatformDomains,
  useRecheckPlatformDomain,
  useRemovePlatformDomain,
} from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  active: "Ready",
  awaiting_nameservers: "Waiting for nameservers",
  pending: "Needs Cloudflare setup",
};

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

/** Admin panel: choose which domain projects get subdomains under, add or transfer in new ones. */
export function PlatformDomainsAdmin() {
  const { data: rows = [], isLoading } = usePlatformDomains();
  const add = useAddPlatformDomain();
  const recheck = useRecheckPlatformDomain();
  const activate = useActivatePlatformDomain();
  const remove = useRemovePlatformDomain();
  const [value, setValue] = useState("");

  const current = rows.find((r) => r.is_active);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <Globe2 className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Main platform domain (admin)</h2>
          <p className="text-sm text-muted-foreground">
            New projects get addresses like <span className="font-mono">app.{current?.domain ?? "…"}</span>. Add a
            new domain or transfer one in, then make it the main domain.
          </p>
        </div>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            { domain: value },
            {
              onSuccess: (r: { status: string; domain: string }) => {
                setValue("");
                toast.success(r.status === "active" ? `${r.domain} is ready to use` : `${r.domain} added — finish setup below`);
              },
              onError: err,
            },
          );
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="newdomain.com" className="font-mono" />
        <Button type="submit" variant="hero" disabled={!value.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add domain
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground">{r.domain}</span>
                  {r.is_active && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Main</span>
                  )}
                  <StatusBadge tone={r.status === "active" ? "success" : "warning"} label={STATUS_LABEL[r.status] ?? r.status} />
                </div>
                {r.last_error && r.status !== "active" && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.last_error}</p>
                )}
              </div>
              <Button size="sm" variant="outline" disabled={recheck.isPending}
                onClick={() => recheck.mutate({ id: r.id }, { onSuccess: () => toast.success("Re-checked"), onError: err })}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-check
              </Button>
              {!r.is_active && (
                <>
                  <Button size="sm" variant="outline" disabled={r.status !== "active" || activate.isPending}
                    onClick={() => activate.mutate({ id: r.id }, { onSuccess: () => toast.success(`${r.domain} is now the main domain`), onError: err })}>
                    <Star className="h-3.5 w-3.5" /> Make main
                  </Button>
                  <Button size="sm" variant="outline" disabled={r.status !== "active" || activate.isPending}
                    onClick={() => {
                      if (!confirm(`Move every existing project address from ${current?.domain} to ${r.domain}?`)) return;
                      activate.mutate(
                        { id: r.id, migrate: true },
                        { onSuccess: (res: { moved: number }) => toast.success(`Transferred ${res.moved} addresses to ${r.domain}`), onError: err },
                      );
                    }}>
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Make main & move projects
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${r.domain}`}
                    onClick={() => remove.mutate({ id: r.id }, { onSuccess: () => toast.success("Removed"), onError: err })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
