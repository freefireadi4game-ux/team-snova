import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { listPlayers, listTournaments, listAllStats, sum } from "@/lib/data";
import { Users, Trophy, Flame, Swords } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const stats = useQuery({ queryKey: ["all-stats"], queryFn: listAllStats });
  const totalKills = sum(stats.data?.map((s) => s.kills) ?? []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Players" value={players.data?.length ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Tournaments" value={tournaments.data?.length ?? 0} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Matches" value={stats.data ? new Set(stats.data.map((s) => s.match_id)).size : 0} icon={<Swords className="h-4 w-4" />} />
        <StatCard label="Team Kills" value={totalKills} icon={<Flame className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/admin/players" className="glass a-up i-glow-edge rounded-2xl p-6 hover:-translate-y-0.5 transition-transform">
          <Users className="h-6 w-6 text-neon" />
          <div className="mt-3 font-bold text-lg">Manage Players</div>
          <div className="text-xs text-muted-foreground">Add, edit or retire team members.</div>
        </Link>
        <Link to="/admin/tournaments" className="glass a-up i-glow-edge rounded-2xl p-6 hover:-translate-y-0.5 transition-transform">
          <Trophy className="h-6 w-6 text-neon" />
          <div className="mt-3 font-bold text-lg">Manage Tournaments</div>
          <div className="text-xs text-muted-foreground">Create events, record matches, upload results.</div>
        </Link>
      </div>
    </div>
  );
}
