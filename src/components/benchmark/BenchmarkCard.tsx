import { CheckCircle2, CircleAlert, Target } from "lucide-react";
import type { Benchmark } from "@/lib/benchmark";
import { cn } from "@/lib/utils";

type Props = {
  benchmark: Benchmark;
  completed?: boolean;
  onClick?: () => void;
};

export function BenchmarkCard({
  benchmark,
  completed = false,
  onClick,
}: Props) {
  const roleLabel =
    benchmark.role === "all" ? "All Roles" : benchmark.role;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition-all",
        "bg-surface/60 hover:bg-white/[0.05]",
        "hover:-translate-y-0.5",
        completed
          ? "border-neon/40"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            completed
              ? "bg-neon-soft text-neon"
              : "bg-white/[0.05] text-muted-foreground",
          )}
        >
          {completed ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Target className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold truncate">
              {benchmark.name}
            </h3>

            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-neon">
              {roleLabel}
            </span>

            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {benchmark.source_type.replace("_", " ")}
            </span>
          </div>

          {benchmark.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {benchmark.description}
            </p>
          )}

          <div className="mt-3 grid gap-1.5">
            {benchmark.requirements.map((requirement, index) => (
              <div
                key={requirement.id ?? `${benchmark.id}-${index}`}
                className="flex items-center gap-2 text-xs"
              >
                <CircleAlert className="h-3.5 w-3.5 shrink-0 text-neon" />

                <span className="text-muted-foreground">
                  {requirement.label}
                </span>

                <span className="ml-auto font-semibold text-foreground">
                  {requirement.operator} {requirement.target_value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
