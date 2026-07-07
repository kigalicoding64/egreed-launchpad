import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — EGREED Deploy" },
      {
        name: "description",
        content:
          "Simple, transparent pricing for EGREED Deploy. Start free, scale to Pro and Team plans as your projects grow.",
      },
      { property: "og:title", content: "Pricing — EGREED Deploy" },
      {
        property: "og:description",
        content: "Start free and scale with Pro and Team plans on EGREED Deploy.",
      },
    ],
  }),
  component: Pricing,
});

const PLANS = [
  {
    name: "Hobby",
    price: "Free",
    period: "",
    desc: "For personal projects and learning.",
    features: ["3 projects", "Automatic subdomains", "Free SSL", "Continuous deployment", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "For developers shipping real products.",
    features: ["Unlimited projects", "Custom domains", "Build logs & history", "Environment variables", "Priority builds", "Email support"],
    cta: "Go Pro",
    featured: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "/month",
    desc: "For companies and organizations.",
    features: ["Everything in Pro", "Team members & roles", "Deployment isolation", "Audit logs", "SLA & dedicated support"],
    cta: "Contact us",
    featured: false,
  },
];

function Pricing() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold text-foreground sm:text-5xl">
            Simple pricing that scales
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start free. Upgrade when you need custom domains, more projects and team features.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-3xl border bg-card p-8",
                  plan.featured
                    ? "border-primary/50 shadow-card ring-1 ring-primary/20"
                    : "border-border",
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <Button
                  asChild
                  variant={plan.featured ? "hero" : "outline"}
                  className="mt-6 w-full"
                >
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {plan.cta}
                  </Link>
                </Button>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-bold text-foreground">Ready to deploy?</h2>
          <Button asChild variant="hero" size="lg" className="mt-6">
            <Link to="/auth" search={{ mode: "signup" }}>
              Create your account <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
