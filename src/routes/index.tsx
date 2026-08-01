import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, Users, Swords, Flame, Crown, ArrowRight, Zap, Target, Activity, Medal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PeriodToggle } from "@/components/PeriodControls";
import { Skeleton } from "@/components/ui/skeleton";
import snovaLogo from "@/assets/snova-logo.jpg.asset.json";
import { listPlayers, listTournaments, positionPoints } from "@/lib/data";
import {
  OVERALL,
  buildLeaderboard,
  currentMonthKey,
  filterByPeriod,
  listStatEntries,
  monthKeyOf,
  periodLabel,
  teamTotals,
  type Period,
} from "@/lib/stats-core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Team SNOVA ESP — Performance Dashboard" },
      {
        name: "description",
        content:
          "Live monthly and all-time performance dashboard for Team SNOVA ESP: kills, damage, points, leaderboards and achievements.",
      },
      { property: "og:title", content: "Team SNOVA ESP — Performance Dashboard" },
      {
        property: "og:description",
        content: "Monthly and all-time team stats, leaderboards and achievements for Team SNOVA ESP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const monthKey = currentMonthKey();
  const [period, setPeriod] = useState<Period>(monthKey);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const entries = useQuery({ queryKey: ["stat-entries"], queryFn: listStatEntries });

  const loading = players.isLoading || tournaments.isLoading || entries.isLoading;
  const activePlayers = players.data?.filter((p) => p.status === "active") ?? [];

  const scoped = useMemo(
    () => filterByPeriod(entries.data ?? [], period),
    [entries.data, period],
  );
  const totals = useMemo(() => teamTotals(scoped), [scoped]);
  const board = useMemo(
    () => buildLeaderboard(scoped, players.data ?? []),
    [scoped, players.data],
  );

  const scopedTournaments = useMemo(() => {
    const list = tournaments.data ?? [];
    if (period === OVERALL) return list;
    return list.filter((t) => String(t.date).slice(0, 7) === period);
  }, [tournaments.data, period]);

  const recent = useMemo(() => {
    const byMatch = new Map<
      string,
      { match_id: string; match_number: number; position: number | null; tournament_id: string; tournament_name: string; created_at: string; kills: number; damage: number }
    >();
    for (const e of scoped) {
      const cur =
        byMatch.get(e.match_id) ?? {
          match_id: e.match_id,
          match_number: e.match_number,
          position: e.position,
          tournament_id: e.tournament_id,
          tournament_name: e.tournament_name,
          created_at: e.match_created_at,
          kills: 0,
          damage: 0,
        };
      cur.kills += e.kills;
      cur.damage += e.damage;
      byMatch.set(e.match_id, cur);
    }
    return [...byMatch.values()]
      .filter((m) => m.kills > 0 || m.damage > 0)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 4)
      .map((m) => ({ ...m, points: positionPoints(m.position) + m.kills }));
  }, [scoped]);

  const latestCompleted = scopedTournaments.filter((t) => t.status === "completed")[0];
  const mvpPlayer = latestCompleted
    ? players.data?.find((p) => p.id === latestCompleted.mvp_player_id)
    : null;

  const monthsWithData = useMemo(
    () => new Set((entries.data ?? []).map(monthKeyOf)),
    [entries.data],
  );
  const monthEmpty = period !== OVERALL && !monthsWithData.has(period);

  return (
    <Layout>
      {/* Hero */}
      <section className="rounded-2xl glass p-6 md:p-10 mb-8 relative overflow-hidden animate-rise">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-2xl shrink-0">
            <img src={snovaLogo.url} alt="Team Snova Esp logo" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-neon">
              <Zap className="h-3 w-3" /> Live Team Dashboard
            </div>
            <h1 className="mt-3 text-4xl md:text-6xl font-display tracking-tight">
              <span className="gradient-text">Team Snova</span>
              <span className="text-muted-foreground italic"> Esp</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
              Every kill. Every match. Every tournament. The board resets each month — the all-time
              record never does.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/players"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                View Roster <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/achievements"
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5 lift"
              >
                <Medal className="h-4 w-4" /> Achievements
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Period switch */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-sm font-bold">{periodLabel(period)} Dashboard</div>
          <div className="text-xs text-muted-foreground">
            {period === OVERALL ? "Career totals since day one" : "Resets at the start of each month"}
          </div>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} monthKey={monthKey} />
      </div>

      {/* KPIs */}
      <section key={period} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : (
            <>
              <StatCard label="Tournaments" value={scopedTournaments.length} icon={<Trophy className="h-4 w-4" />} />
              <StatCard label="Matches" value={totals.matches} icon={<Swords className="h-4 w-4" />} />
              <StatCard label="Team Kills" value={totals.kills} icon={<Flame className="h-4 w-4" />} />
              <StatCard label="Team Damage" value={totals.damage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
              <StatCard label="Total Points" value={totals.points} icon={<Medal className="h-4 w-4" />} accent />
              <StatCard label="Kills / Tournament" value={totals.killsPerTournament.toFixed(1)} icon={<Target className="h-4 w-4" />} />
              <StatCard label="Kills / Match" value={totals.killsPerMatch.toFixed(1)} icon={<Activity className="h-4 w-4" />} />
              <StatCard label="Active Players" value={activePlayers.length} icon={<Users className="h-4 w-4" />} />
            </>
          )}
      </section>

      {monthEmpty && !loading && (
        <div className="mt-4 glass rounded-2xl p-4 text-sm text-muted-foreground animate-soft-in">
          Nothing logged in {periodLabel(period)} yet — a fresh month, a fresh board. Switch to
          <button onClick={() => setPeriod(OVERALL)} className="mx-1 text-neon hover:underline">All Time</button>
          to see the full record.
        </div>
      )}

      {/* Latest matches */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Latest Matches</h2>
            <div className="text-xs text-muted-foreground">{periodLabel(period)}</div>
          </div>
          <Link to="/tournaments" className="text-xs text-neon hover:underline">All tournaments</Link>
        </div>
        {entries.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : recent.length > 0 ? (
          <div key={period} className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
            {recent.map((m) => (
              <Link
                key={m.match_id}
                to="/tournaments/$id"
                params={{ id: m.tournament_id }}
                className="glass rounded-2xl p-4 lift"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-neon">Match {m.match_number}</span>
                  {m.position && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neon-soft text-neon">
                      #{m.position}
                    </span>
                  )}
                </div>
                <div className="mt-2 font-bold truncate text-sm">{m.tournament_name}</div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Kills</div>
                    <div className="font-display text-lg">{m.kills}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Dmg</div>
                    <div className="font-display text-lg">{(m.damage / 1000).toFixed(1)}k</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pts</div>
                    <div className="font-display text-lg text-neon">{m.points}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No match stats logged in {periodLabel(period)}.
          </div>
        )}
      </section>

      {/* Leaderboard for the selected period */}
      <section className="mt-10 glass rounded-2xl p-4 md:p-6">
        <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              {period === OVERALL ? "All-Time Leaderboard" : "Monthly Leaderboard"}
            </h2>
            <div className="text-xs text-muted-foreground truncate">
              {periodLabel(period)}
              {mvpPlayer && <span className="text-neon"> · Latest MVP {mvpPlayer.ign}</span>}
            </div>
          </div>
          <Link to="/stats" className="text-xs text-neon hover:underline">Full stats</Link>
        </div>
        {board.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No stats for {periodLabel(period)}.
          </div>
        ) : (
          <div key={period} className="grid gap-2 stagger">
            {board.map((r, i) => (
              <Link
                key={r.player_id}
                to="/players/$id"
                params={{ id: r.player_id }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-2.5"
              >
                <div className="font-mono text-neon w-6 text-center text-sm">{i + 1}</div>
                <PlayerAvatar photoPath={r.player.photo_url} name={r.player.ign} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">{r.player.ign}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {r.player.role} · {r.matches}m
                  </div>
                </div>
                <div className="text-right w-12">
                  <div className="font-display text-xl">{r.kills}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">K</div>
                </div>
                <div className="text-right w-12">
                  <div className="font-display text-base">{r.assists}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">A</div>
                </div>
                <div className="text-right w-16 hidden sm:block">
                  <div className="font-display text-sm">{r.damage.toLocaleString()}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">dmg</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Roster preview */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold">Active Roster</h2>
          <Link to="/players" className="text-xs text-neon hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
          {activePlayers.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              to="/players/$id"
              params={{ id: p.id }}
              className="glass rounded-2xl p-4 group lift"
            >
              <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={64} className="mx-auto glow" />
              <div className="mt-3 text-center">
                <div className="font-bold truncate">{p.ign}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{p.role}</div>
              </div>
            </Link>
          ))}
          {!activePlayers.length && !loading && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-10">
              No players yet. Admin can add players from the admin panel.
            </div>
          )}
        </div>
      </section>

      {/* Recent tournaments */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold">Tournaments</h2>
          <Link to="/tournaments" className="text-xs text-neon hover:underline">View all</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 stagger">
          {scopedTournaments.slice(0, 6).map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass rounded-2xl p-5 lift"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${
                    t.status === "completed"
                      ? "bg-neon-soft text-neon"
                      : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {t.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.date).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 font-bold text-lg truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t.organizer ?? "—"} · {t.num_matches} matches
              </div>
            </Link>
          ))}
          {!scopedTournaments.length && !loading && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-10">
              No tournaments in {periodLabel(period)}.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
