import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GitBranch,
  Globe,
  Lock,
  RefreshCw,
  Boxes,
  Zap,
  Terminal,
  ShieldCheck,
  Server,
  Cpu,
  HardDrive,
  ArrowRight,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { ROOT_DOMAIN } from "@/lib/egreed";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — EGREED Deploy" },
      {
        name: "description",
        content:
          "GitHub integration, automatic framework detection, containerized builds, subdomains, SSL and continuous deployment on EGREED Deploy.",
      },
      { property: "og:title", content: "Features — EGREED Deploy" },
      {
        property: "og:description",
        content:
          "Everything EGREED Deploy gives you: builds, hosting, domains, SSL and continuous deployment.",
      },
    ],
  }),
  component: Features,
});

const CORE = [
  { icon: GitBranch, title: "GitHub App integration", desc: "Install the EGREED Deploy GitHub App and connect any repository across your accounts and organizations." },
  { icon: Zap, title: "Automatic framework detection", desc: "Next.js, React (Vite), Node.js, Python and static HTML are detected from your repo and configured automatically." },
  { icon: Server, title: "Containerized build engine", desc: "Isolated containers clone, install, build and run each project — modular and ready to scale." },
  { icon: Globe, title: "Instant subdomains", desc: `Every deployment receives a project-name.${ROOT_DOMAIN} domain via Cloudflare DNS automation.` },
  { icon: Lock, title: "Automatic SSL", desc: "HTTPS certificates are provisioned and renewed automatically for every domain." },
  { icon: RefreshCw, title: "Continuous deployment", desc: "Push to main and a webhook triggers a verified build and redeploy of your live app." },
  { icon: Terminal, title: "Real-time build logs", desc: "Watch each step — connecting, cloning, installing, building, deploying — with full logs." },
  { icon: Boxes, title: "Environment variables", desc: "Manage secrets and config per project and target: production, preview and development." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Encrypted credentials, webhook signature verification, role permissions and deployment isolation." },
];

const FUTURE = [
  { icon: HardDrive, title: "EGREED Storage", desc: "Object storage for your app assets and backups." },
  { icon: Cpu, title: "EGREED AI & GPU", desc: "Attach GPU servers and AI inference to your deployments." },
  { icon: Server, title: "Virtual machines", desc: "Dedicated compute for heavier workloads." },
];

function Features() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Features</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold text-foreground sm:text-5xl">
            A complete deployment platform
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Everything from GitHub to a live, secure URL — built for African developers and teams.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CORE.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/20">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              On the roadmap — EGREED Cloud
            </p>
            <h2 className="mt-3 text-3xl font-bold text-foreground">Built to grow with you</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {FUTURE.map((f) => (
                <div key={f.title} className="rounded-2xl border border-dashed border-border bg-card/50 p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 text-center">
          <Button asChild variant="hero" size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Start deploying <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
