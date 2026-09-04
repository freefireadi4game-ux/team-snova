import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Gauge,
  Info,
  ListChecks,
  Target,
  Activity,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import {
  computeMeritIndex,
  loadMeritSource,
  meritTier,
} from "@/lib/merit";

export const Route = createFileRoute(
  "/merit",
)({
  head: () => ({
    meta: [
      {
        title:
          "Merit Index Leaderboard — Team SNOVA ESP",
      },
      {
        name: "description",
        content:
          "Team SNOVA individual Merit Index based on tasks, kills, damage, assists, K/D-style performance and consistency.",
      },
      {
        property: "og:title",
        content:
          "Merit Index — Team SNOVA ESP",
      },
      {
        property: "og:description",
        content:
          "Individual player Merit ranking based on personal performance.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),
  component: MeritPage,
});

function Bar({
  value,
  tone,
}: {
  value: number;
  tone: string;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${tone}`}
        style={{
          width: `${Math.max(
            2,
            Math.min(
              100,
              value,
            ),
          )}%`,
        }}
      />
    </div>
  );
}

function MeritPage() {
  const merit = useQuery({
    queryKey: [
      "merit-index",
    ],
    queryFn: async () =>
      computeMeritIndex(
        await loadMeritSource(),
      ),
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* HEADER */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Individual Performance Ranking
          </div>

          <h1 className="mt-2 font-display text-4xl md:text-5xl gradient-text">
            Merit Index
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A 0–100 individual player rating based on tasks,
            personal match performance and consistency.
            Team placement is not included.
          </p>
        </section>

        {/* LOADING */}
        {merit.isLoading && (
          <div className="grid gap-3">
            {Array.from(
              { length: 5 },
            ).map((_, index) => (
              <Skeleton
                key={index}
                className="h-40 rounded-2xl"
              />
            ))}
          </div>
        )}

        {/* ERROR */}
        {merit.isError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Could not load the Merit Index right now.
          </div>
        )}

        {/* EMPTY */}
        {!merit.isLoading &&
          !merit.isError &&
          (merit.data ?? [])
            .length === 0 && (
            <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
              <div className="font-semibold">
                No active players
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Add players to the roster to build the leaderboard.
              </div>
            </div>
          )}

        {/* LEADERBOARD */}
        {!merit.isLoading &&
          !merit.isError &&
          (merit.data ?? [])
            .length > 0 && (
            <div className="grid gap-3">
              {(merit.data ?? []).map(
                (row) => {
                  const tier =
                    meritTier(
                      row.merit,
                    );

                  return (
                    <article
                      key={
                        row.player.id
                      }
                      className="rounded-2xl border border-border bg-surface/60 p-4 transition-colors hover:bg-white/[0.04] md:p-5"
                    >
                      {/* TOP ROW */}
                      <div className="flex items-center gap-3">
                        {/* RANK */}
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums ${
                            row.rank === 1
                              ? "bg-neon-soft text-neon"
                              : "bg-white/[0.05] text-muted-foreground"
                          }`}
                        >
                          {row.rank}
                        </div>

                        {/* AVATAR */}
                        <PlayerAvatar
                          photoPath={
                            row
                              .player
                              .photo_url
                          }
                          name={
                            row
                              .player
                              .ign
                          }
                          size={
                            40
                          }
                        />

                        {/* PLAYER */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">
                            {
                              row
                                .player
                                .ign
                            }
                          </div>

                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {
                              row
                                .player
                                .role
                            }
                          </div>
                        </div>

                        {/* MERIT */}
                        <div className="text-right">
                          <div className="font-display text-2xl leading-none tabular-nums text-neon">
                            {row.merit.toFixed(
                              1,
                            )}
                          </div>

                          <div
                            className={`mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tier.className}`}
                          >
                            {
                              tier.label
                            }
                          </div>
                        </div>
                      </div>

                      {/* METRICS */}
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {/* TASKS */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ListChecks className="h-3 w-3 text-neon" />
                              Tasks
                            </span>

                            <span className="font-semibold text-foreground tabular-nums">
                              {
                                row.completed
                              }
                              /
                              {
                                row.assigned
                              }
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <Bar
                              value={
                                row.task_score
                              }
                              tone="bg-neon"
                            />
                          </div>

                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {
                              row.attempted_not_passed
                            }{" "}
                            partial ·{" "}
                            {
                              row.missed
                            }{" "}
                            missed
                          </div>
                        </div>

                        {/* INDIVIDUAL PERFORMANCE */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Target className="h-3 w-3 text-neon" />
                              Individual Performance
                            </span>

                            <span className="font-semibold text-foreground tabular-nums">
                              {row.performance_score.toFixed(
                                0,
                              )}
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <Bar
                              value={
                                row.performance_score
                              }
                              tone="bg-sky-400"
                            />
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            <span>
                              K{" "}
                              <b className="text-foreground">
                                {row.avg_kills.toFixed(
                                  2,
                                )}
                              </b>
                            </span>

                            <span>
                              DMG{" "}
                              <b className="text-foreground">
                                {row.avg_damage}
                              </b>
                            </span>

                            <span>
                              A{" "}
                              <b className="text-foreground">
                                {row.avg_assists.toFixed(
                                  2,
                                )}
                              </b>
                            </span>

                            <span>
                              K/D{" "}
                              <b className="text-foreground">
                                {row.avg_kd.toFixed(
                                  2,
                                )}
                              </b>
                            </span>
                          </div>
                        </div>

                        {/* CONSISTENCY */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="h-3 w-3 text-neon" />
                              Consistency
                            </span>

                            <span className="font-semibold text-foreground tabular-nums">
                              {row.consistency.toFixed(
                                0,
                              )}
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <Bar
                              value={
                                row.consistency
                              }
                              tone="bg-emerald-400"
                            />
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>
                              {
                                row.matches_played
                              }{" "}
                              matches
                            </span>

                            <span>
                              sample{" "}
                              {
                                row.sample_weight.toFixed(
                                  2,
                                )
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* EXTRA INDIVIDUAL STATS */}
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
                        <span>
                          Avg Kills:{" "}
                          <b className="text-foreground">
                            {row.avg_kills.toFixed(
                              2,
                            )}
                          </b>
                        </span>

                        <span>
                          Avg Damage:{" "}
                          <b className="text-foreground">
                            {row.avg_damage}
                          </b>
                        </span>

                        <span>
                          Avg Assists:{" "}
                          <b className="text-foreground">
                            {row.avg_assists.toFixed(
                              2,
                            )}
                          </b>
                        </span>

                        <span>
                          Avg K/D:{" "}
                          <b className="text-foreground">
                            {row.avg_kd.toFixed(
                              2,
                            )}
                          </b>
                        </span>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}

        {/* FORMULA */}
        <section className="rounded-2xl border border-border bg-surface/60 p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-neon" />

            <h2 className="font-bold">
              How Merit Index is calculated
            </h2>
          </div>

          <div className="mt-4 grid gap-3 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="font-semibold text-foreground">
                45% Tasks
              </div>

              <div className="mt-1">
                Task completion and future OCR-verified
                benchmark results.
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="font-semibold text-foreground">
                40% Individual Performance
              </div>

              <div className="mt-1">
                Based on individual average kills,
                damage, assists and K/D-style performance.
                Team placement is excluded.
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="font-semibold text-foreground">
                15% Consistency
              </div>

              <div className="mt-1">
                Based on consistency of individual match
                output and task reliability.
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Activity className="h-3.5 w-3.5 text-neon" />
                Matches Played
              </div>

              <div className="mt-1">
                Match count is not a direct Merit source.
                It is only used as sample context.
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="font-semibold text-foreground">
                Placement
              </div>

              <div className="mt-1">
                Not used in individual Merit because
                placement represents team performance.
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="font-semibold text-foreground">
                OCR Integration
              </div>

              <div className="mt-1">
                Once benchmark OCR starts producing verified
                task results, they automatically feed the
                existing 45% Tasks component.
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
