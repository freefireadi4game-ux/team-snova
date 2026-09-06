import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  useMemo,
  useState,
} from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Layout,
} from "@/components/Layout";
import {
  PlayerAvatar,
} from "@/components/PlayerAvatar";
import {
  StatCard,
} from "@/components/StatCard";
import {
  AchievementBadge,
  prestigeAuraClass,
} from "@/components/AchievementBadge";
import {
  MonthFilter,
  PeriodToggle,
} from "@/components/PeriodControls";
import {
  Skeleton,
} from "@/components/ui/skeleton";
import {
  Button,
} from "@/components/ui/button";
import {
  getPlayer,
  listTournaments,
  rating,
} from "@/lib/data";
import {
  OVERALL,
  aggregateByPlayer,
  availableMonths,
  currentMonthKey,
  filterByPeriod,
  listStatEntries,
  periodLabel,
  type Period,
} from "@/lib/stats-core";
import {
  ACHIEVEMENT_COUNT,
  PRESTIGE_LABEL,
  achievementScore,
  evaluateAchievements,
  prestigeOf,
  toMetrics,
} from "@/lib/achievements";
import {
  Activity,
  Award,
  BarChart3,
  Brain,
  CalendarDays,
  Flame,
  Gauge,
  Medal,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";

export const Route =
  createFileRoute(
    "/players/$id",
  )({
    component:
      PlayerProfile,
  });

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function ratingClass(
  r: string,
) {
  return {
    Excellent:
      "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    Good:
      "text-neon border-neon/40 bg-neon-soft",
    Average:
      "text-amber-400 border-amber-400/40 bg-amber-400/10",
    "Needs Improvement":
      "text-rose-400 border-rose-400/40 bg-rose-400/10",
  }[r] ?? "";
}

/**
 * Behaviour is derived entirely from completed task rate.
 *
 * 90%+  -> TASK MACHINE
 * 70-89 -> DISCIPLINED
 * 40-69 -> INCONSISTENT
 * <40   -> 5TH PLAYER
 *
 * With no task data yet, we keep the tag neutral.
 */
function behaviourTag(
  completed: number,
  assigned: number,
) {
  if (assigned <= 0) {
    return {
      label: "NO TASK DATA",
      description:
        "Behaviour tag will appear once player tasks are assigned.",
      className:
        "border-white/10 bg-white/[0.04] text-muted-foreground",
      icon: Brain,
    };
  }

  const rate =
    completed / assigned;

  if (rate >= 0.9) {
    return {
      label: "TASK MACHINE",
      description:
        "Consistently completes assigned tasks.",
      className:
        "border-neon/40 bg-neon-soft text-neon",
      icon: Zap,
    };
  }

  if (rate >= 0.7) {
    return {
      label: "DISCIPLINED",
      description:
        "Usually completes assigned tasks.",
      className:
        "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
      icon: Target,
    };
  }

  if (rate >= 0.4) {
    return {
      label: "INCONSISTENT",
      description:
        "Task completion is irregular.",
      className:
        "border-amber-400/40 bg-amber-400/10 text-amber-400",
      icon: Gauge,
    };
  }

  return {
    label: "5TH PLAYER",
    description:
      "Frequently leaves assigned tasks incomplete.",
    className:
      "border-rose-400/40 bg-rose-400/10 text-rose-400",
    icon: UserRound,
  };
}

function formatNumber(
  value: number,
) {
  return value.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 0,
    },
  );
}

function average(
  values: number[],
) {
  return values.length
    ? values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length
    : 0;
}

function consistencyScore(
  values: number[],
) {
  if (values.length === 0) {
    return 0;
  }

  if (values.length === 1) {
    return 50;
  }

  const avg =
    average(values);

  if (avg <= 0) {
    return 0;
  }

  const variance =
    average(
      values.map(
        (value) =>
          (value - avg) **
          2,
      ),
    );

  const standardDeviation =
    Math.sqrt(variance);

  const coefficient =
    standardDeviation /
    avg;

  return Math.max(
    0,
    Math.min(
      100,
      (
        1 -
        Math.min(
          1,
          coefficient,
        )
      ) * 100,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* PROFILE                                                                    */
/* -------------------------------------------------------------------------- */

function PlayerProfile() {
  const {
    id,
  } = Route.useParams();

  const monthKey =
    currentMonthKey();

  const [period, setPeriod] =
    useState<Period>(
      OVERALL,
    );

  const [showAll, setShowAll] =
    useState(false);

  const [
    analyticsOpen,
    setAnalyticsOpen,
  ] = useState(false);

  const player =
    useQuery({
      queryKey: [
        "player",
        id,
      ],
      queryFn: () =>
        getPlayer(id),
    });

  const entries =
    useQuery({
      queryKey: [
        "stat-entries",
      ],
      queryFn:
        listStatEntries,
    });

  const tournaments =
    useQuery({
      queryKey: [
        "tournaments",
      ],
      queryFn:
        listTournaments,
    });

  /* ---------------------------------------------------------------------- */
  /* PLAYER DATA                                                             */
  /* ---------------------------------------------------------------------- */

  const mine = useMemo(
    () =>
      (
        entries.data ??
        []
      ).filter(
        (entry) =>
          entry.player_id ===
          id,
      ),
    [
      entries.data,
      id,
    ],
  );

  const months =
    useMemo(
      () =>
        availableMonths(
          mine,
        ),
      [mine],
    );

  const scoped =
    useMemo(
      () =>
        filterByPeriod(
          mine,
          period,
        ),
      [
        mine,
        period,
      ],
    );

  const agg =
    useMemo(
      () =>
        aggregateByPlayer(
          scoped,
        ).get(id),
      [
        scoped,
        id,
      ],
    );

  const mvps =
    useMemo(
      () =>
        (
          tournaments.data ??
          []
        ).filter(
          (tournament) =>
            tournament.mvp_player_id ===
              id &&
            (
              period ===
              OVERALL ||
              String(
                tournament.date,
              ).slice(0, 7) ===
                period
            ),
        ).length,
      [
        tournaments.data,
        id,
        period,
      ],
    );

  const metrics =
    useMemo(
      () =>
        toMetrics(
          agg,
          mvps,
        ),
      [
        agg,
        mvps,
      ],
    );

  /* ---------------------------------------------------------------------- */
  /* ACHIEVEMENTS                                                            */
  /* ---------------------------------------------------------------------- */

  const evaluated =
    useMemo(
      () =>
        evaluateAchievements(
          metrics,
        ),
      [metrics],
    );

  const unlocked =
    useMemo(
      () =>
        evaluated.filter(
          (achievement) =>
            achievement.unlocked,
        ),
      [evaluated],
    );

  const nextUp =
    useMemo(
      () =>
        evaluated
          .filter(
            (achievement) =>
              !achievement.unlocked,
          )
          .sort(
            (a, b) =>
              b.progress -
              a.progress,
          )
          .slice(0, 4),
      [evaluated],
    );

  const prestige =
    prestigeOf(
      unlocked.length,
    );

  const score =
    achievementScore(
      evaluated,
    );

  /* ---------------------------------------------------------------------- */
  /* MATCHES                                                                 */
  /* ---------------------------------------------------------------------- */

  const played =
    useMemo(
      () =>
        scoped.filter(
          (entry) =>
            entry.kills > 0 ||
            entry.damage > 0 ||
            entry.assists > 0,
        ),
      [scoped],
    );

  /* ---------------------------------------------------------------------- */
  /* NORMAL TREND                                                            */
  /* ---------------------------------------------------------------------- */

  const trend =
    useMemo(
      () =>
        [...played]
          .sort(
            (a, b) =>
              a.match_created_at <
              b.match_created_at
                ? -1
                : 1,
          )
          .map(
            (
              entry,
              index,
            ) => ({
              x: index + 1,
              kills:
                entry.kills,
              damage:
                entry.damage,
              assists:
                entry.assists,
            }),
          ),
      [played],
    );

  /* ---------------------------------------------------------------------- */
  /* ADVANCED ANALYTICS                                                      */
  /* ---------------------------------------------------------------------- */

  const analytics =
    useMemo(() => {
      const ordered =
        [...played].sort(
          (a, b) =>
            a.match_created_at <
            b.match_created_at
              ? -1
              : 1,
        );

      const last10 =
        ordered.slice(-10);

      const killValues =
        ordered.map(
          (entry) =>
            entry.kills,
        );

      const damageValues =
        ordered.map(
          (entry) =>
            entry.damage,
        );

      const assistValues =
        ordered.map(
          (entry) =>
            entry.assists,
        );

      const recentKillValues =
        last10.map(
          (entry) =>
            entry.kills,
        );

      const recentDamageValues =
        last10.map(
          (entry) =>
            entry.damage,
        );

      const recentAssistValues =
        last10.map(
          (entry) =>
            entry.assists,
        );

      const tournamentMap =
        new Map<
          string,
          {
            id: string;
            name: string;
            matches: number;
            kills: number;
            damage: number;
            assists: number;
          }
        >();

      for (const entry of ordered) {
        const current =
          tournamentMap.get(
            entry.tournament_id,
          ) ??
          {
            id:
              entry.tournament_id,
            name:
              entry.tournament_name,
            matches: 0,
            kills: 0,
            damage: 0,
            assists: 0,
          };

        current.matches += 1;
        current.kills +=
          entry.kills;
        current.damage +=
          entry.damage;
        current.assists +=
          entry.assists;

        tournamentMap.set(
          entry.tournament_id,
          current,
        );
      }

      const tournamentRows =
        [...tournamentMap.values()]
          .map(
            (tournament) => ({
              ...tournament,
              avgKills:
                tournament.matches
                  ? tournament.kills /
                    tournament.matches
                  : 0,
              avgDamage:
                tournament.matches
                  ? tournament.damage /
                    tournament.matches
                  : 0,
              avgAssists:
                tournament.matches
                  ? tournament.assists /
                    tournament.matches
                  : 0,
            }),
          )
          .sort(
            (a, b) =>
              b.avgKills -
              a.avgKills,
          );

      const bestMatch =
        ordered.reduce<
          typeof ordered[number] | null
        >(
          (
            best,
            entry,
          ) => {
            if (!best) {
              return entry;
            }

            return entry.kills >
              best.kills
              ? entry
              : best;
          },
          null,
        );

      const form =
        last10.map(
          (
            entry,
            index,
          ) => ({
            match:
              index + 1,
            kills:
              entry.kills,
            damage:
              entry.damage,
            assists:
              entry.assists,
          }),
        );

      return {
        recentMatches:
          last10.length,

        recentAvgKills:
          average(
            recentKillValues,
          ),

        recentAvgDamage:
          average(
            recentDamageValues,
          ),

        recentAvgAssists:
          average(
            recentAssistValues,
          ),

        killConsistency:
          consistencyScore(
            killValues,
          ),

        damageConsistency:
          consistencyScore(
            damageValues,
          ),

        assistConsistency:
          consistencyScore(
            assistValues,
          ),

        bestMatch,
        form,
        tournamentRows,
      };
    }, [played]);

  /* ---------------------------------------------------------------------- */
  /* BEHAVIOUR                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Current profile has achievement data but does not yet expose the
   * dedicated benchmark completion dataset directly. Until those task
   * rows are available here, the tag stays neutral.
   */
  const behaviour =
    behaviourTag(
      0,
      0,
    );

  /* ---------------------------------------------------------------------- */
  /* LOADING / NOT FOUND                                                     */
  /* ---------------------------------------------------------------------- */

  if (
    player.isLoading
  ) {
    return (
      <Layout>
        <Skeleton className="h-64 rounded-3xl" />
      </Layout>
    );
  }

  if (
    !player.data
  ) {
    throw notFound();
  }

  const p =
    player.data;

  const perfRating =
    rating(
      metrics.avgKills,
    );

  const tournamentIds =
    new Set(
      scoped.map(
        (entry) =>
          entry.tournament_id,
      ),
    );

  const recentTournaments =
    (
      tournaments.data ??
      []
    )
      .filter(
        (tournament) =>
          tournamentIds.has(
            tournament.id,
          ),
      )
      .slice(0, 6);

  const shownAchievements =
    showAll
      ? evaluated
      : unlocked;

  return (
    <Layout>
      <div className="space-y-6">

        {/* ---------------------------------------------------------------- */}
        {/* PREMIUM PROFILE HERO                                            */}
        {/* ---------------------------------------------------------------- */}

        <section
          className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0d12]/95 p-5 shadow-2xl md:p-8 ${prestigeAuraClass(prestige)}`}
        >
          {/* animated background layers */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-neon-soft blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
                backgroundSize:
                  "32px 32px",
              }}
            />

            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">

            {/* AVATAR */}
            <div className="relative mx-auto lg:mx-0">
              <div className="absolute inset-[-14px] rounded-full border border-neon/20 animate-ping" />
              <div className="absolute inset-[-7px] rounded-full border border-neon/30 animate-spin [animation-duration:8s]" />

              <div className="relative rounded-full p-1.5 bg-black/50 shadow-[0_0_50px_rgba(94,234,212,.18)]">
                <PlayerAvatar
                  photoPath={
                    p.photo_url
                  }
                  name={
                    p.ign
                  }
                  size={
                    132
                  }
                  className="rounded-full ring-2 ring-white/10"
                />

                <div className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full border-2 border-[#0c0d12] bg-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>
            </div>

            {/* IDENTITY */}
            <div className="min-w-0 text-center lg:text-left">
              <div className="text-[10px] uppercase tracking-[0.28em] text-neon">
                {p.role}
              </div>

              <h1 className="mt-1 truncate font-display text-4xl md:text-6xl gradient-text">
                {p.ign}
              </h1>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
                {p.uid && (
                  <span>
                    UID{" "}
                    {p.uid}
                  </span>
                )}

                {p.uid && (
                  <span>
                    •
                  </span>
                )}

                <span>
                  Joined{" "}
                  {new Date(
                    p.join_date,
                  ).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">

                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${ratingClass(
                    perfRating,
                  )}`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {perfRating}
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold">
                  <Medal className="h-3.5 w-3.5 text-neon" />
                  {unlocked.length}/
                  {ACHIEVEMENT_COUNT}
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-neon" />
                  {
                    PRESTIGE_LABEL[
                      prestige
                    ]
                  }
                </div>
              </div>

              {/* BEHAVIOUR */}
              <div
                className={`mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border px-4 py-3 ${behaviour.className}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20">
                  <behaviour.icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 text-left">
                  <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">
                    Behaviour Tag
                  </div>

                  <div className="mt-0.5 truncate text-sm font-black tracking-[0.08em]">
                    {behaviour.label}
                  </div>

                  <div className="mt-0.5 text-[10px] opacity-70">
                    {behaviour.description}
                  </div>
                </div>
              </div>
            </div>

            {/* MERIT / ANALYTICS */}
            <div className="flex flex-col items-center gap-3 lg:items-end">
              <div className="text-center lg:text-right">
                <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                  Achievement Score
                </div>

                <div className="mt-1 font-display text-4xl tabular-nums text-neon">
                  {score}
                </div>
              </div>

              <Button
                onClick={() =>
                  setAnalyticsOpen(
                    true,
                  )
                }
                className="rounded-xl bg-neon text-black shadow-[0_0_30px_rgba(94,234,212,.2)] hover:bg-neon/90"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Player Analytics
              </Button>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* PERIOD CONTROLS                                                  */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle
            value={period}
            onChange={
              setPeriod
            }
            monthKey={
              monthKey
            }
          />

          <MonthFilter
            value={period}
            onChange={
              setPeriod
            }
            months={
              months
            }
          />

          <span className="text-xs text-muted-foreground">
            {periodLabel(
              period,
            )}
          </span>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* CAREER STATS                                                      */}
        {/* ---------------------------------------------------------------- */}

        <section
          key={period}
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 stagger"
        >
          <StatCard
            label="Tournaments"
            value={
              metrics.tournaments
            }
            icon={
              <Trophy className="h-4 w-4" />
            }
          />

          <StatCard
            label="Matches"
            value={
              metrics.matches
            }
            icon={
              <Swords className="h-4 w-4" />
            }
          />

          <StatCard
            label="Career Kills"
            value={
              formatNumber(
                metrics.kills,
              )
            }
            icon={
              <Flame className="h-4 w-4" />
            }
          />

          <StatCard
            label="Total Damage"
            value={
              formatNumber(
                metrics.damage,
              )
            }
            icon={
              <Zap className="h-4 w-4" />
            }
          />

          <StatCard
            label="Assists"
            value={
              metrics.assists
            }
            icon={
              <Target className="h-4 w-4" />
            }
          />

          <StatCard
            label="Avg Kills"
            value={
              metrics.avgKills.toFixed(
                2,
              )
            }
            icon={
              <Target className="h-4 w-4" />
            }
          />

          <StatCard
            label="Best Kills"
            value={
              metrics.bestKills
            }
            icon={
              <Flame className="h-4 w-4" />
            }
            accent
          />

          <StatCard
            label="Best Damage"
            value={
              formatNumber(
                metrics.bestDamage,
              )
            }
            icon={
              <Zap className="h-4 w-4" />
            }
          />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* MVP + AVG SNAPSHOT                                                */}
        {/* ---------------------------------------------------------------- */}

        <section className="grid gap-3 md:grid-cols-3">

          <div className="rounded-2xl border border-neon/20 bg-neon-soft p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neon">
              <Award className="h-4 w-4" />
              Tournament MVP
            </div>

            <div className="mt-3 font-display text-4xl text-foreground">
              {mvps}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              MVP awards in{" "}
              {periodLabel(
                period,
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-neon" />
              Recent Form
            </div>

            <div className="mt-3 font-display text-4xl text-foreground">
              {analytics.recentAvgKills.toFixed(
                2,
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              avg kills · last{" "}
              {analytics.recentMatches}{" "}
              matches
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Gauge className="h-4 w-4 text-neon" />
              Consistency
            </div>

            <div className="mt-3 font-display text-4xl text-foreground">
              {analytics.killConsistency.toFixed(
                0,
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              individual kill consistency
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* PERFORMANCE TREND                                                 */}
        {/* ---------------------------------------------------------------- */}

        <section className="rounded-[2rem] border border-white/10 bg-[#0c0d12]/85 p-4 shadow-xl md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
                Match-by-Match
              </div>

              <h2 className="mt-1 font-display text-2xl">
                Performance Trend
              </h2>
            </div>

            <Activity className="h-5 w-5 text-neon" />
          </div>

          {trend.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No match data yet.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={trend}
                  margin={{
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.05)"
                  />

                  <XAxis
                    dataKey="x"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                  />

                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                  />

                  <Tooltip
                    contentStyle={{
                      background:
                        "rgba(10,10,16,.96)",
                      border:
                        "1px solid rgba(255,255,255,.1)",
                      borderRadius:
                        14,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="kills"
                    stroke="var(--neon)"
                    strokeWidth={3}
                    dot={{
                      r: 3,
                    }}
                    activeDot={{
                      r: 6,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="assists"
                    stroke="rgba(96,165,250,.9)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* ACHIEVEMENTS                                                       */}
        {/* ---------------------------------------------------------------- */}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Medal className="h-4 w-4 text-neon" />
              Achievements ·{" "}
              {unlocked.length} unlocked
            </h2>

            <button
              onClick={() =>
                setShowAll(
                  (value) =>
                    !value,
                )
              }
              className="text-xs text-neon hover:underline"
            >
              {showAll
                ? "Show unlocked only"
                : `Show all ${ACHIEVEMENT_COUNT}`}
            </button>
          </div>

          {shownAchievements.length ===
          0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
              No achievements unlocked in{" "}
              {periodLabel(
                period,
              )} yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {shownAchievements.map(
                (
                  achievement,
                  index,
                ) => (
                  <AchievementBadge
                    key={
                      achievement.id
                    }
                    a={
                      achievement
                    }
                    index={
                      index
                    }
                  />
                ),
              )}
            </div>
          )}

          {!showAll &&
            nextUp.length >
              0 && (
              <>
                <div className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Closest to unlocking
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {nextUp.map(
                    (
                      achievement,
                      index,
                    ) => (
                      <AchievementBadge
                        key={
                          achievement.id
                        }
                        a={
                          achievement
                        }
                        index={
                          index
                        }
                      />
                    ),
                  )}
                </div>
              </>
            )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* TOURNAMENT HISTORY                                                */}
        {/* ---------------------------------------------------------------- */}

        <section className="pb-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Trophy className="h-4 w-4 text-neon" />
            Tournament History
            {mvps > 0 && (
              <span className="text-neon">
                · {mvps} MVP
              </span>
            )}
          </h2>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentTournaments.map(
              (
                tournament,
              ) => (
                <Link
                  key={
                    tournament.id
                  }
                  to="/tournaments/$id"
                  params={{
                    id: tournament.id,
                  }}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-neon/30 hover:bg-neon-soft"
                >
                  <div className="font-bold truncate group-hover:text-neon transition-colors">
                    {
                      tournament.name
                    }
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(
                      tournament.date,
                    ).toLocaleDateString()}

                    {tournament.mvp_player_id ===
                      p.id && (
                      <span className="ml-2 text-neon">
                        · MVP
                      </span>
                    )}
                  </div>
                </Link>
              ),
            )}

            {!recentTournaments.length && (
              <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.02] py-10 text-center text-sm text-muted-foreground">
                No tournament history for{" "}
                {periodLabel(
                  period,
                )}.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FULL PLAYER ANALYTICS SLIDE                                        */}
      {/* ------------------------------------------------------------------ */}

      {analyticsOpen && (
        <div className="fixed inset-0 z-[100]">

          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() =>
              setAnalyticsOpen(
                false,
              )
            }
          />

          <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/10 bg-[#090a0f] shadow-2xl animate-in slide-in-from-right duration-500 md:max-w-3xl">

            {/* HEADER */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#090a0f]/90 px-5 py-4 backdrop-blur-xl md:px-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.25em] text-neon">
                    Player Only
                  </div>

                  <h2 className="font-display text-2xl">
                    Analytics ·{" "}
                    {p.ign}
                  </h2>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setAnalyticsOpen(
                      false,
                    )
                  }
                  className="rounded-xl"
                >
                  ×
                </Button>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-7">

              {/* KEY ANALYTICS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Avg Kills
                  </div>

                  <div className="mt-2 font-display text-3xl text-neon">
                    {metrics.avgKills.toFixed(
                      2,
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Avg Damage
                  </div>

                  <div className="mt-2 font-display text-3xl">
                    {formatNumber(
                      metrics.avgDamage,
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Avg Assists
                  </div>

                  <div className="mt-2 font-display text-3xl">
                    {(
                      metrics.assists /
                      Math.max(
                        1,
                        metrics.matches,
                      )
                    ).toFixed(
                      2,
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Matches
                  </div>

                  <div className="mt-2 font-display text-3xl">
                    {metrics.matches}
                  </div>
                </div>
              </div>

              {/* FORM */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
                  <TrendingUp className="h-4 w-4 text-neon" />
                  Recent Form
                </div>

                <div className="h-64">
                  {analytics.form.length >
                  0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          analytics.form
                        }
                      >
                        <CartesianGrid
                          stroke="rgba(255,255,255,.05)"
                        />

                        <XAxis
                          dataKey="match"
                          stroke="rgba(255,255,255,.35)"
                          fontSize={10}
                        />

                        <YAxis
                          stroke="rgba(255,255,255,.35)"
                          fontSize={10}
                        />

                        <Tooltip
                          contentStyle={{
                            background:
                              "rgba(10,10,16,.96)",
                            border:
                              "1px solid rgba(255,255,255,.1)",
                            borderRadius:
                              12,
                          }}
                        />

                        <Bar
                          dataKey="kills"
                          fill="var(--neon)"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-muted-foreground">
                      No analytics data yet.
                    </div>
                  )}
                </div>
              </section>

              {/* CONSISTENCY */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
                  <Gauge className="h-4 w-4 text-neon" />
                  Consistency
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                      Kills
                    </div>

                    <div className="mt-2 font-display text-2xl">
                      {analytics.killConsistency.toFixed(
                        0,
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                      Damage
                    </div>

                    <div className="mt-2 font-display text-2xl">
                      {analytics.damageConsistency.toFixed(
                        0,
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                      Assists
                    </div>

                    <div className="mt-2 font-display text-2xl">
                      {analytics.assistConsistency.toFixed(
                        0,
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* BEST MATCH */}
              {analytics.bestMatch && (
                <section className="relative overflow-hidden rounded-2xl border border-neon/20 bg-neon-soft p-5">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-neon/10 blur-2xl" />

                  <div className="relative">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neon">
                      <Flame className="h-4 w-4" />
                      Best Match
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                          Kills
                        </div>

                        <div className="mt-1 font-display text-3xl">
                          {
                            analytics
                              .bestMatch
                              .kills
                          }
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                          Damage
                        </div>

                        <div className="mt-1 font-display text-3xl">
                          {
                            analytics
                              .bestMatch
                              .damage
                          }
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                          Assists
                        </div>

                        <div className="mt-1 font-display text-3xl">
                          {
                            analytics
                              .bestMatch
                              .assists
                          }
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      {
                        analytics
                          .bestMatch
                          .tournament_name
                      }{" "}
                      · Match{" "}
                      {
                        analytics
                          .bestMatch
                          .match_number
                      }
                    </div>
                  </div>
                </section>
              )}

              {/* TOURNAMENT ANALYTICS */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
                  <Trophy className="h-4 w-4 text-neon" />
                  Tournament Performance
                </div>

                <div className="space-y-2">
                  {analytics.tournamentRows
                    .slice(
                      0,
                      8,
                    )
                    .map(
                      (
                        tournament,
                        index,
                      ) => (
                        <div
                          key={
                            tournament.id
                          }
                          className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-bold">
                              {index +
                                1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {
                                  tournament.name
                                }
                              </div>

                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {
                                  tournament.matches
                                }{" "}
                                matches
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-display text-xl text-neon">
                                {tournament.avgKills.toFixed(
                                  2,
                                )}
                              </div>

                              <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                                avg kills
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                            <span>
                              DMG{" "}
                              <b className="text-foreground">
                                {formatNumber(
                                  tournament.avgDamage,
                                )}
                              </b>
                            </span>

                            <span>
                              AST{" "}
                              <b className="text-foreground">
                                {tournament.avgAssists.toFixed(
                                  2,
                                )}
                              </b>
                            </span>

                            <span>
                              K{" "}
                              <b className="text-foreground">
                                {tournament.avgKills.toFixed(
                                  2,
                                )}
                              </b>
                            </span>
                          </div>
                        </div>
                      ),
                    )}

                  {!analytics.tournamentRows.length && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No tournament analytics yet.
                    </div>
                  )}
                </div>
              </section>

              {/* PROFILE FOOTER */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-neon" />
                  Analytics Scope
                </div>

                <p className="mt-2">
                  This panel uses only{" "}
                  <span className="text-foreground">
                    {p.ign}
                  </span>
                  's own recorded match statistics.
                  Team placement is not used for
                  individual performance analytics.
                </p>

                <p className="mt-2">
                  K/D will become a true K/D ratio once
                  deaths are available in the stored player
                  statistics.
                </p>
              </section>
            </div>
          </aside>
        </div>
      )}
    </Layout>
  );
}
