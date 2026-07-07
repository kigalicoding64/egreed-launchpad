import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  GitBranch,
  Globe,
  Lock,
  Rocket,
  RefreshCw,
  Boxes,
  Zap,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import heroBg from "@/assets/hero-bg.jpg";
import { ROOT_DOMAIN } from "@/lib/egreed";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <LogosStrip />
        <Steps />
        <Features />
        <DomainShowcase />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <img
        src={heroBg}
        alt=""
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 text-center sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Africa&apos;s professional deployment cloud
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.05] text-foreground sm:text-6xl">
          Ship your apps live on{" "}
          <span className="text-gradient">{ROOT_DOMAIN}</span> in minutes
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Connect GitHub, pick a repository, and EGREED Deploy handles the build,
          hosting, subdomain and SSL — with continuous deployment on every push.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="hero" size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Start deploying free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/docs">Read the docs</Link>
          </Button>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <TerminalCard />
        </div>
      </div>
    </section>
  );
}

function TerminalCard() {
  const lines = [
    { t: "Connecting to GitHub", ok: true },
    { t: "Cloning muhazi-dental-clinic", ok: true },
    { t: "Detected framework: Next.js", ok: true },
    { t: "Building project", ok: true },
    { t: "Creating container", ok: true },
    { t: "Domain muhazidentalclinic.egreedtech.org configured", ok: true },
    { t: "SSL enabled — deployment successful", ok: true },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-destructive/70" />
        <span className="h-3 w-3 rounded-full bg-accent/70" />
        <span className="h-3 w-3 rounded-full bg-primary/70" />
        <span className="ml-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" /> egreed deploy
        </span>
        <span className="ml-auto">
          <StatusBadge tone="success" label="Online" pulse />
        </span>
      </div>
      <div className="space-y-1.5 p-4 font-mono text-xs sm:text-sm">
        {lines.map((l) => (
          <div key={l.t} className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span>{l.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogosStrip() {
  const items = ["Next.js", "React", "Node.js", "Python", "Static HTML"];
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Auto-detects
        </span>
        {items.map((i) => (
          <span key={i} className="font-display text-sm font-semibold text-foreground/80">
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: GitBranch, title: "Connect GitHub", desc: "Authorize the EGREED Deploy GitHub App and pick a repository." },
    { icon: Boxes, title: "We detect & build", desc: "Framework auto-detection sets the right build command instantly." },
    { icon: Rocket, title: "Deploy live", desc: "Get a subdomain, SSL and a live URL — ready to share." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <SectionTitle
        eyebrow="How it works"
        title="From repo to production in three steps"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
            <span className="absolute right-5 top-5 font-mono text-3xl font-bold text-muted/50">
              0{i + 1}
            </span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: RefreshCw, title: "Continuous deployment", desc: "Every push to your main branch triggers an automatic build and redeploy." },
    { icon: Globe, title: "Automatic subdomains", desc: `Instant project-name.${ROOT_DOMAIN} domains via Cloudflare DNS.` },
    { icon: Lock, title: "Free SSL", desc: "HTTPS is provisioned and renewed automatically for every deployment." },
    { icon: Zap, title: "Framework detection", desc: "Next.js, React, Node, Python and static sites — configured for you." },
    { icon: Terminal, title: "Live build logs", desc: "Follow each build step and inspect logs for any deployment." },
    { icon: Boxes, title: "Env variables", desc: "Vercel-style environment variables scoped per project and target." },
  ];
  return (
    <section className="border-y border-border/60 bg-card/20">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionTitle
          eyebrow="Platform"
          title="Everything you need to run production apps"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
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
  );
}

function DomainShowcase() {
  const domains = [
    "school-system",
    "muhazi-clinic",
    "my-ai-app",
    "kigali-market",
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle
            align="left"
            eyebrow="Domains & SSL"
            title="Your app gets a live domain, instantly"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Every successful deployment is assigned a clean subdomain under{" "}
            <span className="font-mono text-foreground">{ROOT_DOMAIN}</span>, with SSL
            enabled automatically. Point a custom domain whenever you&apos;re ready.
          </p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/auth" search={{ mode: "signup" }}>
              Claim your subdomain
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="space-y-3">
          {domains.map((d) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="flex items-center gap-3 font-mono text-sm text-foreground">
                <Globe className="h-4 w-4 text-primary" />
                {d}.{ROOT_DOMAIN}
              </span>
              <StatusBadge tone="success" label="SSL active" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 text-center sm:p-16">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold text-foreground sm:text-4xl">
          Deploy your first project today
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Join developers, schools and companies across Africa shipping on EGREED Deploy.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-8">
          <Link to="/auth" search={{ mode: "signup" }}>
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2
        className={
          "mt-3 text-3xl font-bold text-foreground sm:text-4xl " +
          (align === "center" ? "mx-auto max-w-2xl" : "max-w-md")
        }
      >
        {title}
      </h2>
    </div>
  );
}
