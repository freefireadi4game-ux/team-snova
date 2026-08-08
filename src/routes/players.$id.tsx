import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Layout } from "@/components/Layout";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StatCard } from "@/components/StatCard";
import { AchievementBadge, prestigeAuraClass } from "@/components/AchievementBadge";
import { MonthFilter, PeriodToggle } from "@/components/PeriodControls";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayer, listTournaments, rating } from "@/lib/data";
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
import { Flame, Swords, Target, Zap, Trophy, TrendingUp, Medal, Sparkles } from "lucide-react";

export const Route = createFileRoute("/players/$id")({
  component: PlayerProfile,
});

function ratingClass(r: string) {
  return {
    Excellent: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    Good: "text-neon border-neon/40 bg-neon-soft",
    Average: "text-amber-400 border-amber-400/40 bg-amber-400/10",
    "Needs Improvement": "text-rose-400 border-rose-400/40 bg-rose-400/10",
  }[r] ?? "";
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const monthKey = currentMonthKey();
  const [period, setPeriod] = useState<Period>(OVERALL);
  const [showAll, setShowAll] = useState(false);

  const player = useQuery({ queryKey: ["player", id], queryFn: () => getPlayer(id) });
  const entries = useQuery({ queryKey: ["stat-entries"], queryFn: listStatEntries });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });

  const mine = useMemo(
    () => (entries.data ?? []).filter((e) => e.player_id === id),
    [entries.data, id],
  );
  const months = useMemo(() => availableMonths(mine), [mine]);
  const scoped = useMemo(() => filterByPeriod(mine, period), [mine, period]);
  const agg = useMemo(() => aggregateByPlayer(scoped).get(id), [scoped, id]);

  const mvps = useMemo(
    () =>
      (tournaments.data ?? []).filter(
        (t) => t.mvp_player_id === id && (period === OVERALL || String(t.date).slice(0, 7) === period),
      ).length,
    [tournaments.data, id, period],
  );

  const metrics = useMemo(() => toMetrics(agg, mvps), [agg, mvps]);
  const evaluated = useMemo(() => evaluateAchievements(metrics), [metrics]);
  const unlocked = useMemo(() => evaluated.filter((a) => a.unlocked), [evaluated]);
  const nextUp = useMemo(
    () =>
      evaluated
        .filter((a) => !a.unlocked)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 4),
    [evaluated],
  );
  const prestige = prestigeOf(unlocked.length);
  const score = achievementScore(evaluated);

  const played = useMemo(
    () => scoped.filter((e) => e.kills > 0 || e.damage > 0 || e.assists > 0),
    [scoped],
  );
  const trend = useMemo(
    () =>
      [...played]
        .sort((a, b) => (a.match_created_at < b.match_created_at ? -1 : 1))
        .map((r, i) => ({ x: i + 1, kills: r.kills, damage: r.damage })),
    [played],
  );

  if (player.isLoading) {
    return (
      <Layout>
        <Skeleton className="h-40 rounded-3xl" />
      </Layout>
    );
  }
  if (!player.data) throw notFound();

  const p = player.data;
  const perfRating = rating(metrics.avgKills);
  const tournamentIds = new Set(scoped.map((e) => e.tournament_id));
  const recentTournaments = (tournaments.data ?? []).filter((t) => tournamentIds.has(t.id)).slice(0, 6);
  const shownAchievements = showAll ? evaluated : unlocked;

  return (
    <Layout>
      <section
        className={`glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden animate-rise ${prestigeAuraClass(prestige)}`}
      >
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-neon-soft blur-3xl animate-float" />
        <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={128} className="shrink-0" />
        <div className="relative text-center md:text-left flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">{p.role}</div>
          <h1 className="font-display text-3xl md:text-5xl gradient-text truncate">{p.ign}</h1>
          <div className="mt-2 text-xs text-muted-foreground">
            {p.uid && <>UID {p.uid} · </>}
            Joined {new Date(p.join_date).toLocaleDateString()}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${ratingClass(perfRating)}`}>
              <TrendingUp className="h-3 w-3" /> {perfRating}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold">
              <Medal className="h-3 w-3 text-neon" /> {unlocked.length}/{ACHIEVEMENT_COUNT} achievements
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3 w-3 text-neon" /> {PRESTIGE_LABEL[prestige]} · {score} pts
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PeriodToggle value={period} onChange={setPeriod} monthKey={monthKey} />
        <MonthFilter value={period} onChange={setPeriod} months={months} />
        <span className="text-xs text-muted-foreground">{periodLabel(period)}</span>
      </div>

      <section key={period} className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger">
        <StatCard label="Tournaments" value={metrics.tournaments} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Matches" value={metrics.matches} icon={<Swords className="h-4 w-4" />} />
        <StatCard label="Total Kills" value={metrics.kills} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Total Damage" value={metrics.damage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Assists" value={metrics.assists} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Avg Kills" value={metrics.avgKills.toFixed(1)} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Best Kills" value={metrics.bestKills} icon={<Flame className="h-4 w-4" />} accent />
        <StatCard label="Best Damage" value={metrics.bestDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
      </section>

      <section className="mt-6 glass rounded-3xl p-4 md:p-6 animate-soft-in">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Performance Trend
        </h2>
        {trend.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">No match data yet.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="x" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="kills" stroke="var(--neon)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Achievements */}
      <section className="mt-6">
        <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Medal className="h-4 w-4 text-neon" /> Achievements · {unlocked.length} unlocked
          </h2>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-neon hover:underline"
          >
            {showAll ? "Show unlocked only" : `Show all ${ACHIEVEMENT_COUNT}`}
          </button>
        </div>
        {shownAchievements.length === 0 ? (
          <div className="glass a-up i-glow-edge rounded-2xl p-6 text-sm text-muted-foreground text-center">
            No achievements unlocked in {periodLabel(period)} yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {shownAchievements.map((a, i) => (
              <AchievementBadge key={a.id} a={a} index={i} />
            ))}
          </div>
        )}

        {!showAll && nextUp.length > 0 && (
          <>
            <div className="mt-6 mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Closest to unlocking
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {nextUp.map((a, i) => (
                <AchievementBadge key={a.id} a={a} index={i} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Tournaments {mvps > 0 && <span className="text-neon">· {mvps} MVP</span>}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 stagger">
          {recentTournaments.map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass a-up i-glow-edge rounded-2xl p-4 lift"
            >
              <div className="font-bold truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.date).toLocaleDateString()}
                {t.mvp_player_id === p.id && <span className="ml-2 text-neon">· MVP</span>}
              </div>
            </Link>
          ))}
          {!recentTournaments.length && (
            <div className="col-span-full text-sm text-muted-foreground text-center py-6">
              No tournament history for {periodLabel(period)}.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
