import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { listPlayers } from "@/lib/data";
import { addAlias, deleteAlias, listAliases } from "@/lib/aliases";
import { toast } from "sonner";
import { Plus, Trash2, ScanText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/aliases")({
  component: AliasesAdmin,
});

function AliasesAdmin() {
  const qc = useQueryClient();
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const aliases = useQuery({ queryKey: ["player-aliases"], queryFn: listAliases });
  const [playerId, setPlayerId] = useState("");
  const [alias, setAlias] = useState("");

  const add = useMutation({
    mutationFn: () => addAlias(playerId, alias),
    onSuccess: () => {
      setAlias("");
      qc.invalidateQueries({ queryKey: ["player-aliases"] });
      toast.success("Name mapping added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteAlias,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-aliases"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ScanText className="h-4 w-4 text-neon" /> In-Game Name Mapping
        </h2>
        <p className="text-xs text-muted-foreground">
          Map the name shown in match screenshots to a roster player — e.g. <b>SNOVAIns</b> = <b>SNV.Ins</b>.
          Screenshot imports use these mappings to route stats to the right person.
        </p>
      </div>

      <div className="glass a-up i-glow-edge rounded-2xl p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <Label className="text-xs">Roster player</Label>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {players.data?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.ign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">In-game name (as in screenshot)</Label>
          <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="SNOVAIns" />
        </div>
        <Button
          className="glow"
          disabled={!playerId || !alias.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {players.data?.map((p) => {
          const mine = aliases.data?.filter((a) => a.player_id === p.id) ?? [];
          return (
            <div key={p.id} className="glass a-up i-glow-edge rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={40} />
                <div className="min-w-0">
                  <div className="font-bold truncate">{p.ign}</div>
                  <div className="text-[10px] text-muted-foreground">{mine.length} mapped name(s)</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mine.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold"
                  >
                    {a.alias}
                    <button onClick={() => del.mutate(a.id)} aria-label={`Remove ${a.alias}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </span>
                ))}
                {!mine.length && (
                  <span className="text-xs text-muted-foreground">No mapping yet — IGN will be matched directly.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
