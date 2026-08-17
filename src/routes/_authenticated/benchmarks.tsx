import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { BenchmarkCard } from "@/components/benchmark/BenchmarkCard";
import { BENCHMARKS } from "@/data/benchmarks";
import { getAuthenticatedPlayer } from "@/lib/benchmark/player";
import type { PlayerRole } from "@/lib/benchmark";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/benchmarks")({
  component: BenchmarksPage,
});

function BenchmarksPage() {
  const player = useQuery({
    queryKey: ["authenticated-player"],
    queryFn: getAuthenticatedPlayer,
    staleTime: 60_000,
  });

  const currentPlayer = player.data;

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

          {player.isLoading ? (
            <div className="mt-4 text-xs text-muted-foreground">
              Loading your player profile…
            </div>
          ) : currentPlayer ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-neon-soft px-3 py-1.5 text-xs font-semibold text-neon">
              {currentPlayer.ign} · {currentPlayer.role}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Your login account is not linked to a team player yet.
                Ask the admin to link your account from Player Management.
              </div>
            </div>
          )}
        </section>

        {player.isLoading ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-6 text-sm text-muted-foreground">
            Loading benchmarks…
          </div>
        ) : !currentPlayer ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <div className="font-semibold">
              No player account linked
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Your admin must link this login to a roster player before
              benchmarks can be assigned.
            </div>
          </div>
        ) : visibleBenchmarks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <div className="font-semibold">
              No active benchmarks available
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              No benchmark is currently assigned to your role.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleBenchmarks.map((benchmark) => (
              <Link
                key={benchmark.id}
                to="/benchmarks/$id"
                params={{ id: benchmark.id }}
                className="block"
              >
                <BenchmarkCard benchmark={benchmark} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
