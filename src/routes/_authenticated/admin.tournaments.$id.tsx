import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar, TournamentImage } from "@/components/PlayerAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTournament,
  listAchievements,
  listPlayers,
  listStatsForTournament,
  matchPoints,
  positionPoints,
  sum,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Save, Upload, CheckCircle2, ArrowLeft, Trash2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tournaments/$id")({
  component: ManageTournament,
});

function ManageTournament() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const tour = useQuery({ queryKey: ["tournament", id], queryFn: () => getTournament(id) });
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const data = useQuery({
    queryKey: ["tournament-stats", id],
    queryFn: () => listStatsForTournament(id),
  });
  const ach = useQuery({
    queryKey: ["tournament-achievements", id],
    queryFn: () => listAchievements(id),
  });

  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [edits, setEdits] = useState<Record<string, { kills: string; damage: string }>>({});
  const [position, setPosition] = useState<string>("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const matches = data.data?.matches ?? [];
  const stats = data.data?.stats ?? [];
  const currentMatch = matches[currentMatchIdx];
  if (!matches.length) {
  return (
    <div className="glass rounded-xl p-6">
      Preparing tournament matches...
    </div>
  );
  }
  const activePlayers = players.data ?? [];

  // Auto-heal: if a tournament has no matches yet, create them from num_matches
  useEffect(() => {
    const run = async () => {
      if (!tour.data || repairing) return;
      if (data.isLoading || data.isFetching) return;
      if (!data.data) return;
      if (matches.length >= tour.data.num_matches) return;
      setRepairing(true);
      try {
        const existingNums = new Set(matches.map((m) => m.match_number));
        const toCreate = [];
        for (let i = 1; i <= tour.data.num_matches; i++) {
          if (!existingNums.has(i)) {
            toCreate.push({ tournament_id: id, match_number: i });
          }
        }
        if (toCreate.length) {
          const { error } = await supabase.from("matches").insert(toCreate);
          if (error) throw error;
          await qc.invalidateQueries({ queryKey: ["tournament-stats", id] });
          toast.success(`Prepared ${toCreate.length} match slot(s)`);
        }
      } catch (e: any) {
        console.error("[repair matches]", e);
        toast.error(`Couldn't prepare matches: ${e.message}`);
      } finally {
        setRepairing(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.data?.id, data.isFetching]);


  // Load edits when match changes
  useEffect(() => {
    if (!currentMatch) return;
    const map: Record<string, { kills: string; damage: string }> = {};
    for (const p of activePlayers) {
      const s = stats.find((x) => x.match_id === currentMatch.id && x.player_id === p.id);
      map[p.id] = {
        kills: String(s?.kills ?? 0),
        damage: String(s?.damage ?? 0),
      };
    }
    setEdits(map);
    setPosition(currentMatch.position ? String(currentMatch.position) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.id, players.data]);

  const saveMatch = async () => {
    if (!currentMatch) return;
    setSavingMatch(true);
    try {
      const rows = activePlayers.map((p) => ({
        match_id: currentMatch.id,
        player_id: p.id,
        kills: parseInt(edits[p.id]?.kills) || 0,
        damage: parseInt(edits[p.id]?.damage) || 0,
      }));
      const { error } = await supabase
        .from("match_stats")
        .upsert(rows, { onConflict: "match_id,player_id" });
      if (error) throw error;
      const pos = position ? parseInt(position) : null;
      const { error: pErr } = await supabase
        .from("matches")
        .update({ position: pos })
        .eq("id", currentMatch.id);
      if (pErr) throw pErr;
      qc.invalidateQueries({ queryKey: ["tournament-stats", id] });
      qc.invalidateQueries({ queryKey: ["all-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-matches", 4] });
      toast.success(`Match ${currentMatch.match_number} saved`);
    } catch (e: any) {
      console.error("[saveMatch]", e);
      toast.error(e.message ?? "Failed to save match");
    } finally {
      setSavingMatch(false);
    }
  };


  const completeTournament = async () => {
    // Calculate MVP: top total kills across matches
    const perPlayer = new Map<string, number>();
    for (const s of stats) {
      perPlayer.set(s.player_id, (perPlayer.get(s.player_id) ?? 0) + s.kills);
    }
    const mvp = [...perPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("tournaments")
        .update({ status: "completed", mvp_player_id: mvp?.[0] ?? null })
        .eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament completed 🏆");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCompleting(false);
    }
  };

  const uploadAch = async (kind: "points_table" | "banner" | "certificate", file: File) => {
    setUploading(true);
    try {
      const path = await uploadFile("tournament-media", file, `${id}/`);
      const { error } = await supabase
        .from("tournament_achievements")
        .insert({ tournament_id: id, kind, image_url: path });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tournament-achievements", id] });
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteAch = async (achId: string) => {
    const { error } = await supabase.from("tournament_achievements").delete().eq("id", achId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tournament-achievements", id] });
  };

  if (tour.isLoading || players.isLoading || data.isLoading || ach.isLoading) {
  return <div>Loading...</div>;
}

if (tour.error) {
  return <div>Failed to load tournament.</div>;
}

if (!tour.data) {
  return <div>Tournament not found.</div>;
}
  const t = tour.data;

  // Live tournament totals
  const totalKills = sum(stats.map((s) => s.kills));
  const totalDamage = sum(stats.map((s) => s.damage));
  const totalPoints = matches.reduce((acc, m) => {
    const teamK = stats.filter((s) => s.match_id === m.id).reduce((a, s) => a + s.kills, 0);
    return acc + matchPoints(m.position, teamK);
  }, 0);

  const currentTeamKills = currentMatch
    ? stats.filter((s) => s.match_id === currentMatch.id).reduce((a, s) => a + s.kills, 0)
    : 0;
  const currentPos = position ? parseInt(position) : null;
  const currentMatchPoints = matchPoints(currentPos, currentTeamKills);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/tournaments" className="text-xs text-muted-foreground hover:text-neon inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to tournaments
        </Link>
        <h2 className="text-3xl md:text-4xl font-display mt-2">{t.name}</h2>
        <div className="text-xs text-muted-foreground mt-1">
          {t.status} · {t.num_matches} matches · {totalKills} kills · {totalDamage.toLocaleString()} dmg
          · <span className="text-neon font-semibold">{totalPoints} pts</span>
        </div>
      </div>

      {/* Match selector */}
      <div className="glass rounded-xl p-4">
        <Label>Match</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.map((m, i) => {
            const teamK = stats.filter((s) => s.match_id === m.id).reduce((a, s) => a + s.kills, 0);
            const pts = matchPoints(m.position, teamK);
            return (
              <button
                key={m.id}
                onClick={() => setCurrentMatchIdx(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  i === currentMatchIdx
                    ? "bg-neon-soft text-neon neon-border"
                    : "bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                Match {m.match_number}
                {m.position ? <span className="ml-1 opacity-70">· #{m.position} · {pts}p</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Match stat editor */}
      {currentMatch && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-2xl">Match {currentMatch.match_number}</h3>
            <Button onClick={saveMatch} disabled={savingMatch} size="sm">
              <Save className="h-3.5 w-3.5 mr-1" />
              {savingMatch ? "Saving…" : "Save match"}
            </Button>
          </div>

          {/* Position + points */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 items-end">
            <div>
              <Label className="text-xs">Team Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select finish" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      #{i + 1} — {positionPoints(i + 1)} pts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="glass rounded-md p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Team Kills</div>
              <div className="font-display text-2xl">{currentTeamKills}</div>
            </div>
            <div className="glass rounded-md p-3 neon-border">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neon flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Match Points
              </div>
              <div className="font-display text-2xl">
                {currentMatchPoints}
                <span className="text-xs text-muted-foreground ml-2">
                  {positionPoints(currentPos)} + {currentTeamKills}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            {activePlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">{p.ign}</div>
                  <div className="text-[10px] text-muted-foreground">{p.role}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  className="w-20 text-center"
                  placeholder="Kills"
                  value={edits[p.id]?.kills ?? ""}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [p.id]: { ...edits[p.id], kills: e.target.value },
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  className="w-24 text-center"
                  placeholder="Damage"
                  value={edits[p.id]?.damage ?? ""}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [p.id]: { ...edits[p.id], damage: e.target.value },
                    })
                  }
                />
              </div>
            ))}
            {!activePlayers.length && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No active players. Add players first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Complete */}
      {t.status !== "completed" && (
        <div className="glass rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="font-bold">Finish tournament</div>
            <div className="text-xs text-muted-foreground">
              This will auto-calculate MVP, top fragger, and leaderboards.
            </div>
          </div>
          <Button onClick={completeTournament} disabled={completing} className="glow">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {completing ? "Finalizing…" : "Complete tournament"}
          </Button>
        </div>
      )}

      {/* Achievements uploader */}
      <div className="glass rounded-2xl p-4">
        <h3 className="font-bold mb-3">Achievements</h3>
        <div className="grid gap-2 md:grid-cols-3">
          {(["points_table", "banner", "certificate"] as const).map((kind) => (
            <label
              key={kind}
              className="glass rounded-xl p-3 flex items-center gap-2 cursor-pointer hover:bg-white/5"
            >
              <Upload className="h-4 w-4 text-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em] flex-1">
                {kind.replace("_", " ")}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadAch(kind, e.target.files[0])}
              />
            </label>
          ))}
        </div>
        {ach.data && ach.data.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {ach.data.map((a) => (
              <div key={a.id} className="glass rounded-xl overflow-hidden group relative">
                <TournamentImage path={a.image_url} alt={a.kind} className="w-full h-32 object-cover" />
                <button
                  onClick={() => deleteAch(a.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
                <div className="p-2 text-[10px] uppercase tracking-[0.15em] text-neon">
                  {a.kind.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
