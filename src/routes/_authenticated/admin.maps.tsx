import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TournamentImage } from "@/components/PlayerAvatar";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/maps")({
  component: AdminMaps,
});

function AdminMaps() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const maps = useQuery({
    queryKey: ["maps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maps").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!name.trim() || !file) return toast.error("Name and image required");
    setUploading(true);
    try {
      const path = await uploadFile("tournament-media", file, "maps/");
      const { error } = await supabase.from("maps").insert({ name: name.trim(), image_url: path });
      if (error) throw error;
      setName("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["maps"] });
      toast.success("Map uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this map and its paths?")) return;
    const { error } = await supabase.from("maps").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["maps"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-display">Maps</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload map images for rotation planning.</p>
      </div>

      <div className="glass i-lift rounded-2xl p-4 grid gap-3 md:grid-cols-3 items-end">
        <div>
          <Label>Map name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Erangel" />
        </div>
        <div>
          <Label>Image</Label>
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={submit} disabled={uploading}>
          <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Upload map"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {maps.data?.map((m: any) => (
          <div key={m.id} className="glass i-lift rounded-2xl overflow-hidden">
            <TournamentImage path={m.image_url} alt={m.name} className="w-full h-40 object-cover" />
            <div className="p-3 flex items-center justify-between">
              <div className="font-bold truncate">{m.name}</div>
              <Button size="sm" variant="destructive" onClick={() => remove(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
