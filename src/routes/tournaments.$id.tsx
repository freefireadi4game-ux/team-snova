import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar, TournamentImage } from "@/components/PlayerAvatar";
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
  getTournament,
  listAchievements,
  listPlayers,
  listStatsForTournament,
  sum,
} from "@/lib/data";
import { Crown, Flame, Swords, Zap, Medal } from "lucide-react";

export const Route = createFileRoute("/tournaments/$id")({
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const t = useQuery({ queryKey: ["tournament", id], queryFn: () => getTournament(id) });
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const stats = useQuery({
    queryKey: ["tournament-stats", id],
    queryFn: () => listStatsForTournament(id),
  });
  const ach = useQuery({
    queryKey: ["tournament-achievements", id],
    queryFn: () => listAchievements(id),
  });

  if (t.isLoading) return <Layout><Skeleton className="h-40 rounded-3xl" /></Layout>;
  if (!t.data) throw notFound();

  const tour = t.data;
  const matches = stats.data?.matches ?? [];
  const allStats = stats.data?.stats ?? [];

  // Per-player aggregate
  const perPlayer = new Map<string, { kills: number; damage: number; matches: number }>();
  for (const s of allStats) {
    const cur = perPlayer.get(s.player_id) ?? { kills: 0, damage: 0, matches: 0 };
    cur.kills += s.kills;
    cur.damage += s.damage;
    cur.matches += 1;
    perPlayer.set(s.player_id, cur);
  }
  const leaderboard = [...perPlayer.entries()]
    .map(([pid, v]) => ({ player: players.data?.find((p) => p.id === pid), ...v }))
    .filter((r) => r.player)
    .sort((a, b) => b.kills - a.kills);

  const teamKills = sum([...perPlayer.values()].map((v) => v.kills));
  const teamDamage = sum([...perPlayer.values()].map((v) => v.damage));
  const topFragger = leaderboard[0];
  const damageLeader = [...leaderboard].sort((a, b) => b.damage - a.damage)[0];
  const mvp = tour.mvp_player_id
    ? players.data?.find((p) => p.id === tour.mvp_player_id)
    : topFragger?.player;

  return (
    <Layout>
      <section className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-neon-soft blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full ${
                tour.status === "completed" ? "bg-neon-soft text-neon" : "bg-white/5 text-muted-foreground"
              }`}
            >
              {tour.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(tour.date).toLocaleDateString()}
            </span>
          </div>
          <h1 className="mt-3 text-3xl md:text-5xl font-black gradient-text">{tour.name}</h1>
          <div className="text-xs text-muted-foreground mt-2">
            Organizer: {tour.organizer ?? "—"} · {tour.num_matches} matches
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Team Kills" value={teamKills} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Team Damage" value={teamDamage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Matches" value={matches.length} icon={<Swords className="h-4 w-4" />} />
        <StatCard
          label="MVP"
          value={mvp?.ign ?? "—"}
          icon={<Crown className="h-4 w-4" />}
          accent
        />
      </section>

      {tour.status === "completed" && (topFragger || damageLeader) && (
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { icon: <Flame className="h-4 w-4" />, label: "Top Fragger", p: topFragger?.player, meta: `${topFragger?.kills} kills` },
            { icon: <Zap className="h-4 w-4" />, label: "Damage Leader", p: damageLeader?.player, meta: `${damageLeader?.damage.toLocaleString()} dmg` },
            { icon: <Crown className="h-4 w-4" />, label: "MVP", p: mvp, meta: "Match Winner" },
          ].filter((r) => r.p).map((r) => (
            <div key={r.label} className="glass rounded-2xl p-4 flex items-center gap-3">
              <PlayerAvatar photoPath={r.p!.photo_url} name={r.p!.ign} size={52} className="glow shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1">
                  {r.icon} {r.label}
                </div>
                <div className="font-bold truncate">{r.p!.ign}</div>
                <div className="text-xs text-muted-foreground truncate">{r.meta}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 glass rounded-3xl p-4 md:p-6 overflow-x-auto">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <Medal className="h-4 w-4 text-neon" /> Leaderboard
        </h2>
        {leaderboard.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No stats recorded yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Kills</TableHead>
                <TableHead className="text-right">Damage</TableHead>
                <TableHead className="text-right">Avg K</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((r, i) => (
                <TableRow key={r.player!.id} className="border-white/5">
                  <TableCell className="font-mono text-neon">{i + 1}</TableCell>
                  <TableCell>
                    <Link
                      to="/players/$id"
                      params={{ id: r.player!.id }}
                      className="flex items-center gap-2 hover:text-neon"
                    >
                      <PlayerAvatar photoPath={r.player!.photo_url} name={r.player!.ign} size={28} />
                      <span className="font-semibold truncate">{r.player!.ign}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.matches}</TableCell>
                  <TableCell className="text-right font-bold">{r.kills}</TableCell>
                  <TableCell className="text-right">{r.damage.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(r.kills / r.matches).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {matches.length > 0 && (
        <section className="mt-6 glass rounded-3xl p-4 md:p-6 overflow-x-auto">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Match-wise Stats
          </h2>
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead>Player</TableHead>
                {matches.map((m) => (
                  <TableHead key={m.id} className="text-right">M{m.match_number}</TableHead>
                ))}
                <TableHead className="text-right">Total K</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((r) => (
                <TableRow key={r.player!.id} className="border-white/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PlayerAvatar photoPath={r.player!.photo_url} name={r.player!.ign} size={24} />
                      <span className="font-semibold truncate">{r.player!.ign}</span>
                    </div>
                  </TableCell>
                  {matches.map((m) => {
                    const s = allStats.find(
                      (x) => x.match_id === m.id && x.player_id === r.player!.id,
                    );
                    return (
                      <TableCell key={m.id} className="text-right text-xs">
                        {s ? `${s.kills}/${s.damage}` : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold">{r.kills}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-2 text-[10px] text-muted-foreground">Format: kills / damage</div>
        </section>
      )}

      {ach.data && ach.data.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Tournament Achievements
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ach.data.map((a) => (
              <div key={a.id} className="glass rounded-2xl overflow-hidden">
                <TournamentImage
                  path={a.image_url}
                  alt={a.kind}
                  className="w-full h-56 object-cover"
                />
                <div className="p-3 text-xs uppercase tracking-[0.2em] text-neon">
                  {a.kind.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}
