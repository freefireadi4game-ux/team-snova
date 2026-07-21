import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPlayer,
  listStatsForPlayer,
  listTournaments,
  sum,
  avg,
  rating,
} from "@/lib/data";
import { Flame, Swords, Target, Zap, Trophy, TrendingUp } from "lucide-react";

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
  const player = useQuery({ queryKey: ["player", id], queryFn: () => getPlayer(id) });
  const stats = useQuery({ queryKey: ["player-stats", id], queryFn: () => listStatsForPlayer(id) });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });

  if (player.isLoading) {
    return (
      <Layout>
        <Skeleton className="h-40 rounded-3xl" />
      </Layout>
    );
  }
  if (!player.data) throw notFound();

  const p = player.data;
  const rows = (stats.data ?? []) as Array<{
    kills: number;
    damage: number;
    match_id: string;
    matches: { match_number: number; tournament_id: string; created_at: string } | null;
  }>;

  const kills = rows.map((r) => r.kills);
  const damage = rows.map((r) => r.damage);
  const matchesPlayed = rows.length;
  const highestKill = Math.max(0, ...kills);
  const highestDamage = Math.max(0, ...damage);
  const totalKills = sum(kills);
  const totalDamage = sum(damage);
  const avgKills = avg(kills);
  const avgDamage = avg(damage);
  const perfRating = rating(avgKills);

  const tournamentIds = new Set(rows.map((r) => r.matches?.tournament_id).filter(Boolean));
  const totalTournaments = tournamentIds.size;
  const mvps = tournaments.data?.filter((t) => t.mvp_player_id === p.id).length ?? 0;

  const trend = [...rows]
    .filter((r) => r.matches)
    .sort((a, b) => (a.matches!.created_at < b.matches!.created_at ? -1 : 1))
    .map((r, i) => ({ x: i + 1, kills: r.kills, damage: r.damage }));

  const recentTournaments = (tournaments.data ?? [])
    .filter((t) => tournamentIds.has(t.id))
    .slice(0, 6);

  return (
    <Layout>
      <section className="glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-neon-soft blur-3xl" />
        <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={128} className="glow animate-pulse-neon" />
        <div className="relative text-center md:text-left flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">{p.role}</div>
          <h1 className="text-3xl md:text-5xl font-black gradient-text truncate">{p.ign}</h1>
          <div className="mt-2 text-xs text-muted-foreground">
            {p.uid && <>UID {p.uid} · </>}
            Joined {new Date(p.join_date).toLocaleDateString()}
          </div>
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${ratingClass(perfRating)}`}>
            <TrendingUp className="h-3 w-3" /> {perfRating}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Tournaments" value={totalTournaments} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Matches" value={matchesPlayed} icon={<Swords className="h-4 w-4" />} />
        <StatCard label="Total Kills" value={totalKills} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Total Damage" value={totalDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Avg Kills" value={avgKills.toFixed(1)} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Avg Damage" value={Math.round(avgDamage).toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Best Kills" value={highestKill} icon={<Flame className="h-4 w-4" />} accent />
        <StatCard label="Best Damage" value={highestDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
      </section>

      <section className="mt-6 glass rounded-3xl p-4 md:p-6">
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
                <Line
                  type="monotone"
                  dataKey="kills"
                  stroke="oklch(0.78 0.22 230)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Recent Tournaments {mvps > 0 && <span className="text-neon">· {mvps} MVP</span>}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {recentTournaments.map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass rounded-2xl p-4 hover:-translate-y-0.5 transition-transform"
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
              No tournament history.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
