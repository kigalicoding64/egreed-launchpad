import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  GitBranch,
  Github,
  Lock,
  Star,
  Search,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  Link2 as LinkIcon,
  UploadCloud,
  FolderUp,
  Terminal,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { toast } from "sonner";
import {
  useGithubConnection,
  useConnectGithub,
  useDeployProject,
  useRootDomain,
} from "@/lib/queries";
import {
  SAMPLE_REPOS,
  FRAMEWORKS,
  frameworkMeta,
  subdomainFor,
  slugify,
  detectBuildPlan,
  buildPlanFor,
  type BuildPlan,
  type SampleRepo,
} from "@/lib/egreed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deploy")({
  component: DeployWizard,
});

type Step = 0 | 1 | 2;

function DeployWizard() {
  const rootDomain = useRootDomain();
  const navigate = useNavigate();
  const { data: gh, isLoading } = useGithubConnection();
  const connect = useConnectGithub();
  const deploy = useDeployProject();

  const [step, setStep] = useState<Step>(0);
  const [ghUser, setGhUser] = useState("");
  const [search, setSearch] = useState("");
  const [repo, setRepo] = useState<SampleRepo | null>(null);
  const [sourceMode, setSourceMode] = useState<"connected" | "url" | "upload">("connected");
  const [repoUrl, setRepoUrl] = useState("");
  const [upload, setUpload] = useState<{ files: Record<string, string>; skipped: string[] } | null>(
    null,
  );
  const [parsing, setParsing] = useState(false);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // configure state
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("static");
  const [branch, setBranch] = useState("main");
  const [buildCmd, setBuildCmd] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [startCmd, setStartCmd] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [overriding, setOverriding] = useState(false);

  function applyPlan(plan: BuildPlan) {
    setFramework(plan.framework);
    setBuildCmd(plan.buildCommand);
    setInstallCmd(plan.installCommand);
    setStartCmd(plan.startCommand);
    setOutputDir(plan.outputDir);
    setPlanNotes(plan.notes);
    setOverriding(false);
  }

  const isUpload = sourceMode === "upload";
  const effectiveStep: Step = (gh || isUpload) && step === 0 ? 1 : step;

  async function handleConnect() {
    if (!ghUser.trim()) return;
    try {
      await connect.mutateAsync(ghUser.trim());
      toast.success("GitHub connected");
      setStep(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    }
  }

  function pickRepo(r: SampleRepo) {
    setRepo(r);
    setUpload(null);
    setName(r.name);
    applyPlan(detectBuildPlan(undefined, r.framework));
    setStep(2);
  }

  function useRepoUrl() {
    const m = repoUrl.trim().match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
    if (!m) {
      toast.error("Enter a full GitHub repository URL, e.g. https://github.com/owner/repo");
      return;
    }
    pickRepo({
      name: m[2],
      fullName: `${m[1]}/${m[2]}`,
      description: "Public repository added by URL",
      framework: "static",
      language: "—",
      private: false,
      updated: "just now",
      stars: 0,
    });
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setParsing(true);
    try {
      const { parseUpload, detectFramework } = await import("@/lib/upload");
      const parsed = await parseUpload(list);
      const count = Object.keys(parsed.files).length;
      if (!count) {
        toast.error("No readable project files found in that upload.");
        return;
      }
      const guessed = detectFramework(parsed.files);
      setUpload({ files: parsed.files, skipped: parsed.skipped });
      setRepo(null);
      const first = list[0] as File & { webkitRelativePath?: string };
      const guessName =
        (first.webkitRelativePath || "").split("/")[0] ||
        first.name.replace(/\.zip$/i, "") ||
        "uploaded-app";
      setName(guessName);
      applyPlan(detectBuildPlan(parsed.files, guessed));
      toast.success(`${count} files ready to deploy`);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that upload");
    } finally {
      setParsing(false);
    }
  }

  async function handleDeploy() {
    if (!repo && !upload) return;
    try {
      const { project, domainProvisioned } = await deploy.mutateAsync({
        name,
        repository_name: repo ? repo.fullName : `upload/${slugify(name) || "app"}`,
        repository_url: repo ? `https://github.com/${repo.fullName}` : "",
        framework,
        branch: repo ? branch : "upload",
        build_command: buildCmd,
        install_command: installCmd,
        start_command: startCmd,
        output_dir: outputDir,
        source_type: upload ? "upload" : "github",
        files: upload?.files,
      });
      if (domainProvisioned) {
        toast.success(`Deployed — ${project.domain} is provisioning DNS + SSL`);
      } else {
        toast.success(`Deployed to ${project.domain}`, {
          description: "Domain queued — track DNS + SSL on the Certificates page.",
        });
      }
      navigate({ to: "/projects/$id", params: { id: project.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deployment failed");
    }
  }


  const filtered = SAMPLE_REPOS.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );


  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New Deployment" description="Deploy a repository to EGREED Deploy." />

      <Stepper current={effectiveStep} connected={!!gh} />

      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : effectiveStep < 2 ? (
          <Card>
            <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary/30 p-1">
              {(
                [
                  ["connected", "Connected account", Github],
                  ["url", "Repository URL", LinkIcon],
                  ["upload", "Upload files", UploadCloud],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSourceMode(key)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
                    sourceMode === key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {sourceMode === "connected" && !gh && (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
                  <Github className="h-7 w-7" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">Connect GitHub</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Authorize the EGREED Deploy GitHub App to access your repositories — or upload
                  files instead.
                </p>
                <div className="mt-6 w-full max-w-sm space-y-3 text-left">
                  <Label htmlFor="ghuser">GitHub username or organization</Label>
                  <Input
                    id="ghuser"
                    value={ghUser}
                    onChange={(e) => setGhUser(e.target.value)}
                    placeholder="egreed-labs"
                  />
                  <Button
                    variant="hero"
                    className="w-full"
                    onClick={handleConnect}
                    disabled={connect.isPending || !ghUser.trim()}
                  >
                    {connect.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="h-4 w-4" />
                    )}
                    Authorize &amp; connect
                  </Button>
                </div>
              </div>
            )}

            {sourceMode === "connected" && gh && (
              <>
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground">Select a repository</h3>
                  <p className="text-sm text-muted-foreground">
                    Connected as{" "}
                    <span className="font-mono text-foreground">@{gh?.github_username}</span>
                  </p>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repositories…"
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2">
                  {filtered.map((r) => {
                    const fm = frameworkMeta(r.framework);
                    return (
                      <button
                        key={r.fullName}
                        onClick={() => pickRepo(r)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                          <fm.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            {r.name}
                            {r.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                        </div>
                        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                          <span>{r.language}</span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" /> {r.stars}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No repositories match &ldquo;{search}&rdquo;.
                    </p>
                  )}
                </div>
              </>
            )}

            {sourceMode === "url" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Deploy any public repository</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a GitHub URL — we read the latest commit straight from the repository.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="font-mono text-sm"
                  />
                  <Button variant="hero" onClick={useRepoUrl} disabled={!repoUrl.trim()}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {sourceMode === "upload" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Upload your project</h3>
                  <p className="text-sm text-muted-foreground">
                    Drop in a ZIP archive or pick a whole folder — no repository needed. You can
                    preview it before any domain is attached.
                  </p>
                </div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleFiles(e.dataTransfer.files);
                  }}
                  className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center"
                >
                  <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-foreground">Drag &amp; drop your ZIP or folder</p>
                  <p className="text-xs text-muted-foreground">
                    HTML, CSS, JS and other text files up to 8 MB total
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      disabled={parsing}
                      onClick={() => zipInputRef.current?.click()}
                    >
                      {parsing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      Choose ZIP / files
                    </Button>
                    <Button
                      variant="outline"
                      disabled={parsing}
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderUp className="h-4 w-4" /> Choose folder
                    </Button>
                  </div>
                  <input
                    ref={zipInputRef}
                    type="file"
                    multiple
                    accept=".zip,text/*,.html,.css,.js,.json,.md,.svg"
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    // @ts-expect-error non-standard but widely supported folder picker
                    webkitdirectory=""
                    directory=""
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                </div>
              </div>
            )}
          </Card>

        ) : (
          <Card>
            <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> {upload ? "Source" : "Repositories"}
              </button>
              <span>/</span>
              <span className="font-mono text-foreground">
                {repo?.name ?? `${Object.keys(upload?.files ?? {}).length} uploaded files`}
              </span>
            </div>

            <h3 className="font-semibold text-foreground">Configure your project</h3>
            <p className="text-sm text-muted-foreground">
              We detected <span className="text-foreground">{frameworkMeta(framework).label}</span>.
              Adjust anything before deploying.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pname">Project name</Label>
                <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
                <p className="font-mono text-xs text-primary">
                  {rootDomain
                    ? `→ ${subdomainFor(name || repo?.name || "app", rootDomain)}`
                    : "→ main platform domain not configured yet"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Framework</Label>
                  <Select
                    value={framework}
                    onValueChange={(v) => applyPlan(buildPlanFor(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FRAMEWORKS).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="branch">Branch</Label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Terminal className="h-4 w-4 text-primary" /> Detected build plan
                  </h4>
                  <div className="flex items-center gap-2">
                    {overriding && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyPlan(buildPlanFor(framework))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset to detected
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setOverriding((o) => !o)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {overriding ? "Done" : "Override commands"}
                    </Button>
                  </div>
                </div>

                {!overriding ? (
                  <dl className="mt-3 divide-y divide-border/70 rounded-xl border border-border bg-card">
                    {[
                      ["Install", installCmd],
                      ["Build", buildCmd],
                      ["Start", startCmd],
                      ["Output directory", outputDir],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="truncate font-mono text-xs text-foreground">
                          {value || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="install">Install command</Label>
                      <Input
                        id="install"
                        value={installCmd}
                        onChange={(e) => setInstallCmd(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="build">Build command</Label>
                      <Input
                        id="build"
                        value={buildCmd}
                        onChange={(e) => setBuildCmd(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="start">Start command</Label>
                      <Input
                        id="start"
                        value={startCmd}
                        onChange={(e) => setStartCmd(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="outdir">Output directory</Label>
                      <Input
                        id="outdir"
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                {planNotes.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {planNotes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">
                {deploy.isPending
                  ? "Creating CNAME & starting DNS propagation monitoring…"
                  : "Auto-deploy on push is enabled by default."}
              </span>
              <Button
                variant="hero"
                onClick={handleDeploy}
                disabled={deploy.isPending || !name.trim() || !slugify(name)}
              >
                {deploy.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Deploy
              </Button>
            </div>
          </Card>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Prefer to explore first?{" "}
        <Link to="/projects" className="text-primary hover:underline">
          View your projects
        </Link>
      </p>
    </div>
  );
}

function Stepper({ current, connected }: { current: number; connected: boolean }) {
  const steps = ["Choose source", "Select project", "Configure & Deploy"];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current || (i === 0 && connected && current > 0);
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-px flex-1",
                  i < current ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-6">{children}</div>;
}
