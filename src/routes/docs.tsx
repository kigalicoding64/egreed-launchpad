import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { PLATFORM_DOMAIN, ROOT_DOMAIN } from "@/lib/egreed";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — EGREED Deploy" },
      {
        name: "description",
        content:
          "Learn how to connect GitHub, deploy repositories, configure domains and enable continuous deployment on EGREED Deploy.",
      },
      { property: "og:title", content: "Documentation — EGREED Deploy" },
      {
        property: "og:description",
        content: "Guides for connecting GitHub, deploying and configuring domains on EGREED Deploy.",
      },
    ],
  }),
  component: Docs,
});

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    body: [
      "Create your EGREED account and sign in to the dashboard.",
      "Click Connect GitHub to authorize the EGREED Deploy GitHub App on any account.",
      "Select a repository, confirm the detected framework, and click Deploy.",
    ],
  },
  {
    id: "github-app",
    title: "GitHub App",
    body: [
      `The EGREED Deploy GitHub App uses ${PLATFORM_DOMAIN} for its homepage, callback and webhook URLs.`,
      "It requests read/write on Contents, Actions, Deployments, Checks and Commit Status, plus read-only Metadata.",
      "It subscribes to Installation, Push, Repository and Pull Request events to trigger deployments automatically.",
    ],
  },
  {
    id: "frameworks",
    title: "Framework detection",
    body: [
      "Next.js is detected from next.config.js / package.json.",
      "React is detected from vite.config, Node.js from server.js, Python from requirements.txt.",
      "Static sites are detected from index.html. You can override the build command per project.",
    ],
  },
  {
    id: "domains",
    title: "Domains & SSL",
    body: [
      `Every successful deployment receives a project-name.${ROOT_DOMAIN} subdomain.`,
      "A CNAME record is created via the Cloudflare DNS API pointing to the platform.",
      "SSL is provisioned automatically, so your app is served over HTTPS from the first deploy.",
    ],
  },
  {
    id: "continuous-deployment",
    title: "Continuous deployment",
    body: [
      "When you push to your main branch, GitHub sends a signed webhook to EGREED Deploy.",
      "The signature is verified, a new build starts, and your live application is updated.",
      "Each build appears in your deployment history with full logs.",
    ],
  },
  {
    id: "environment-variables",
    title: "Environment variables",
    body: [
      "Add variables like DATABASE_URL, OPENAI_API_KEY and SECRET_KEYS per project.",
      "Scope each variable to production, preview or development targets.",
      "Values are stored securely and injected into your build and runtime.",
    ],
  },
];

function Docs() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Documentation</p>
          <h1 className="mt-3 text-4xl font-bold text-foreground">EGREED Deploy docs</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Everything you need to connect a repository and ship it live.
          </p>

          <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
            <aside className="hidden lg:block">
              <nav className="sticky top-24 space-y-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="space-y-10">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
                  <ol className="mt-4 space-y-3">
                    {s.body.map((line, i) => (
                      <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 font-mono text-[11px] text-primary">
                          {i + 1}
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}

              <div className="rounded-2xl border border-primary/25 bg-primary/8 p-6">
                <h3 className="text-lg font-semibold text-foreground">Ready to try it?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect your first repository and deploy in minutes.
                </p>
                <Button asChild variant="hero" className="mt-4">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Open the dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
