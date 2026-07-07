import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { COMPANY, PLATFORM_DOMAIN } from "@/lib/egreed";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            The African cloud platform to build, ship and scale apps — from Kigali to the world.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { to: "/features", label: "Features" },
            { to: "/pricing", label: "Pricing" },
            { to: "/docs", label: "Documentation" },
          ]}
        />
        <FooterCol
          title="Platform"
          links={[
            { to: "/docs", label: "GitHub App" },
            { to: "/docs", label: "Deployments" },
            { to: "/docs", label: "Domains & SSL" },
          ]}
        />
        <FooterCol
          title="Get started"
          links={[
            { to: "/auth", label: "Create account" },
            { to: "/auth", label: "Sign in" },
            { to: "/dashboard", label: "Dashboard" },
          ]}
        />
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY}. All rights reserved.
          </p>
          <p className="font-mono">{PLATFORM_DOMAIN}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l, i) => (
          <li key={`${l.label}-${i}`}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
