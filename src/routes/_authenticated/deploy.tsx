import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
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
} from "@/lib/queries";
import {
  SAMPLE_REPOS,
  FRAMEWORKS,
  frameworkMeta,
  subdomainFor,
  slugify,
  type SampleRepo,
} from "@/lib/egreed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deploy")({
  component: DeployWizard,
});

type Step = 0 | 1 | 2;

function DeployWizard() {
  const navigate = useNavigate();
  const { data: gh, isLoading } = useGithubConnection();
  const connect = useConnectGithub();
  const deploy = useDeployProject();

  const [step, setStep] = useState<Step>(0);
  const [ghUser, setGhUser] = useState("");
  const [search, setSearch] = useState("");
  const [repo, setRepo] = useState<SampleRepo | null>(null);

  // configure state
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("static");
  const [branch, setBranch] = useState("main");
  const [buildCmd, setBuildCmd] = useState("");

  const effectiveStep: Step = gh && step === 0 ? 1 : step;

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
    setName(r.name);
    setFramework(r.framework);
    setBuildCmd(frameworkMeta(r.framework).buildCommand);
    setStep(2);
  }

  async function handleDeploy() {
    if (!repo) return;
    try {
      const project = await create.mutateAsync({
        name,
        repository_name: repo.fullName,
        repository_url: `https://github.com/${repo.fullName}`,
        framework,
        branch,
        build_command: buildCmd,
      });
      toast.success(`Deployed to ${project.domain}`);
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
        ) : effectiveStep === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-6 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
                <Github className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">Connect GitHub</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Authorize the EGREED Deploy GitHub App to access your repositories.
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
                  Authorize & connect
                </Button>
              </div>
            </div>
          </Card>
        ) : effectiveStep === 1 ? (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Select a repository</h3>
                <p className="text-sm text-muted-foreground">
                  Connected as{" "}
                  <span className="font-mono text-foreground">@{gh?.github_username}</span>
                </p>
              </div>
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
          </Card>
        ) : (
          <Card>
            <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Repositories
              </button>
              <span>/</span>
              <span className="font-mono text-foreground">{repo?.name}</span>
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
                  → {subdomainFor(name || repo?.name || "app")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Framework</Label>
                  <Select
                    value={framework}
                    onValueChange={(v) => {
                      setFramework(v);
                      setBuildCmd(frameworkMeta(v).buildCommand);
                    }}
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

              <div className="space-y-1.5">
                <Label htmlFor="build">Build command</Label>
                <Input
                  id="build"
                  value={buildCmd}
                  onChange={(e) => setBuildCmd(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">
                Auto-deploy on push is enabled by default.
              </span>
              <Button
                variant="hero"
                onClick={handleDeploy}
                disabled={create.isPending || !name.trim() || !slugify(name)}
              >
                {create.isPending ? (
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
  const steps = ["Connect GitHub", "Select Repository", "Configure & Deploy"];
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
