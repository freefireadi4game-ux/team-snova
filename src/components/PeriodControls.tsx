import { CalendarRange, Infinity as InfinityIcon } from "lucide-react";
import { OVERALL, monthLabel, type MonthKey, type Period } from "@/lib/stats-core";
import { cn } from "@/lib/utils";

/** Two-state toggle: current month vs all time. */
export function PeriodToggle({
  value,
  onChange,
  monthKey,
  className,
}: {
  value: Period;
  onChange: (p: Period) => void;
  monthKey: MonthKey;
  className?: string;
}) {
  const isMonth = value !== OVERALL;
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(monthKey)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-300",
          isMonth ? "bg-neon-soft text-neon" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarRange className="h-3.5 w-3.5" />
        {monthLabel(monthKey).split(" ")[0]}
      </button>
      <button
        type="button"
        onClick={() => onChange(OVERALL)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-300",
          !isMonth ? "bg-neon-soft text-neon" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        All Time
      </button>
    </div>
  );
}

/** Dropdown of every month that has data, plus All Time. */
export function MonthFilter({
  value,
  onChange,
  months,
  className,
}: {
  value: Period;
  onChange: (p: Period) => void;
  months: MonthKey[];
  className?: string;
}) {
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Period</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold outline-none focus:border-neon/40"
      >
        <option value={OVERALL}>All Time</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
