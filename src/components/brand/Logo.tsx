import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_6px_20px_-6px] shadow-primary/60",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3.5c2.8 1.7 4.5 4.6 4.5 8 0 1.7-.5 3.2-1.2 4.4L12 20.5l-3.3-4.6A8.2 8.2 0 0 1 7.5 11.5c0-3.4 1.7-6.3 4.5-8Z"
          fill="currentColor"
          opacity="0.95"
        />
        <circle cx="12" cy="10.5" r="1.9" className="fill-background" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {withText && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
            EGREED<span className="text-primary"> Deploy</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Cloud Platform
          </span>
        </span>
      )}
    </span>
  );
}
