import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { listTournaments, listPlayers } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tournaments")({
  component: TournamentsAdmin,
});

function TournamentsAdmin() {
  const qc = useQueryClient();
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    organizer: "",
    date: new Date().toISOString().slice(0, 10),
    num_matches: 3,
  });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    try {
      const { data: t, error } = await supabase
        .from("tournaments")
        .insert({
          name: form.name,
          organizer: form.organizer || null,
          date: form.date,
          num_matches: form.num_matches,
          status: "ongoing",
        })
        .select()
        .single();
      if (error) throw error;

      // Create matches
      const matchRows = Array.from({ length: form.num_matches }).map((_, i) => ({
        tournament_id: t.id,
        match_number: i + 1,
      }));
      const { data: matches, error: mErr } = await supabase
        .from("matches")
        .insert(matchRows)
        .select();
      if (mErr) throw mErr;

      // Auto-fill stats for all active players (kills=0, damage=0)
      const activePlayers = (players.data ?? []).filter((p) => p.status === "active");
      const statRows = matches!.flatMap((m) =>
        activePlayers.map((p) => ({
          match_id: m.id,
          player_id: p.id,
          kills: 0,
          damage: 0,
        })),
      );
      if (statRows.length) {
        const { error: sErr } = await supabase.from("match_stats").insert(statRows);
        if (sErr) throw sErr;
      }

      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament created");
      setOpen(false);
      setForm({ name: "", organizer: "", date: new Date().toISOString().slice(0, 10), num_matches: 3 });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Tournaments</h2>
          <p className="text-xs text-muted-foreground">
            Create events. All active players are auto-included in every match.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="glow"><Plus className="h-4 w-4 mr-1" /> New Tournament</Button>
          </DialogTrigger>
          <DialogContent className="glass border-white/10 max-w-md">
            <DialogHeader><DialogTitle>Create tournament</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Organizer</Label>
                <Input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Number of Matches</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.num_matches}
                  onChange={(e) => setForm({ ...form, num_matches: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={saving} className="w-full glow">
                {saving ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tournaments.data?.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t.status} · {new Date(t.date).toLocaleDateString()} · {t.num_matches} matches
              </div>
            </div>
            <Link to="/admin/tournaments/$id" params={{ id: t.id }}>
              <Button size="sm" variant="secondary">Manage</Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => confirm(`Delete ${t.name}?`) && del.mutate(t.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {!tournaments.data?.length && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-10">
            No tournaments yet.
          </div>
        )}
      </div>
    </div>
  );
}
