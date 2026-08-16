import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { BenchmarkCard } from "@/components/benchmark/BenchmarkCard";
import { BENCHMARKS } from "@/data/benchmarks";
import { listPlayers } from "@/lib/data";
import type { PlayerRole } from "@/lib/benchmark";

export const Route = createFileRoute("/_authenticated/benchmarks")({
  component: BenchmarksPage,
});

function BenchmarksPage() {
  const players = useQuery({
    queryKey: ["players"],
    queryFn: listPlayers,
  });

  /**
   * Current authenticated user -> player mapping will be connected
   * properly later using the existing auth/profile system.
   *
   * For now, use the first active player as a safe development fallback.
   */
  const currentPlayer = players.data?.find(
    (player) => player.status === "active",
  );

  const playerRole = (currentPlayer?.role ?? "Other") as PlayerRole;

  const visibleBenchmarks = BENCHMARKS.filter(
    (benchmark) =>
      benchmark.status === "active" &&
      (benchmark.role === "all" || benchmark.role === playerRole),
  );

  return (
    <Layout>
      <div className="space-y-6">
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Player Development
          </div>

          <h1 className="mt-2 font-display text-4xl md:text-5xl">
            Benchmarks
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Complete your role-specific training drills and prove your
            performance with screenshot evidence.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-neon-soft px-3 py-1.5 text-xs font-semibold text-neon">
            Your role: {playerRole}
          </div>
        </section>

        {players.isLoading ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-6 text-sm text-muted-foreground">
            Loading benchmarks…
          </div>
        ) : visibleBenchmarks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <div className="font-semibold">
              No active benchmarks available
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Your role currently has no assigned drills.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleBenchmarks.map((benchmark) => (
              <BenchmarkCard
                key={benchmark.id}
                benchmark={benchmark}
                onClick={() => {
                  window.location.href = `/benchmarks/${benchmark.id}`;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
    }
