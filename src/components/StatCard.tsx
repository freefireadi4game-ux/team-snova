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
        "glass rounded-xl p-4 md:p-5 transition-colors hover:bg-white/[0.02]",
        accent && "neon-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground truncate">
            {label}
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-display truncate text-foreground">
            {value}
          </div>
        </div>
        {icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-neon-soft text-neon">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
