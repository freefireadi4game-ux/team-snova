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
import { Flame, Zap, Swords, Target, Trophy, Crown, Medal } from "lucide-react";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Monthly and all-time career stats and leaderboards for every SNOVA ESP player — pick any month to compare.",
      },
      { property: "og:title", content: "Stats — Team SNOVA ESP" },
      {
        property: "og:description",
        content: "Monthly and all-time leaderboards for every SNOVA ESP player.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
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

  const scopedTournaments = useMemo(() => {
    const list = tournaments.data ?? [];
    if (period === OVERALL) return list;
    return list.filter((t) => String(t.date).slice(0, 7) === period);
  }, [tournaments.data, period]);

  return (
    <Layout>
      <div className="mb-6 animate-rise">
        <h1 className="a-slide-blur font-display text-3xl md:text-4xl gradient-text">Career Stats</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every kill, every match — filter by month or view the all-time record.
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
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <section key={period} className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
          <StatCard label="Tournaments" value={scopedTournaments.length} icon={<Trophy className="h-4 w-4" />} />
          <StatCard label="Matches" value={totals.matches} icon={<Swords className="h-4 w-4" />} />
          <StatCard label="Team Kills" value={totals.kills} icon={<Flame className="h-4 w-4" />} accent />
          <StatCard label="Team Damage" value={totals.damage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
        </section>
      )}

      <section className="mt-8 glass rounded-2xl p-4 md:p-6 overflow-x-auto animate-soft-in">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-neon" /> Player Leaderboard · {periodLabel(period)}
        </h2>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            No stats logged for {periodLabel(period)}.
          </div>
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
      </section>

      <section key={`h-${period}`} className="mt-6 grid gap-3 md:grid-cols-3 stagger">
        {rows[0] && (
          <div className="glass i-lift rounded-2xl p-4 flex items-center gap-3 neon-border">
            <PlayerAvatar photoPath={rows[0].player.photo_url} name={rows[0].player.ign} size={52} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Flame className="h-3 w-3" /> Top Fragger</div>
              <div className="font-bold truncate">{rows[0].player.ign}</div>
              <div className="text-xs text-muted-foreground">{rows[0].kills} kills</div>
            </div>
          </div>
        )}
        {rows.length > 0 && (() => {
          const dmg = [...rows].sort((a, b) => b.damage - a.damage)[0];
          return (
            <div className="glass i-lift rounded-2xl p-4 flex items-center gap-3">
              <PlayerAvatar photoPath={dmg.player.photo_url} name={dmg.player.ign} size={52} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Zap className="h-3 w-3" /> Damage Leader</div>
                <div className="font-bold truncate">{dmg.player.ign}</div>
                <div className="text-xs text-muted-foreground">{dmg.damage.toLocaleString()} dmg</div>
              </div>
            </div>
          );
        })()}
        {rows.length > 0 && (() => {
          const best = [...rows].sort((a, b) => b.bestKills - a.bestKills)[0];
          return (
            <div className="glass i-lift rounded-2xl p-4 flex items-center gap-3">
              <PlayerAvatar photoPath={best.player.photo_url} name={best.player.ign} size={52} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1"><Target className="h-3 w-3" /> Best Match</div>
                <div className="font-bold truncate">{best.player.ign}</div>
                <div className="text-xs text-muted-foreground">{best.bestKills} kills in a match</div>
              </div>
            </div>
          );
        })()}
      </section>
    </Layout>
  );
}
