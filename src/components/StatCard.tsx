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
        "glass rounded-2xl p-4 md:p-5 relative overflow-hidden group transition-transform hover:-translate-y-0.5",
        accent && "neon-border",
        className,
      )}
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-neon-soft blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground truncate">
            {label}
          </div>
          <div className="mt-1 text-2xl md:text-3xl font-black gradient-text truncate">{value}</div>
        </div>
        {icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-soft text-neon">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
