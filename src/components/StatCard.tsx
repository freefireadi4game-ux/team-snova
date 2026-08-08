import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group i-lift i-sheen i-glow-edge relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface/70 p-4 md:p-5 hover:bg-surface",
        accent && "neon-border",
        className,
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[2px]",
          accent ? "bg-neon" : "bg-white/10 group-hover:bg-neon/50 transition-colors",
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="label-eyebrow truncate">{label}</div>
        {icon && <div className="shrink-0 text-muted-foreground group-hover:text-neon transition-colors">{icon}</div>}
      </div>
      <div className="mt-auto pt-3 stat-num f-count text-2xl md:text-3xl truncate text-foreground">{value}</div>
    </div>
  );
}
