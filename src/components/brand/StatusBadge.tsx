import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/egreed";

const toneClasses: Record<Tone, string> = {
  success: "bg-primary/12 text-primary ring-primary/25",
  warning: "bg-accent/12 text-accent ring-accent/25",
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
  info: "bg-sky-400/12 text-sky-300 ring-sky-400/25",
  muted: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({
  tone,
  label,
  pulse,
  className,
}: {
  tone: Tone;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulse && tone === "success" && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}
