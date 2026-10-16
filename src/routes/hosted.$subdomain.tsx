import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Globe, Rocket, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/hosted/$subdomain")({
  component: HostedLanding,
  head: ({ params }) => ({
    meta: [
      { title: `${params.subdomain} — Deployed via EGREED Deploy` },
      {
        name: "description",
        content: `${params.subdomain} is live and served by EGREED Deploy.`,
      },
      { property: "og:title", content: `${params.subdomain}` },
      {
        property: "og:description",
        content: `Live deployment served by EGREED Deploy.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function HostedLanding() {
  const { subdomain } = Route.useParams();
  const full = subdomain;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live · HTTPS active
        </div>

        <h1 className="mt-6 text-center font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          🚀 Your app is deployed
        </h1>
        <p className="mt-3 text-center text-lg text-muted-foreground">
          <span className="font-mono text-foreground">{full}</span> is live on the EGREED Deploy
          edge network.
        </p>

        <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Globe, label: "DNS", value: "Propagated" },
            { icon: ShieldCheck, label: "SSL", value: "Active" },
            { icon: Rocket, label: "Status", value: "Online" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card/60 p-5"
            >
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card/40 p-5 text-center text-sm text-muted-foreground">
          This subdomain is managed by{" "}
          <a href="https://deploy.egreedtech.org" className="text-primary hover:underline">
            EGREED Deploy
          </a>
          . The project owner controls the app served here.
        </div>
      </div>
    </main>
  );
}
