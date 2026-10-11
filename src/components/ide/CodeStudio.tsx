import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  ChevronDown,
  ChevronRight,
  Command,
  ExternalLink,
  FileCode2,
  Files,
  Folder,
  FolderOpen,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/egreed";
import { useProjectFiles, useSaveProjectFile } from "@/lib/queries";

/* ------------------------------- helpers ------------------------------- */

let wcPromise: Promise<WebContainer> | null = null;
function bootContainer() {
  if (!wcPromise) wcPromise = WebContainer.boot({ coep: "credentialless" });
  return wcPromise;
}

function toTree(files: Record<string, string>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) node[p] = { file: { contents } };
      else {
        if (!node[p] || !("directory" in node[p])) node[p] = { directory: {} };
        node = (node[p] as { directory: FileSystemTree }).directory;
      }
    });
  }
  return root;
}

const LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript",
  cjs: "javascript", json: "json", css: "css", scss: "scss", html: "html", md: "markdown",
  py: "python", yml: "yaml", yaml: "yaml", sh: "shell", svg: "xml", xml: "xml", vue: "html",
};
const langOf = (p: string) => LANG[p.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";

const TEXT_EXT = /\.(m?[jt]sx?|cjs|json|css|scss|less|html?|md|txt|ya?ml|toml|svg|xml|vue|svelte|astro|py|sh|env\.example|gitignore|lock|npmrc|prettierrc|eslintrc)$|^[^.]+$/i;

function parseGithub(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchRepoFiles(project: Project): Promise<Record<string, string>> {
  const ref = parseGithub(project.repository_url) ??
    (project.repository_name.includes("/")
      ? { owner: project.repository_name.split("/")[0], repo: project.repository_name.split("/")[1] }
      : null);
  if (!ref) return {};
  const branch = project.branch || "main";
  const res = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  if (!res.ok)
    throw new Error(
      `Couldn't read ${ref.owner}/${ref.repo}@${branch} from GitHub. Make sure the repository is public and the branch exists.`,
    );
  const data = (await res.json()) as { tree: { path: string; type: string; size?: number }[] };
  const blobs = data.tree
    .filter(
      (t) =>
        t.type === "blob" &&
        (t.size ?? 0) < 300_000 &&
        !/(^|\/)(node_modules|dist|build|\.next|\.git)\//.test(t.path) &&
        !/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/.test(t.path) &&
        TEXT_EXT.test(t.path.split("/").pop() ?? ""),
    )
    .slice(0, 400);
  const out: Record<string, string> = {};
  const queue = [...blobs];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const b = queue.shift()!;
        const r = await fetch(
          `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(branch)}/${b.path}`,
        );
        if (r.ok) out[b.path] = await r.text();
      }
    }),
  );
  return out;
}

/* ------------------------------ file tree ------------------------------ */

type TreeNode = { name: string; path: string; children?: Map<string, TreeNode> };
function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const p of paths) {
    let node = root;
    const parts = p.split("/");
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      if (!node.children!.has(part))
        node.children!.set(part, { name: part, path, children: i < parts.length - 1 ? new Map() : undefined });
      node = node.children!.get(part)!;
    });
  }
  return root;
}

function TreeView({
  node, depth, open, toggle, active, onOpen,
}: {
  node: TreeNode; depth: number; open: Set<string>; toggle: (p: string) => void;
  active: string | null; onOpen: (p: string) => void;
}) {
  const kids = [...(node.children?.values() ?? [])].sort((a, b) =>
    !!a.children === !!b.children ? a.name.localeCompare(b.name) : a.children ? -1 : 1,
  );
  return (
    <>
      {kids.map((k) => {
        const isDir = !!k.children;
        const isOpen = open.has(k.path);
        return (
          <div key={k.path}>
            <button
              onClick={() => (isDir ? toggle(k.path) : onOpen(k.path))}
              style={{ paddingLeft: 6 + depth * 12 }}
              className={cn(
                "flex w-full items-center gap-1 py-[3px] pr-2 text-left text-xs",
                k.path === active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {isDir ? (
                <>
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-accent" /> : <Folder className="h-3.5 w-3.5 text-accent" />}
                </>
              ) : (
                <FileCode2 className="ml-4 h-3.5 w-3.5 text-primary/80" />
              )}
              <span className="truncate">{k.name}</span>
            </button>
            {isDir && isOpen && (
              <TreeView node={k} depth={depth + 1} open={open} toggle={toggle} active={active} onOpen={onOpen} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------ component ------------------------------ */

type Phase = "loading" | "booting" | "ready" | "error";

export default function CodeStudio({ project }: { project: Project }) {
  const { data: stored = [], isLoading } = useProjectFiles(project.id);
  const save = useSaveProjectFile();

  const [files, setFiles] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<"files" | "search">("files");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [palette, setPalette] = useState<null | "commands" | "files">(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });

  const termEl = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const wcRef = useRef<WebContainer | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const isolated = typeof window !== "undefined" && window.crossOriginIsolated;

  // 1. Load source files (repo + stored overlay)
  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const base = project.source_type === "upload" ? {} : await fetchRepoFiles(project);
        const merged = { ...base };
        for (const f of stored) merged[f.path] = f.content;
        if (cancelled) return;
        setFiles(merged);
        setSaved(merged);
        const first = ["package.json", "index.html", "README.md"].find((p) => p in merged) ?? Object.keys(merged)[0];
        if (first) { setTabs([first]); setActive(first); }
        setPhase("booting");
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, project.id]);

  // 2. Terminal + runtime
  useEffect(() => {
    if (phase !== "booting" || !termEl.current) return;
    const term = new Terminal({
      convertEol: true, fontSize: 12, cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: { background: "#0b0f0e", foreground: "#d6e4df", cursor: "#34d399" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termEl.current);
    fit.fit();
    termRef.current = term;
    const ro = new ResizeObserver(() => { try { fit.fit(); } catch { /* noop */ } });
    ro.observe(termEl.current);

    if (!window.crossOriginIsolated) {
      term.writeln("\x1b[33mThe runtime needs its own browser tab to start.\x1b[0m");
      term.writeln("Click \"Open in new tab\" above to run commands like npm install, cd, ls.");
      setPhase("ready");
      return () => { ro.disconnect(); term.dispose(); };
    }

    let disposed = false;
    (async () => {
      try {
        term.writeln("\x1b[32m→ booting EGREED runtime (Node in your browser)…\x1b[0m");
        const wc = await bootContainer();
        if (disposed) return;
        wcRef.current = wc;
        await wc.mount(toTree(filesRef.current));
        wc.on("server-ready", (p, url) => { setPort(p); setServerUrl(url); });
        const shell = await wc.spawn("jsh", { terminal: { cols: term.cols, rows: term.rows } });
        shell.output.pipeTo(new WritableStream({ write: (d) => term.write(d) }));
        const writer = shell.input.getWriter();
        writerRef.current = writer;
        term.onData((d) => writer.write(d));
        term.onResize(({ cols, rows }) => shell.resize({ cols, rows }));
        setPhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => { disposed = true; ro.disconnect(); term.dispose(); };
  }, [phase === "booting"]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback((cmd: string) => {
    if (!writerRef.current) { toast.error("Open Code Studio in its own tab to use the runtime."); return; }
    writerRef.current.write(cmd + "\n");
  }, []);

  const runApp = useCallback(() => {
    const pkg = filesRef.current["package.json"];
    if (!pkg) { run("npx --yes serve -l 3000 ."); return; }
    const install = project.install_command || "npm install";
    let start = project.start_command || "";
    if (!start) {
      try {
        const scripts = JSON.parse(pkg).scripts ?? {};
        start = scripts.dev ? "npm run dev" : scripts.start ? "npm start" : "npm run build";
      } catch { start = "npm run dev"; }
    }
    run(`${install} && ${start}`);
  }, [project.install_command, project.start_command, run]);

  const openFile = useCallback((p: string) => {
    setTabs((t) => (t.includes(p) ? t : [...t, p]));
    setActive(p);
    setPalette(null);
    const parts = p.split("/");
    setOpenDirs((s) => { const n = new Set(s); parts.slice(0, -1).forEach((_, i) => n.add(parts.slice(0, i + 1).join("/"))); return n; });
  }, []);

  const closeTab = (p: string) => {
    setTabs((t) => {
      const next = t.filter((x) => x !== p);
      if (active === p) setActive(next[next.length - 1] ?? null);
      return next;
    });
  };

  const onChange = (value?: string) => {
    if (!active) return;
    const v = value ?? "";
    setFiles((f) => ({ ...f, [active]: v }));
    void wcRef.current?.fs.writeFile(active, v).catch(() => undefined);
  };

  const saveFile = useCallback(async (p = active) => {
    if (!p) return;
    try {
      await save.mutateAsync({ project_id: project.id, path: p, content: filesRef.current[p] ?? "", origin: "edit" });
      setSaved((s) => ({ ...s, [p]: filesRef.current[p] }));
      toast.success(`Saved ${p}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  }, [active, project.id, save]);

  const saveAll = useCallback(async () => {
    const dirty = Object.keys(filesRef.current).filter((p) => filesRef.current[p] !== saved[p]);
    for (const p of dirty) await saveFile(p);
    if (!dirty.length) toast("Nothing to save");
  }, [saved, saveFile]);

  const newFile = useCallback(() => {
    const p = window.prompt("New file path", "src/new-file.ts")?.trim().replace(/^\/+/, "");
    if (!p) return;
    setFiles((f) => ({ ...f, [p]: f[p] ?? "" }));
    const dir = p.split("/").slice(0, -1).join("/");
    void (async () => {
      if (dir) await wcRef.current?.fs.mkdir(dir, { recursive: true }).catch(() => undefined);
      await wcRef.current?.fs.writeFile(p, "").catch(() => undefined);
    })();
    openFile(p);
  }, [openFile]);

  const commands = useMemo(
    () => [
      { label: "Run app (install + start)", run: runApp },
      { label: "Install dependencies", run: () => run(project.install_command || "npm install") },
      { label: "Build project", run: () => run(project.build_command || "npm run build") },
      { label: "Save current file", run: () => saveFile() },
      { label: "Save all files", run: saveAll },
      { label: "New file…", run: newFile },
      { label: "Go to file…", run: () => { setPalette("files"); setPaletteQuery(""); } },
      { label: "Search in files", run: () => setSide("search") },
      { label: "Clear terminal", run: () => termRef.current?.clear() },
      { label: "Stop running process (Ctrl+C)", run: () => writerRef.current?.write("\x03") },
    ],
    [runApp, run, project.install_command, project.build_command, saveFile, saveAll, newFile],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); setPalette("commands"); setPaletteQuery(""); }
      else if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); setPalette("files"); setPaletteQuery(""); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void saveFile(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setSide("search"); }
      else if (e.key === "Escape") setPalette(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveFile]);

  const onMount: OnMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveFile());
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX, allowJs: true, target: monaco.languages.typescript.ScriptTarget.ESNext,
    });
  };

  const paths = useMemo(() => Object.keys(files).sort(), [files]);
  const tree = useMemo(() => buildTree(paths), [paths]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { path: string; line: number; text: string }[] = [];
    for (const p of paths) {
      files[p].split("\n").forEach((l, i) => {
        if (out.length < 200 && l.toLowerCase().includes(q)) out.push({ path: p, line: i + 1, text: l.trim().slice(0, 120) });
      });
    }
    return out;
  }, [query, files, paths]);

  const paletteItems = palette === "commands"
    ? commands.filter((c) => c.label.toLowerCase().includes(paletteQuery.toLowerCase()))
    : paths.filter((p) => p.toLowerCase().includes(paletteQuery.toLowerCase())).slice(0, 50)
        .map((p) => ({ label: p, run: () => openFile(p) }));

  const dirtyCount = paths.filter((p) => files[p] !== saved[p]).length;

  if (phase === "loading")
    return (
      <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading project files…
      </div>
    );

  return (
    <div className="relative flex h-[calc(100vh-11rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-3 py-1.5">
        <span className="text-xs font-medium text-foreground">{project.name}</span>
        <button
          onClick={() => { setPalette("commands"); setPaletteQuery(""); }}
          className="mx-auto flex w-full max-w-md items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Command className="h-3 w-3" /> Search files & commands
          <span className="ml-auto font-mono text-[10px]">Ctrl+Shift+P</span>
        </button>
        {!isolated && (
          <Button size="sm" variant="outline" className="h-7" onClick={() => window.open(window.location.href, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7" onClick={saveAll} disabled={!dirtyCount}>
          <Save className="h-3.5 w-3.5" /> Save{dirtyCount ? ` (${dirtyCount})` : ""}
        </Button>
        <Button size="sm" variant="hero" className="h-7" onClick={runApp} disabled={!isolated || phase !== "ready"}>
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <div className="flex w-11 flex-col items-center gap-1 border-r border-border bg-secondary/20 py-2">
          {([["files", Files], ["search", Search]] as const).map(([k, Icon]) => (
            <button
              key={k}
              onClick={() => setSide(k)}
              className={cn("rounded-md p-2", side === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
              aria-label={k}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Side panel */}
        <div className="flex w-56 shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {side === "files" ? "Explorer" : "Search"}
            {side === "files" && (
              <button onClick={newFile} className="hover:text-foreground" aria-label="New file">+ file</button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto pb-2">
            {side === "files" ? (
              paths.length ? (
                <TreeView
                  node={tree} depth={0} open={openDirs} active={active} onOpen={openFile}
                  toggle={(p) => setOpenDirs((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; })}
                />
              ) : (
                <p className="px-3 text-xs text-muted-foreground">No files yet. Create one with “+ file”.</p>
              )
            ) : (
              <div className="px-2">
                <input
                  autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in all files"
                  className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                {query.length >= 2 && <p className="mb-1 text-[10px] text-muted-foreground">{results.length} results</p>}
                {results.map((r, i) => (
                  <button key={i} onClick={() => openFile(r.path)} className="block w-full rounded px-1 py-1 text-left hover:bg-secondary/60">
                    <p className="truncate font-mono text-[10px] text-primary">{r.path}:{r.line}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{r.text}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor + terminal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex overflow-x-auto border-b border-border bg-secondary/20">
            {tabs.map((t) => (
              <div
                key={t}
                className={cn(
                  "group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs",
                  t === active ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setActive(t)}
              >
                <span className="font-mono">{t.split("/").pop()}</span>
                {files[t] !== saved[t] && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                <button onClick={(e) => { e.stopPropagation(); closeTab(t); }} className="opacity-50 hover:opacity-100" aria-label={`Close ${t}`}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {active ? (
              <Editor
                path={active}
                language={langOf(active)}
                value={files[active] ?? ""}
                onChange={onChange}
                onMount={onMount}
                theme="vs-dark"
                options={{ fontSize: 13, minimap: { enabled: true }, automaticLayout: true, scrollBeyondLastLine: false }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Open a file from the Explorer or press Ctrl+P
              </div>
            )}
          </div>
          <div className="flex h-56 shrink-0 flex-col border-t border-border">
            <div className="flex items-center gap-3 border-b border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="text-foreground">Terminal</span>
              <button onClick={() => writerRef.current?.write("\x03")} className="hover:text-foreground">Stop</button>
              <button onClick={() => termRef.current?.clear()} className="hover:text-foreground">Clear</button>
            </div>
            <div ref={termEl} className="min-h-0 flex-1 bg-background p-1" />
          </div>
        </div>

        {/* Preview */}
        <div className="hidden w-[38%] min-w-[280px] flex-col border-l border-border lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
            <span className="font-medium text-foreground">Preview</span>
            <span className="truncate font-mono text-muted-foreground">{serverUrl ?? "not running"}</span>
            {serverUrl && (
              <>
                <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Reload"
                  onClick={() => setServerUrl((u) => (u ? u.split("#")[0] + "#" + Date.now() : u))}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <a href={serverUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
          {serverUrl ? (
            <iframe src={serverUrl} title="App preview" className="min-h-0 flex-1 bg-background" />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              {phase === "error" ? (
                <p className="text-destructive">{error}</p>
              ) : (
                <>
                  <p>Press <span className="text-primary">Run</span> or type <span className="font-mono">npm run dev</span> in the terminal.</p>
                  <p>Your app appears here as soon as it starts listening.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 border-t border-border bg-primary/15 px-3 py-0.5 text-[11px] text-foreground">
        <span>⎇ {project.branch || "main"}</span>
        <span>
          {phase === "ready" && isolated ? "● Runtime ready" : phase === "error" ? "● Runtime error" : !isolated ? "○ Runtime needs own tab" : "◌ Booting…"}
        </span>
        {port && <span>Port {port}</span>}
        <span className="ml-auto">{active ? `Ln ${cursor.line}, Col ${cursor.col} · ${langOf(active)}` : ""}</span>
        <span>{paths.length} files</span>
      </div>

      {/* Command palette */}
      {palette && (
        <div className="absolute inset-0 z-20 flex justify-center bg-background/50 pt-16" onClick={() => setPalette(null)}>
          <div className="h-fit w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && paletteItems[0]) { setPalette(null); paletteItems[0].run(); } }}
              placeholder={palette === "commands" ? "> Type a command" : "Go to file…"}
              className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none"
            />
            <div className="max-h-72 overflow-auto py-1">
              {paletteItems.map((c) => (
                <button key={c.label} onClick={() => { setPalette(null); c.run(); }}
                  className="block w-full truncate px-3 py-1.5 text-left text-xs text-foreground hover:bg-primary/15">
                  {c.label}
                </button>
              ))}
              {!paletteItems.length && <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
