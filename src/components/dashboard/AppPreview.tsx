import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEnvVars, useAddEnvVar, useRebuildPreview, useUpdateEnvVar } from "@/lib/queries";
import { ROOT_DOMAIN, type EnvVar, type Project } from "@/lib/egreed";

type DeviceKey = "mobile" | "tablet" | "laptop" | "desktop";

const DEVICES: { key: DeviceKey; label: string; width: number; icon: typeof Monitor }[] = [
  { key: "mobile", label: "375px", width: 375, icon: Smartphone },
  { key: "tablet", label: "768px", width: 768, icon: Tablet },
  { key: "laptop", label: "1280px", width: 1280, icon: Laptop },
  { key: "desktop", label: "Full", width: 0, icon: Monitor },
];

interface PreviewBuild {
  html: string;
  commitHash: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  source: string;
  entryPath: string | null;
  warnings: string[];
  envKeys: string[];
}

export function AppPreview({ project }: { project: Project }) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [showEnv, setShowEnv] = useState(false);
  const [build, setBuild] = useState<PreviewBuild | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const { data: envVars } = useEnvVars(project.id);
  const rebuild = useRebuildPreview();
  const addEnv = useAddEnvVar();
  const updateEnv = useUpdateEnvVar();

  const subdomain = useMemo(
    () => (project.domain ?? "").replace(`.${ROOT_DOMAIN}`, ""),
    [project.domain],
  );
  const liveUrl = project.domain ? `https://${project.domain}` : project.repository_url;
  const active = DEVICES.find((d) => d.key === device)!;

  const previewVars = (envVars ?? []).filter(
    (v) => v.target === "preview" || v.target === "development",
  );
  const productionVars = (envVars ?? []).filter((v) => v.target === "production");

  const run = (extra?: Record<string, string>) =>
    rebuild.mutate(
      {
        projectId: project.id,
        branch: project.branch,
        envOverrides: { ...overrides, ...(extra ?? {}) },
      },
      {
        onSuccess: (res) => {
          setBuild(res as PreviewBuild);
          toast.success(
            `Preview built from ${res.commitHash?.slice(0, 7) ?? "latest commit"}`,
          );
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Could not build the preview"),
      },
    );

  // Build once when the tab first mounts.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Browser chrome */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate font-mono text-xs text-muted-foreground">
              preview://{subdomain || project.name} · {project.branch}
              {build?.commitHash ? ` @ ${build.commitHash.slice(0, 7)}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {DEVICES.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDevice(d.key)}
                title={d.label}
                aria-label={d.label}
                aria-pressed={device === d.key}
                className={
                  "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors " +
                  (device === d.key
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <d.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <Button
            variant={showEnv ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowEnv((s) => !s)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Preview env
            {Object.keys(overrides).length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">
                {Object.keys(overrides).length}
              </span>
            )}
          </Button>

          <Button variant="hero" size="sm" onClick={() => run()} disabled={rebuild.isPending}>
            {rebuild.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Rebuild preview
          </Button>

          <Button asChild variant="outline" size="sm">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>

        {/* Env override panel */}
        {showEnv && (
          <div className="space-y-4 border-b border-border bg-background/50 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Preview environment overrides
                </h4>
                <p className="text-xs text-muted-foreground">
                  Applied to this preview only — production variables are never modified.
                  Values are exposed to the previewed app as{" "}
                  <code className="font-mono">window.__ENV__</code>.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowEnv(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {productionVars.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Production values (read-only) — click to override in preview
                </p>
                <div className="flex flex-wrap gap-2">
                  {productionVars.map((v: EnvVar) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setOverrides((o) => ({ ...o, [v.key]: o[v.key] ?? v.value }))
                      }
                      className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 font-mono text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {previewVars.length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Saved preview variables
                </p>
                <div className="divide-y divide-border">
                  {previewVars.map((v: EnvVar) => (
                    <div key={v.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-40 shrink-0 truncate font-mono text-xs text-foreground">
                        {v.key}
                      </span>
                      <Input
                        defaultValue={v.value}
                        className="h-8 font-mono text-xs"
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [v.key]: e.target.value }))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Save to preview environment"
                        onClick={() =>
                          updateEnv.mutate(
                            {
                              id: v.id,
                              project_id: project.id,
                              value: overrides[v.key] ?? v.value,
                            },
                            {
                              onSuccess: () => toast.success(`${v.key} saved to preview env`),
                              onError: (e: unknown) =>
                                toast.error(e instanceof Error ? e.message : "Save failed"),
                            },
                          )
                        }
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(overrides).length > 0 && (
              <div className="rounded-xl border border-primary/25 bg-primary/5">
                <p className="border-b border-primary/20 px-3 py-2 text-[11px] uppercase tracking-wide text-primary">
                  Session overrides (not saved)
                </p>
                <div className="divide-y divide-border">
                  {Object.entries(overrides).map(([k, val]) => (
                    <div key={k} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-40 shrink-0 truncate font-mono text-xs text-foreground">
                        {k}
                      </span>
                      <Input
                        value={val}
                        className="h-8 font-mono text-xs"
                        onChange={(e) => setOverrides((o) => ({ ...o, [k]: e.target.value }))}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Persist as preview env var"
                        onClick={() =>
                          addEnv.mutate(
                            { project_id: project.id, key: k, value: val, target: "preview" },
                            {
                              onSuccess: () => toast.success(`${k} saved to preview env`),
                              onError: (e: unknown) =>
                                toast.error(e instanceof Error ? e.message : "Save failed"),
                            },
                          )
                        }
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOverrides((o) => {
                            const next = { ...o };
                            delete next[k];
                            return next;
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  placeholder="API_BASE_URL"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <Label className="text-xs">Value</Label>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="https://staging.api.example.com"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!newKey.trim()) return;
                  setOverrides((o) => ({ ...o, [newKey.trim()]: newValue }));
                  setNewKey("");
                  setNewValue("");
                }}
              >
                <Plus className="h-4 w-4" /> Add override
              </Button>
              <Button variant="hero" onClick={() => run()} disabled={rebuild.isPending}>
                {rebuild.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Apply &amp; rebuild
              </Button>
            </div>
          </div>
        )}

        {/* Viewport */}
        <div className="relative flex justify-center bg-background/60 p-4">
          <div
            className="relative w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg transition-all duration-300"
            style={{
              maxWidth: active.width ? `${active.width}px` : "100%",
              height: "620px",
            }}
          >
            {rebuild.isPending && (
              <div className="absolute inset-0 z-10 space-y-4 bg-background p-6">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
            {build ? (
              <iframe
                key={build.commitHash + String(build.envKeys.length) + build.source}
                srcDoc={build.html}
                title={`${project.name} preview`}
                className="h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-forms allow-popups"
              />
            ) : (
              !rebuild.isPending && (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No preview yet — build one from your latest commit.
                  </p>
                  <Button variant="hero" onClick={() => run()}>
                    <RefreshCw className="h-4 w-4" /> Rebuild preview
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="font-mono">
              {project.repository_name}#{project.branch}
            </span>
          </span>
          {build?.commitMessage && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              <span className="truncate">
                {build.commitMessage}
                {build.commitAuthor ? ` · ${build.commitAuthor}` : ""}
              </span>
            </span>
          )}
          <span>
            {build?.entryPath ? (
              <>
                Served from <span className="font-mono text-foreground">{build.entryPath}</span>
              </>
            ) : (
              "Repository content preview"
            )}{" "}
            · <span className="font-mono text-foreground">{active.label}</span>
          </span>
        </div>
      </div>

      {(build?.warnings.length ?? 0) > 0 && (
        <div className="flex gap-3 rounded-2xl border border-accent/30 bg-accent/8 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="space-y-1 text-sm text-muted-foreground">
            {build!.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
