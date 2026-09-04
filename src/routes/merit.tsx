import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Gauge, Info, ListChecks, Trophy } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { computeMeritIndex, loadMeritSource, meritTier } from "@/lib/merit";

export const Route = createFileRoute("/merit")({
  head: () => ({
    meta: [
      { title: "Merit Index Leaderboard — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Merit Index ranks Team SNOVA ESP players on task completion, consistency and normalized scrim performance — never on match volume.",
      },
      { property: "og:title", content: "Merit Index — Team SNOVA ESP" },
      {
        property: "og:description",
        content:
          "Performance and consistency ranking built from tasks and scrim averages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeritPage,
});

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${tone}`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function MeritPage() {
  const merit = useQuery({
    queryKey: ["merit-index"],
    queryFn: async () => computeMeritIndex(await loadMeritSource()),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Performance Ranking
          </div>

          <h1 className="mt-2 font-display text-4xl md:text-5xl gradient-text">
            Merit Index
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A 0–100 score from daily task performance, consistency and
            role-aware scrim averages. Playing more matches never raises the
            score by itself.
          </p>
        </section>

        {merit.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : merit.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Could not load the Merit Index right now.
          </div>
        ) : (merit.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <div className="font-semibold">No active players</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Add players to the roster to build the leaderboard.
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {(merit.data ?? []).map((row) => {
              const tier = meritTier(row.merit);

              return (
                <article
                  key={row.player.id}
                  className="rounded-2xl border border-border bg-surface/60 p-4 transition-colors hover:bg-white/[0.04] md:p-5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums ${
                        row.rank === 1
                          ? "bg-neon-soft text-neon"
                          : "bg-white/[0.05] text-muted-foreground"
                      }`}
                    >
                      {row.rank}
                    </div>

                    <PlayerAvatar
                      src={row.player.photo_url}
                      alt={row.player.ign}
                      className="h-10 w-10 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">
                        {row.player.ign}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {row.player.role}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-display text-2xl leading-none tabular-nums text-neon">
                        {row.merit.toFixed(1)}
                      </div>
                      <div
                        className={`mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tier.className}`}
                      >
                        {tier.label}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3 w-3 text-neon" />
                          Tasks
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {row.completed}/{row.assigned}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Bar value={row.task_score} tone="bg-neon" />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {row.attempted_not_passed} partial · {row.missed} missed
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-neon" />
                          Scrim / Tournament
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {row.performance_score.toFixed(0)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Bar value={row.performance_score} tone="bg-sky-400" />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {row.avg_kills.toFixed(1)} K · {row.avg_damage} DMG ·{" "}
                        {row.avg_placement_points.toFixed(1)} pos pts / match
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="h-3 w-3 text-neon" />
                          Consistency
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {row.consistency.toFixed(0)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Bar value={row.consistency} tone="bg-emerald-400" />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {row.matches_played} matches · sample weight{" "}
                        {row.sample_weight.toFixed(2)}
                        {row.penalty > 0 && ` · −${row.penalty} penalty`}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-surface/60 p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-neon" />
            <h2 className="font-bold">How Merit Index is calculated</h2>
          </div>

          <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">45% Tasks</span> —
              share of assigned tasks passed. An attempt below the requirement
              earns 40% credit; extra passes add a capped bonus of up to 8
              points.
            </li>
            <li>
              <span className="font-semibold text-foreground">
                40% Scrim performance
              </span>{" "}
              — role-weighted averages of kills, damage, assists and placement
              points per match, normalized across the roster and shrunk toward
              the roster mean for small samples. Totals and match counts are
              never used.
            </li>
            <li>
              <span className="font-semibold text-foreground">
                15% Consistency
              </span>{" "}
              — how often attempts actually meet the requirement, plus the
              steadiness of per-match points, so one unusual match cannot swing
              the score.
            </li>
            <li>
              <span className="font-semibold text-foreground">Penalty</span> —
              up to 12 points removed for assigned tasks never attempted.
            </li>
            <li>
              <span className="font-semibold text-foreground">
                <Award className="mr-1 inline h-3 w-3 text-neon" />
                Deterministic
              </span>{" "}
              — recalculated live from roster, task submissions and stored match
              stats; the same data always yields the same score.
            </li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
