import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Cpu,
  FileCode2,
  FilePlus2,
  HardDrive,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Server,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AppPreview } from "@/components/dashboard/AppPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useDeleteProjectFile,
  useProject,
  useProjectFiles,
  useSaveProjectFile,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/workspace/$id")({
  component: WorkspacePage,
  head: () => ({
    meta: [
      { title: "Workspace — EGREED Deploy" },
      {
        name: "description",
        content:
          "Edit your project files, watch the live preview and inspect the runtime machine — all before attaching a domain.",
      },
      { property: "og:title", content: "Workspace — EGREED Deploy" },
      {
        property: "og:description",
        content: "In-browser editor, live preview and runtime inspector for your deployment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* ------------------------------ Machine panel ------------------------------ */

type MachineState = "running" | "stopped" | "restarting";

function MachinePanel({ projectName, region }: { projectName: string; region: string }) {
  const [state, setState] = useState<MachineState>("running");
  const [cpu, setCpu] = useState(14);
  const [mem, setMem] = useState(38);
  const [uptime, setUptime] = useState(0);
  const [lines, setLines] = useState<string[]>([
    `egreed@${projectName}:~$ runtime attach`,
    `→ container node:20-alpine · ${region}`,
    "→ workspace mounted at /srv/app",
    "→ dev server listening on :3000",
  ]);
  const [cmd, setCmd] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (state !== "running") return;
      setCpu((c) => Math.max(4, Math.min(92, Math.round(c + (Math.random() * 18 - 9)))));
      setMem((m) => Math.max(18, Math.min(88, Math.round(m + (Math.random() * 8 - 4)))));
      setUptime((u) => u + 2);
    }, 2000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  function push(...l: string[]) {
    setLines((prev) => [...prev, ...l].slice(-120));
  }

  function runCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    push(`egreed@${projectName}:~$ ${input}`);
    const [bin, ...rest] = input.split(/\s+/);
    switch (bin) {
      case "help":
        push("commands: help, status, ls, env, logs, restart, stop, start, clear");
        break;
      case "status":
        push(
          `state: ${state}`,
          `cpu: ${cpu}%  mem: ${mem}%  uptime: ${formatUptime(uptime)}`,
          `region: ${region}`,
        );
        break;
      case "ls":
        push("srv/  app/  node_modules/  package.json");
        break;
      case "env":
        push("NODE_ENV=production", "PORT=3000", "EGREED_REGION=" + region);
        break;
      case "logs":
        push("[info] request GET / 200 12ms", "[info] request GET /assets/app.js 200 3ms");
        break;
      case "restart":
        restart();
        break;
      case "stop":
        stop();
        break;
      case "start":
        start();
        break;
      case "clear":
        setLines([]);
        break;
      default:
        push(`sh: ${bin}: command not found — try "help"`, ...(rest.length ? [] : []));
    }
  }

  function start() {
    setState("running");
    setUptime(0);
    push("→ starting runtime…", "→ dev server listening on :3000");
  }
  function stop() {
    setState("stopped");
    setCpu(0);
    setMem(0);
    push("→ runtime stopped");
  }
  function restart() {
    setState("restarting");
    push("→ restarting runtime…");
    setTimeout(() => {
      setState("running");
      setUptime(0);
      push("→ runtime ready on :3000");
    }, 1200);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Runtime machine</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            state === "running"
              ? "bg-primary/15 text-primary"
              : state === "restarting"
                ? "bg-accent/15 text-accent"
                : "bg-muted text-muted-foreground",
          )}
        >
          {state}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3 text-xs">
        <Meter icon={Cpu} label="CPU" value={`${cpu}%`} pct={cpu} />
        <Meter icon={HardDrive} label="Memory" value={`${mem}%`} pct={mem} />
        <div>
          <p className="text-muted-foreground">Uptime</p>
          <p className="mt-1 font-mono text-foreground">{formatUptime(uptime)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        <Button size="sm" variant="outline" onClick={start} disabled={state === "running"}>
          <Play className="h-3.5 w-3.5" /> Start
        </Button>
        <Button size="sm" variant="outline" onClick={restart}>
          <RotateCcw className="h-3.5 w-3.5" /> Restart
        </Button>
        <Button size="sm" variant="outline" onClick={stop} disabled={state === "stopped"}>
          <Square className="h-3.5 w-3.5" /> Stop
        </Button>
      </div>

      <div className="min-h-[220px] flex-1 overflow-auto bg-secondary/20 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {lines.map((l, i) => (
          <p key={i} className={l.startsWith("egreed@") ? "text-foreground" : undefined}>
            {l}
          </p>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(cmd);
          setCmd("");
        }}
      >
        <span className="font-mono text-xs text-primary">$</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="type a command — try help"
          className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </form>
    </div>
  );
}

function Meter({
  icon: Icon,
  label,
  value,
  pct,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  pct: number;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 font-mono text-foreground">{value}</p>
      <div className="mt-1 h-1 rounded-full bg-secondary">
        <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatUptime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* -------------------------------- Workspace -------------------------------- */

function WorkspacePage() {
  const { id } = useParams({ from: "/_authenticated/workspace/$id" });
  const { data: project, isLoading } = useProject(id);
  const { data: files = [], isLoading: filesLoading } = useProjectFiles(id);
  const save = useSaveProjectFile();
  const remove = useDeleteProjectFile();

  const [activePath, setActivePath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [newPath, setNewPath] = useState("");

  const sorted = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);
  const active = sorted.find((f) => f.path === activePath) ?? null;

  useEffect(() => {
    if (!activePath && sorted.length) {
      setActivePath(sorted[0].path);
      setDraft(sorted[0].content);
    }
  }, [sorted, activePath]);

  const dirty = active ? draft !== active.content : draft.length > 0;

  function open(path: string, content: string) {
    setActivePath(path);
    setDraft(content);
  }

  async function handleSave() {
    if (!activePath) return;
    try {
      await save.mutateAsync({ project_id: id, path: activePath, content: draft, origin: "edit" });
      setReloadToken((t) => t + 1);
      toast.success(`Saved ${activePath}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save file");
    }
  }

  async function handleCreate() {
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path) return;
    try {
      await save.mutateAsync({ project_id: id, path, content: "", origin: "edit" });
      setNewPath("");
      open(path, "");
      toast.success(`Created ${path}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create file");
    }
  }

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  if (!project) {
    return (
      <DashboardShell>
        <div className="py-24 text-center">
          <h1 className="text-lg font-semibold text-foreground">Project not found</h1>
          <Link to="/projects" className="mt-3 inline-block text-sm text-primary">
            Back to projects
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/projects/$id"
            params={{ id }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {project.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Edit files, see the live result and watch the runtime — before any domain is attached.
          </p>
        </div>
        <Button variant="hero" onClick={handleSave} disabled={!activePath || !dirty || save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save &amp; rebuild
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Editor column */}
        <div className="flex flex-col rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <FileCode2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Files</span>
            <span className="text-xs text-muted-foreground">({sorted.length})</span>
          </div>

          <div className="grid grid-cols-[minmax(140px,180px)_minmax(0,1fr)]">
            <div className="max-h-[520px] overflow-auto border-r border-border p-2">
              {filesLoading && (
                <p className="p-2 text-xs text-muted-foreground">Loading files…</p>
              )}
              {!filesLoading && !sorted.length && (
                <p className="p-2 text-xs text-muted-foreground">
                  No stored files yet. Create one below — edits overlay your repository during
                  preview builds.
                </p>
              )}
              {sorted.map((f) => (
                <button
                  key={f.id}
                  onClick={() => open(f.path, f.content)}
                  className={cn(
                    "group flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-xs",
                    f.path === activePath
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <span className="truncate font-mono">{f.path}</span>
                  <Trash2
                    className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove
                        .mutateAsync({ id: f.id, project_id: id })
                        .then(() => {
                          if (f.path === activePath) {
                            setActivePath(null);
                            setDraft("");
                          }
                          setReloadToken((t) => t + 1);
                        })
                        .catch(() => toast.error("Could not delete file"));
                    }}
                  />
                </button>
              ))}

              <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
                <Input
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="index.html"
                  className="h-7 font-mono text-[11px]"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreate}>
                  <FilePlus2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                <span className="truncate font-mono text-foreground">
                  {activePath ?? "no file open"}
                </span>
                {dirty && activePath && <span className="text-accent">unsaved</span>}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                placeholder="Select or create a file to start editing…"
                className="h-[480px] w-full resize-none bg-secondary/20 p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
              />
            </div>
          </div>
        </div>

        {/* Preview + machine column */}
        <div className="space-y-4">
          <AppPreview project={project} reloadToken={reloadToken} />
          <MachinePanel
            projectName={project.name}
            region={project.framework === "static" ? "af-kgl-1" : "af-kgl-1"}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
