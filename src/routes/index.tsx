import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Swords, Flame, Crown, ArrowRight, Zap } from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listPlayers,
  listTournaments,
  listAllStats,
  sum,
} from "@/lib/data";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const stats = useQuery({ queryKey: ["all-stats"], queryFn: listAllStats });

  const loading = players.isLoading || tournaments.isLoading || stats.isLoading;
  const activePlayers = players.data?.filter((p) => p.status === "active") ?? [];
  const totalTournaments = tournaments.data?.length ?? 0;
  const completed = tournaments.data?.filter((t) => t.status === "completed") ?? [];
  const totalMatches = stats.data ? new Set(stats.data.map((s) => s.match_id)).size : 0;
  const totalKills = sum(stats.data?.map((s) => s.kills) ?? []);
  const totalDamage = sum(stats.data?.map((s) => s.damage) ?? []);
  const latestCompleted = completed[0];
  const mvpPlayer = latestCompleted
    ? players.data?.find((p) => p.id === latestCompleted.mvp_player_id)
    : null;

  return (
    <Layout>
      {/* Hero */}
      <section className="rounded-2xl glass p-6 md:p-10 mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-neon">
          <Zap className="h-3 w-3" /> Live Team Dashboard
        </div>
        <h1 className="mt-4 text-5xl md:text-7xl font-display tracking-tight">
          <span className="gradient-text">Team Snova</span>
          <span className="text-muted-foreground italic"> Esp</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
          Every kill. Every match. Every tournament. Follow the squad's rise across the
          competitive circuit.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
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
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          : (
            <>
              <StatCard label="Tournaments" value={totalTournaments} icon={<Trophy className="h-4 w-4" />} />
              <StatCard label="Matches" value={totalMatches} icon={<Swords className="h-4 w-4" />} />
              <StatCard label="Team Kills" value={totalKills} icon={<Flame className="h-4 w-4" />} />
              <StatCard label="Team Damage" value={totalDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
              <StatCard label="Active Players" value={activePlayers.length} icon={<Users className="h-4 w-4" />} />
              <StatCard
                label="Latest MVP"
                value={mvpPlayer?.ign ?? "—"}
                icon={<Crown className="h-4 w-4" />}
                accent
              />
            </>
          )}
      </section>

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
