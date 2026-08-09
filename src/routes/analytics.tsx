import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { MonthFilter, PeriodToggle } from "@/components/PeriodControls";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listPlayers, listTournaments } from "@/lib/data";
import {
  OVERALL,
  availableMonths,
  buildLeaderboard,
  currentMonthKey,
  filterByPeriod,
  listStatEntries,
  periodLabel,
  teamTotals,
  type Period,
} from "@/lib/stats-core";
import {
  killShare,
  placementSpread,
  slotStrength,
  teamInsights,
  tournamentTrend,
} from "@/lib/analytics-core";
import {
  Flame,
  Zap,
  Swords,
  Target,
  Trophy,
  Crown,
  Medal,
  Activity,
  TrendingUp,
  TrendingDown,
  Gauge,
  PieChart as PieIcon,
  Timer,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Deep esports analytics for SNOVA ESP: per-match-number strength, placement spread, points trends, kill share and monthly leaderboards.",
      },
      { property: "og:title", content: "Analytics — Team SNOVA ESP" },
      {
        property: "og:description",
        content: "Match-slot strength, placement spread, momentum and leaderboards for SNOVA ESP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function Panel({
  title,
  icon,
  hint,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass a-up i-glow-edge rounded-2xl p-4 md:p-6 min-w-0 ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {hint && <span className="text-[10px] text-muted-foreground/80 text-right">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function AnalyticsPage() {
  const monthKey = currentMonthKey();
  const [period, setPeriod] = useState<Period>(monthKey);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const entries = useQuery({ queryKey: ["stat-entries"], queryFn: listStatEntries });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });

  const loading = players.isLoading || entries.isLoading || tournaments.isLoading;
  const months = useMemo(() => availableMonths(entries.data ?? []), [entries.data]);
  const scoped = useMemo(() => filterByPeriod(entries.data ?? [], period), [entries.data, period]);
  const totals = useMemo(() => teamTotals(scoped), [scoped]);
  const rows = useMemo(() => buildLeaderboard(scoped, players.data ?? []), [scoped, players.data]);

  const slots = useMemo(() => slotStrength(scoped), [scoped]);
  const spread = useMemo(() => placementSpread(scoped), [scoped]);
  const trend = useMemo(() => tournamentTrend(scoped), [scoped]);
  const shares = useMemo(() => killShare(scoped, players.data ?? []), [scoped, players.data]);
  const insights = useMemo(() => teamInsights(scoped), [scoped]);

  const scopedTournaments = useMemo(() => {
    const list = tournaments.data ?? [];
    if (period === OVERALL) return list;
    return list.filter((t) => String(t.date).slice(0, 7) === period);
  }, [tournaments.data, period]);

  const bestAvg = Math.max(1, ...slots.map((s) => s.avgPoints));

  return (
    <Layout>
      <div className="mb-6 animate-rise">
        <h1 className="a-slide-blur font-display text-3xl md:text-4xl gradient-text">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Numbers from every scrim — where we peak, where we drop, and who carries.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodToggle value={period} onChange={setPeriod} monthKey={monthKey} />
        <MonthFilter value={period} onChange={setPeriod} months={months} />
        <Link to="/achievements" className="text-xs text-neon hover:underline inline-flex items-center gap-1">
          <Medal className="h-3.5 w-3.5" /> Achievements
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section key={period} className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger items-stretch">
            <StatCard label="Tournaments" value={scopedTournaments.length} icon={<Trophy className="h-4 w-4" />} />
            <StatCard label="Matches" value={totals.matches} icon={<Swords className="h-4 w-4" />} />
            <StatCard label="Team Kills" value={totals.kills} icon={<Flame className="h-4 w-4" />} accent />
            <StatCard label="Team Damage" value={totals.damage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
            <StatCard label="Avg Points / Match" value={insights.avgPoints.toFixed(1)} icon={<Activity className="h-4 w-4" />} />
            <StatCard
              label="Avg Placement"
              value={insights.avgPosition ? `#${insights.avgPosition.toFixed(1)}` : "—"}
              icon={<Target className="h-4 w-4" />}
            />
            <StatCard label="Consistency" value={`${insights.consistency.toFixed(0)}%`} icon={<Gauge className="h-4 w-4" />} />
            <StatCard
              label="Momentum"
              value={
                <span className={insights.momentum >= 0 ? "text-neon" : "text-destructive"}>
                  {insights.momentum >= 0 ? "+" : ""}
                  {insights.momentum.toFixed(0)}%
                </span>
              }
              icon={insights.momentum >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            />
          </section>

          {/* Quick verdicts */}
          <section className="mt-4 grid gap-3 md:grid-cols-3 stagger items-stretch">
            <div className="glass a-up rounded-2xl p-4">
              <div className="label-eyebrow flex items-center gap-1">
                <Timer className="h-3 w-3" /> Strongest Match Slot
              </div>
              <div className="mt-2 font-display text-2xl">
                {insights.bestSlot ? `Match #${insights.bestSlot.match_number}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {insights.bestSlot
                  ? `${insights.bestSlot.avgPoints.toFixed(1)} pts avg · ${insights.bestSlot.matches} played`
                  : "No data"}
              </div>
            </div>
            <div className="glass a-up rounded-2xl p-4">
              <div className="label-eyebrow flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Weakest Match Slot
              </div>
              <div className="mt-2 font-display text-2xl">
                {insights.worstSlot ? `Match #${insights.worstSlot.match_number}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {insights.worstSlot
                  ? `${insights.worstSlot.avgPoints.toFixed(1)} pts avg · needs focus`
                  : "No data"}
              </div>
            </div>
            <div className="glass a-up rounded-2xl p-4">
              <div className="label-eyebrow flex items-center gap-1">
                <Crown className="h-3 w-3" /> Best Match Ever
              </div>
              <div className="mt-2 font-display text-2xl">
                {insights.bestMatch ? `${insights.bestMatch.points} pts` : "—"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {insights.bestMatch
                  ? `${insights.bestMatch.tournament_name} · M${insights.bestMatch.match_number}${
                      insights.bestMatch.position ? ` · #${insights.bestMatch.position}` : ""
                    }`
                  : "No data"}
              </div>
            </div>
          </section>

          {/* Slot strength */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2 items-stretch">
            <Panel
              title="Match-Slot Strength"
              icon={<Activity className="h-4 w-4 text-neon" />}
              hint="Avg points per match number across all scrims"
            >
              {slots.length === 0 ? (
                <Empty label={periodLabel(period)} />
              ) : (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slots.map((s) => ({ name: `M${s.match_number}`, pts: +s.avgPoints.toFixed(2) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="currentColor" fontSize={11} />
                        <YAxis stroke="currentColor" fontSize={11} width={28} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="pts" radius={[6, 6, 0, 0]}>
                          {slots.map((s) => (
                            <Cell
                              key={s.match_number}
                              fill={s.avgPoints >= bestAvg * 0.95 ? "var(--chart-1)" : "var(--chart-5)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/5 hover:bg-transparent">
                          <TableHead>Match</TableHead>
                          <TableHead className="text-right">Played</TableHead>
                          <TableHead className="text-right">Avg Pts</TableHead>
                          <TableHead className="text-right">Avg Kills</TableHead>
                          <TableHead className="text-right">Avg Pos</TableHead>
                          <TableHead className="text-right">Wins</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slots.map((s) => (
                          <TableRow key={s.match_number} className="border-white/5">
                            <TableCell className="font-mono text-neon">M{s.match_number}</TableCell>
                            <TableCell className="text-right">{s.matches}</TableCell>
                            <TableCell className="text-right font-bold">{s.avgPoints.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{s.avgKills.toFixed(1)}</TableCell>
                            <TableCell className="text-right">
                              {s.avgPosition ? `#${s.avgPosition.toFixed(1)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right">{s.wins}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Panel>

            <Panel
              title="Placement Spread"
              icon={<Target className="h-4 w-4 text-neon" />}
              hint={`Win rate ${insights.winRate.toFixed(0)}% · Top 3 ${insights.top3Rate.toFixed(0)}%`}
            >
              {spread.length === 0 ? (
                <Empty label={periodLabel(period)} />
              ) : (
                <div className="space-y-2">
                  {spread.map((b) => (
                    <div key={b.position} className="flex items-center gap-3">
                      <div className="w-10 shrink-0 font-mono text-xs text-neon">#{b.position}</div>
                      <div className="h-2.5 flex-1 min-w-0 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--chart-5)] to-[var(--chart-1)] transition-all duration-700"
                          style={{ width: `${Math.max(4, b.share)}%` }}
                        />
                      </div>
                      <div className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {b.count} · {b.share.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <MiniStat label="Placement Pts" value={insights.survivalPoints} />
                    <MiniStat label="Kill Pts" value={insights.killPoints} />
                    <MiniStat label="Dmg / Kill" value={insights.damagePerKill.toFixed(0)} />
                    <MiniStat label="Players Used" value={insights.activePlayers} />
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* Trend + kill share */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2 items-stretch">
            <Panel
              title="Points Trend"
              icon={<TrendingUp className="h-4 w-4 text-neon" />}
              hint="Avg points per match, tournament by tournament"
            >
              {trend.length === 0 ? (
                <Empty label={periodLabel(period)} />
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trend.map((t) => ({
                        name: t.name.length > 12 ? `${t.name.slice(0, 12)}…` : t.name,
                        avg: +t.avgPoints.toFixed(2),
                        kills: t.kills,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="currentColor" fontSize={10} />
                      <YAxis stroke="currentColor" fontSize={11} width={28} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Line type="monotone" dataKey="avg" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="kills" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel
              title="Kill Share"
              icon={<PieIcon className="h-4 w-4 text-neon" />}
              hint="Who contributes the team's frags"
            >
              {shares.length === 0 ? (
                <Empty label={periodLabel(period)} />
              ) : (
                <div className="space-y-3">
                  {shares.map((s) => (
                    <div key={s.player.id} className="flex items-center gap-3">
                      <PlayerAvatar photoPath={s.player.photo_url} name={s.player.ign} size={30} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{s.player.ign}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {s.kills} · {s.share.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-2)] transition-all duration-700"
                            style={{ width: `${Math.max(3, s.share)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel
        title={`Player Leaderboard · ${periodLabel(period)}`}
        icon={<Crown className="h-4 w-4 text-neon" />}
        className="mt-4 overflow-x-auto"
      >
        {rows.length === 0 ? (
          <Empty label={periodLabel(period)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Kills</TableHead>
                <TableHead className="text-right">Assists</TableHead>
                <TableHead className="text-right">Avg K</TableHead>
                <TableHead className="text-right">Best</TableHead>
                <TableHead className="text-right">Damage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.player_id} className="border-white/5">
                  <TableCell className="font-mono text-neon">{i + 1}</TableCell>
                  <TableCell>
                    <Link to="/players/$id" params={{ id: r.player_id }} className="flex items-center gap-2 hover:text-neon">
                      <PlayerAvatar photoPath={r.player.photo_url} name={r.player.ign} size={28} />
                      <span className="font-semibold truncate">{r.player.ign}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.matches}</TableCell>
                  <TableCell className="text-right font-bold">{r.kills}</TableCell>
                  <TableCell className="text-right">{r.assists}</TableCell>
                  <TableCell className="text-right">{(r.kills / r.matches).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{r.bestKills}</TableCell>
                  <TableCell className="text-right">{r.damage.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <section key={`h-${period}`} className="mt-4 grid gap-3 md:grid-cols-3 stagger items-stretch">
        {rows[0] && (
          <HeroCard
            icon={<Flame className="h-3 w-3" />}
            label="Top Fragger"
            row={rows[0]}
            detail={`${rows[0].kills} kills`}
            accent
          />
        )}
        {rows.length > 0 &&
          (() => {
            const dmg = [...rows].sort((a, b) => b.damage - a.damage)[0];
            return (
              <HeroCard
                icon={<Zap className="h-3 w-3" />}
                label="Damage Leader"
                row={dmg}
                detail={`${dmg.damage.toLocaleString()} dmg`}
              />
            );
          })()}
        {rows.length > 0 &&
          (() => {
            const best = [...rows].sort((a, b) => b.bestKills - a.bestKills)[0];
            return (
              <HeroCard
                icon={<Target className="h-3 w-3" />}
                label="Best Match"
                row={best}
                detail={`${best.bestKills} kills in a match`}
              />
            );
          })()}
      </section>
    </Layout>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">No data logged for {label}.</div>;
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="label-eyebrow truncate">{label}</div>
      <div className="stat-num mt-1 text-lg">{value}</div>
    </div>
  );
}

function HeroCard({
  icon,
  label,
  row,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  row: { player: { photo_url: string | null; ign: string } };
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`glass a-up i-glow-edge flex items-center gap-3 rounded-2xl p-4 ${accent ? "neon-border" : ""}`}
    >
      <PlayerAvatar photoPath={row.player.photo_url} name={row.player.ign} size={52} className="shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-neon">
          {icon} {label}
        </div>
        <div className="truncate font-bold">{row.player.ign}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
