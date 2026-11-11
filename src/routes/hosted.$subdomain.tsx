
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Cloud,
  Code2,
  Globe,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Terminal,
} from "lucide-react";

export const Route = createFileRoute("/hosted/$subdomain")({
  component: HostedLanding,
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.subdomain} — EGREED Deploy`,
      },
      {
        name: "description",
        content: `Explore the deployment status for ${params.subdomain}, hosted through EGREED Deploy.`,
      },
      {
        property: "og:title",
        content: `${params.subdomain} — EGREED Deploy`,
      },
      {
        property: "og:description",
        content: "Deployment overview powered by EGREED Deploy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function HostedLanding() {
  const { subdomain } = Route.useParams();

  const services = [
    {
      icon: Globe,
      label: "Domain",
      value: "Configured",
      detail: "Domain status requires verification",
      tone: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      icon: ShieldCheck,
      label: "Security",
      value: "Not verified",
      detail: "TLS status requires verification",
      tone: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      icon: Activity,
      label: "Runtime",
      value: "Not checked",
      detail: "Live health check unavailable",
      tone: "text-primary",
      iconBg: "bg-primary/10",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -top-48 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.12] blur-[140px]" />
        <div className="absolute right-[-180px] top-[35%] h-[300px] w-[300px] rounded-full bg-accent/[0.08] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklch, var(--muted-foreground) 12%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--muted-foreground) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(to bottom, black, transparent 80%)",
          }}
        />
      </div>

      <div className="relative mx-auto min-h-screen max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        {/* Navigation */}
        <header className="flex items-center justify-between border-b border-border pb-6">
          <a
            href="https://deploy.egreedtech.org"
            className="group flex items-center gap-3"
            aria-label="EGREED Deploy home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-lg shadow-primary/10">
              <Cloud className="h-5 w-5 text-primary" />
            </div>

            <div>
              <p className="text-sm font-bold tracking-[0.14em]">
                EGREED
                <span className="text-primary"> DEPLOY</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Application hosting platform
              </p>
            </div>
          </a>

          <a
            href="https://deploy.egreedtech.org"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-xs font-medium text-foreground/80 transition hover:border-primary/30 hover:bg-foreground/[0.06] hover:text-foreground sm:px-4 sm:text-sm"
          >
            Platform home
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </header>

        {/* Main content */}
        <section className="mx-auto max-w-4xl py-14 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.07] px-3.5 py-2 text-xs font-medium text-success">
              <CircleDot className="h-3.5 w-3.5" />
              Deployment endpoint
              <span className="h-1 w-1 rounded-full bg-success" />
              Status unverified
            </div>

            <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-[26px] border border-border bg-gradient-to-br from-primary/20 via-primary/10 to-transparent shadow-2xl shadow-primary/10">
              <Rocket className="h-9 w-9 text-primary" />
            </div>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Hosted application
            </p>

            <h1 className="mt-3 max-w-3xl break-words text-4xl font-semibold font-display tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Built to run.
              <span className="mt-2 block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Ready to scale.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              This application has a dedicated hosting page on EGREED
              Deploy. Explore its deployment identity and service
              verification status below.
            </p>

            {/* Project identity */}
            <div className="mt-9 w-full max-w-2xl rounded-2xl border border-border bg-card/90 p-4 text-left shadow-2xl shadow-background/40 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05]">
                  <Code2 className="h-5 w-5 text-foreground/80" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    Project identifier
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-medium text-foreground sm:text-base">
                    {subdomain}
                  </p>
                </div>

                <span className="hidden shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-block">
                  Hosted
                </span>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>
                    HTTPS and certificate validity have not been
                    independently verified by this page.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service overview */}
          <div className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Service overview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Verification status for this endpoint
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                3 checks
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {services.map((service) => {
                const Icon = service.icon;

                return (
                  <article
                    key={service.label}
                    className="group rounded-2xl border border-border bg-card/80 p-5 transition duration-300 hover:-translate-y-1 hover:border-border hover:bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${service.iconBg}`}
                      >
                        <Icon className={`h-5 w-5 ${service.tone}`} />
                      </div>
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                    </div>

                    <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {service.label}
                    </p>

                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {service.value}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {service.detail}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Deployment information */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Terminal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Deployment details
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Environment overview
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <span className="max-w-[65%] break-all text-right font-mono text-xs text-foreground/80">
                    {subdomain}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Hosting provider</span>
                  <span className="text-right text-foreground/80">
                    EGREED Deploy
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Health checks</span>
                  <span className="text-right text-accent">
                    Not connected
                  </span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-card to-accent/[0.08] p-5 sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/[0.10] blur-3xl" />

              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-foreground">
                  Manage your deployment
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Visit the EGREED Deploy platform to access available
                  project management and deployment tools.
                </p>

                <a
                  href="https://deploy.egreedtech.org"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition hover:bg-primary/90"
                >
                  Open EGREED Deploy
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Trust footer */}
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-foreground/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-5 text-muted-foreground">
                Project identity rendered by EGREED Deploy.
              </p>
            </div>

            <a
              href="https://egreedtech.org"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-primary"
            >
              About EGREED
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>

        <footer className="border-t border-border py-6">
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground/70 sm:flex-row">
            <p>
              © {new Date().getFullYear()} EGREED Technology.
              All rights reserved.
            </p>
            <p className="flex items-center gap-2">
              <Cloud className="h-3.5 w-3.5" />
              EGREED Deploy · Application hosting
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
