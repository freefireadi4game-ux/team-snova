import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
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
  listAllStats,
  listPlayers,
  listTournaments,
  sum,
} from "@/lib/data";
import { Flame, Zap, Swords, Target, Trophy, Crown } from "lucide-react";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Team SNOVA ESP" },
      { name: "description", content: "Career stats and leaderboards for every SNOVA ESP player." },
      { property: "og:title", content: "Stats — Team SNOVA ESP" },
      { property: "og:description", content: "Career stats and leaderboards for every SNOVA ESP player." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const stats = useQuery({ queryKey: ["all-stats"], queryFn: listAllStats });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });

  const loading = players.isLoading || stats.isLoading || tournaments.isLoading;

  const perPlayer = new Map<string, { kills: number; damage: number; matches: number; best: number }>();
  for (const s of stats.data ?? []) {
    const cur = perPlayer.get(s.player_id) ?? { kills: 0, damage: 0, matches: 0, best: 0 };
    cur.kills += s.kills;
    cur.damage += s.damage;
    cur.matches += 1;
    if (s.kills > cur.best) cur.best = s.kills;
    perPlayer.set(s.player_id, cur);
  }
  const rows = (players.data ?? [])
    .filter((p) => perPlayer.has(p.id))
    .map((p) => ({ p, ...perPlayer.get(p.id)! }))
    .sort((a, b) => b.kills - a.kills);

  const totalKills = sum([...perPlayer.values()].map((v) => v.kills));
  const totalDamage = sum([...perPlayer.values()].map((v) => v.damage));
  const totalMatches = stats.data ? new Set(stats.data.map((s) => s.match_id)).size : 0;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black gradient-text">Career Stats</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every kill, every match — the full story.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Tournaments" value={tournaments.data?.length ?? 0} icon={<Trophy className="h-4 w-4" />} />
          <StatCard label="Matches" value={totalMatches} icon={<Swords className="h-4 w-4" />} />
          <StatCard label="Team Kills" value={totalKills} icon={<Flame className="h-4 w-4" />} accent />
          <StatCard label="Team Damage" value={totalDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        </section>
      )}

      <section className="mt-8 glass rounded-2xl p-4 md:p-6 overflow-x-auto">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-neon" /> Player Leaderboard
        </h2>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">No stats logged yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Kills</TableHead>
                <TableHead className="text-right">Avg K</TableHead>
                <TableHead className="text-right">Best</TableHead>
                <TableHead className="text-right">Damage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.p.id} className="border-white/5">
                  <TableCell className="font-mono text-neon">{i + 1}</TableCell>
                  <TableCell>
                    <Link to="/players/$id" params={{ id: r.p.id }} className="flex items-center gap-2 hover:text-neon">
                      <PlayerAvatar photoPath={r.p.photo_url} name={r.p.ign} size={28} />
                      <span className="font-semibold truncate">{r.p.ign}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.matches}</TableCell>
                  <TableCell className="text-right font-bold">{r.kills}</TableCell>
                  <TableCell className="text-right">{(r.kills / r.matches).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{r.best}</TableCell>
                  <TableCell className="text-right">{r.damage.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {rows[0] && (
          <div className="glass rounded-2xl p-4 flex items-center gap-3 neon-border">
            <PlayerAvatar photoPath={rows[0].p.photo_url} name={rows[0].p.ign} size={52} className="glow shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Flame className="h-3 w-3" /> Top Fragger</div>
              <div className="font-bold truncate">{rows[0].p.ign}</div>
              <div className="text-xs text-muted-foreground">{rows[0].kills} kills</div>
            </div>
          </div>
        )}
        {rows.length > 0 && (() => {
          const dmg = [...rows].sort((a, b) => b.damage - a.damage)[0];
          return (
            <div className="glass rounded-2xl p-4 flex items-center gap-3">
              <PlayerAvatar photoPath={dmg.p.photo_url} name={dmg.p.ign} size={52} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Zap className="h-3 w-3" /> Damage Leader</div>
                <div className="font-bold truncate">{dmg.p.ign}</div>
                <div className="text-xs text-muted-foreground">{dmg.damage.toLocaleString()} dmg</div>
              </div>
            </div>
          );
        })()}
        {rows.length > 0 && (() => {
          const best = [...rows].sort((a, b) => b.best - a.best)[0];
          return (
            <div className="glass rounded-2xl p-4 flex items-center gap-3">
              <PlayerAvatar photoPath={best.p.photo_url} name={best.p.ign} size={52} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Target className="h-3 w-3" /> Best Match</div>
                <div className="font-bold truncate">{best.p.ign}</div>
                <div className="text-xs text-muted-foreground">{best.best} kills in a match</div>
              </div>
            </div>
          );
        })()}
      </section>
    </Layout>
  );
}
