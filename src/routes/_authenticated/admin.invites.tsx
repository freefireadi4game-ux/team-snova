import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: AdminInvites,
});

function AdminInvites() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("player_invites").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const genToken = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const create = async () => {
    setCreating(true);
    const { error } = await supabase.from("player_invites").insert({ token: genToken(), label: label || null });
    setCreating(false);
    if (error) return toast.error(error.message);
    setLabel("");
    qc.invalidateQueries({ queryKey: ["invites"] });
    toast.success("Invite created");
  };

  const remove = async (id: string) => {
    if (!confirm("Revoke this invite link?")) return;
    const { error } = await supabase.from("player_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invites"] });
  };

  const linkFor = (token: string) => `${window.location.origin}/join/${token}`;

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-display">Player Invites</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Share these permanent links with team members. Anyone who signs up and opens the link becomes a player with voice + maps access.
        </p>
      </div>

      <div className="glass rounded-2xl p-4 flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label>Label (optional)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main squad" />
        </div>
        <Button onClick={create} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" /> Create invite
        </Button>
      </div>

      <div className="grid gap-2">
        {invites.data?.map((i: any) => (
          <div key={i.id} className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <LinkIcon className="h-4 w-4 text-neon shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{i.label ?? "Player invite"}</div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">{linkFor(i.token)}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => copy(i.token)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(i.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {!invites.data?.length && !invites.isLoading && (
          <div className="text-center text-sm text-muted-foreground py-8">No invites yet.</div>
        )}
      </div>
    </div>
  );
}
