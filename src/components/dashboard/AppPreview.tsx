import { useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  GitBranch,
  Laptop,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROOT_DOMAIN, type Project } from "@/lib/egreed";

type DeviceKey = "mobile" | "tablet" | "laptop" | "desktop";

const DEVICES: { key: DeviceKey; label: string; width: number; icon: typeof Monitor }[] = [
  { key: "mobile", label: "375px", width: 375, icon: Smartphone },
  { key: "tablet", label: "768px", width: 768, icon: Tablet },
  { key: "laptop", label: "1280px", width: 1280, icon: Laptop },
  { key: "desktop", label: "Full", width: 0, icon: Monitor },
];

export function AppPreview({ project }: { project: Project }) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const subdomain = useMemo(
    () => (project.domain ?? "").replace(`.${ROOT_DOMAIN}`, ""),
    [project.domain],
  );

  const src = subdomain ? `/hosted/${subdomain}?preview=${nonce}` : "";
  const liveUrl = project.domain ? `https://${project.domain}` : project.repository_url;
  const active = DEVICES.find((d) => d.key === device)!;

  const reload = () => {
    setLoading(true);
    setNonce((n) => n + 1);
  };

  if (!subdomain) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          This project has no domain yet — provision one to enable the preview.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Browser chrome */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {project.domain}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {DEVICES.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDevice(d.key)}
              title={d.label}
              aria-label={d.label}
              aria-pressed={device === d.key}
              className={
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors " +
                (device === d.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <d.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
          Reload
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={liveUrl} target="_blank" rel="noreferrer">
            Open <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {/* Viewport */}
      <div className="relative flex justify-center bg-background/60 p-4">
        <div
          className="relative w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg transition-all duration-300"
          style={{
            maxWidth: active.width ? `${active.width}px` : "100%",
            height: "620px",
          }}
        >
          {loading && (
            <div className="absolute inset-0 z-10 space-y-4 bg-background p-6">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          <iframe
            ref={frameRef}
            key={nonce}
            src={src}
            title={`${project.name} preview`}
            onLoad={() => setLoading(false)}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          <span className="font-mono">
            {project.repository_name}#{project.branch}
          </span>
        </span>
        <span>
          Rendering the latest deployment build served on{" "}
          <span className="font-mono text-foreground">{active.label}</span>
        </span>
      </div>
    </div>
  );
}
