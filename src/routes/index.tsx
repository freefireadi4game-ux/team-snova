import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Swords, Flame, Crown, ArrowRight, Zap, Target, Activity } from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import snovaLogo from "@/assets/snova-logo.jpg.asset.json";
import {
  listPlayers,
  listTournaments,
  listAllStats,
  listRecentMatches,
  listLatestTournamentLeaderboard,
  sum,
} from "@/lib/data";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const stats = useQuery({ queryKey: ["all-stats"], queryFn: listAllStats });
  const recent = useQuery({ queryKey: ["recent-matches", 4], queryFn: () => listRecentMatches(4) });
  const latestTourBoard = useQuery({ queryKey: ["latest-tour-board"], queryFn: listLatestTournamentLeaderboard });

  const loading = players.isLoading || tournaments.isLoading || stats.isLoading;
  const activePlayers = players.data?.filter((p) => p.status === "active") ?? [];
  const totalTournaments = tournaments.data?.length ?? 0;
  const completed = tournaments.data?.filter((t) => t.status === "completed") ?? [];
  const totalMatches = stats.data ? new Set(stats.data.map((s) => s.match_id)).size : 0;
  const totalKills = sum(stats.data?.map((s) => s.kills) ?? []);
  const totalDamage = sum(stats.data?.map((s) => s.damage) ?? []);
  const killsPerTournament = totalTournaments ? (totalKills / totalTournaments).toFixed(1) : "0";
  const killsPerMatch = totalMatches ? (totalKills / totalMatches).toFixed(1) : "0";
  const latestCompleted = completed[0];
  const mvpPlayer = latestCompleted
    ? players.data?.find((p) => p.id === latestCompleted.mvp_player_id)
    : null;

  return (
    <Layout>
      {/* Hero */}
      <section className="rounded-2xl glass p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-2xl shrink-0">
            <img src={snovaLogo.url} alt="Snova Esports" className="h-full w-full object-cover" />
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
              Every kill. Every match. Every tournament. Follow the squad's rise across the
              competitive circuit.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/players"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                View Roster <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/tournaments"
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5"
              >
                Tournaments
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          : (
            <>
              <StatCard label="Tournaments" value={totalTournaments} icon={<Trophy className="h-4 w-4" />} />
              <StatCard label="Matches" value={totalMatches} icon={<Swords className="h-4 w-4" />} />
              <StatCard label="Team Kills" value={totalKills} icon={<Flame className="h-4 w-4" />} />
              <StatCard label="Team Damage" value={totalDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
              <StatCard label="Kills / Tournament" value={killsPerTournament} icon={<Target className="h-4 w-4" />} accent />
              <StatCard label="Kills / Match" value={killsPerMatch} icon={<Activity className="h-4 w-4" />} accent />
              <StatCard label="Active Players" value={activePlayers.length} icon={<Users className="h-4 w-4" />} />
              <StatCard
                label="Latest MVP"
                value={mvpPlayer?.ign ?? "—"}
                icon={<Crown className="h-4 w-4" />}
              />
            </>
          )}
      </section>

      {/* Latest match cards */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Latest Matches</h2>
            <div className="text-xs text-muted-foreground">Most recently logged match stats</div>
          </div>
          <Link to="/tournaments" className="text-xs text-neon hover:underline">All tournaments</Link>
        </div>
        {recent.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : recent.data && recent.data.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recent.data.map((m) => (
              <Link
                key={m.match_id}
                to="/tournaments/$id"
                params={{ id: m.tournament_id }}
                className="glass rounded-2xl p-4 hover:-translate-y-0.5 transition-transform"
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
                    <div className="font-display text-lg">{m.team_kills}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Dmg</div>
                    <div className="font-display text-lg">{(m.team_damage / 1000).toFixed(1)}k</div>
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
            No match stats logged yet.
          </div>
        )}
      </section>

      {/* Latest tournament overall leaderboard */}
      {latestTourBoard.data && latestTourBoard.data.rows.length > 0 && (
        <section className="mt-10 glass rounded-2xl p-4 md:p-6">
          <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Latest Tournament — Overall Leaderboard</h2>
              <div className="text-xs text-muted-foreground truncate">
                {latestTourBoard.data.tournament_name}
              </div>
            </div>
            <Link
              to="/tournaments/$id"
              params={{ id: latestTourBoard.data.tournament_id }}
              className="text-xs text-neon hover:underline"
            >
              View tournament
            </Link>
          </div>
          <div className="grid gap-2">
            {latestTourBoard.data.rows.map((r, i) => (
              <Link
                key={r.player_id}
                to="/players/$id"
                params={{ id: r.player_id }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-2.5"
              >
                <div className="font-mono text-neon w-6 text-center text-sm">{i + 1}</div>
                <PlayerAvatar photoPath={r.photo_url} name={r.ign} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">{r.ign}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {r.role} · {r.matches_played}m
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
        </section>
      )}


      {/* Roster preview */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold">Active Roster</h2>
          <Link to="/players" className="text-xs text-neon hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {activePlayers.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              to="/players/$id"
              params={{ id: p.id }}
              className="glass rounded-2xl p-4 group hover:-translate-y-0.5 transition-transform"
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
          <h2 className="text-xl md:text-2xl font-bold">Recent Tournaments</h2>
          <Link to="/tournaments" className="text-xs text-neon hover:underline">View all</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.data?.slice(0, 6).map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-transform"
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
          {!tournaments.data?.length && !loading && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-10">
              No tournaments yet.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
