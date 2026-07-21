import { createFileRoute } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { listPlayers, type Player } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/players")({
  component: PlayersAdmin,
});

const ROLES = ["IGL", "Assaulter", "Sniper", "Support", "Filler", "Fragger", "Scout"];

function PlayersAdmin() {
  const qc = useQueryClient();
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const [editing, setEditing] = useState<Partial<Player> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = async () => {
    if (!editing?.ign || !editing.role) {
      toast.error("Name and role required");
      return;
    }
    setSaving(true);
    try {
      let photo_url = editing.photo_url ?? null;
      if (file) photo_url = await uploadFile("player-photos", file);
      const payload = {
        ign: editing.ign,
        role: editing.role,
        uid: editing.uid ?? null,
        status: editing.status ?? "active",
        join_date: editing.join_date ?? new Date().toISOString().slice(0, 10),
        photo_url,
      };
      if (editing.id) {
        const { error } = await supabase.from("players").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("players").insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Saved");
      setEditing(null);
      setFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Players</h2>
          <p className="text-xs text-muted-foreground">Persistent roster. Active players appear in new tournaments automatically.</p>
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setFile(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ status: "active" })} className="glow">
              <Plus className="h-4 w-4 mr-1" /> Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit player" : "New player"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>IGN</Label>
                <Input value={editing?.ign ?? ""} onChange={(e) => setEditing({ ...editing, ign: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={editing?.role} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>UID</Label>
                <Input value={editing?.uid ?? ""} onChange={(e) => setEditing({ ...editing, uid: e.target.value })} />
              </div>
              <div>
                <Label>Join Date</Label>
                <Input type="date" value={editing?.join_date ?? ""} onChange={(e) => setEditing({ ...editing, join_date: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing?.status} onValueChange={(v) => setEditing({ ...editing, status: v as "active" | "inactive" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Photo</Label>
                <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={saving} className="w-full glow">
                {saving ? "Saving…" : "Save Player"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {players.data?.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-3">
            <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{p.ign}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.role} · {p.status}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => confirm(`Delete ${p.ign}?`) && del.mutate(p.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {!players.data?.length && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-10">
            No players yet.
          </div>
        )}
      </div>
    </div>
  );
}
