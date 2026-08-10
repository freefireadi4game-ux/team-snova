import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl, uploadFile } from "@/lib/storage";
import { Viewport } from "@/components/tactical/Viewport";
import { listPois, listPoiImages, POI_CATEGORIES, type Poi, type Pt } from "@/lib/tactical";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TournamentImage } from "@/components/PlayerAvatar";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Star, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pois")({
  component: AdminPois,
});

function AdminPois() {
  const qc = useQueryClient();
  const [mapId, setMapId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [form, setForm] = useState<Partial<Poi>>({ category: "location" });
  const [openPoi, setOpenPoi] = useState<string | null>(null);

  const maps = useQuery({
    queryKey: ["maps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maps").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const map = maps.data?.find((m: any) => m.id === mapId) ?? maps.data?.[0];
  const activeMapId = mapId ?? map?.id ?? null;
  const url = useSignedUrl("tournament-media", map?.image_url ?? null);

  const pois = useQuery({
    queryKey: ["pois", activeMapId],
    queryFn: () => listPois(activeMapId!),
    enabled: !!activeMapId,
  });

  const place = (p: Pt) => {
    setDraft(p);
    setForm({ category: "location", name: "" });
  };

  const savePoi = async () => {
    if (!activeMapId || !form.name?.trim()) return toast.error("Name required");
    try {
      if (form.id) {
        const { error } = await supabase
          .from("map_pois")
          .update({
            name: form.name.trim(),
            description: form.description ?? null,
            category: form.category ?? "location",
            x: form.x ?? 0,
            y: form.y ?? 0,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        if (!draft) return toast.error("Tap the map to pick a spot");
        const { error } = await supabase.from("map_pois").insert({
          map_id: activeMapId,
          name: form.name.trim(),
          description: form.description ?? null,
          category: form.category ?? "location",
          x: draft.x,
          y: draft.y,
          sort_order: pois.data?.length ?? 0,
        });
        if (error) throw error;
      }
      setDraft(null);
      setForm({ category: "location" });
      qc.invalidateQueries({ queryKey: ["pois", activeMapId] });
      toast.success("Location saved");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const delPoi = async (id: string) => {
    if (!confirm("Delete this location and its images?")) return;
    const { error } = await supabase.from("map_pois").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pois", activeMapId] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-display">Locations & Drone Views</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tap the map to add a POI, then upload and order its tactical images.
        </p>
      </div>

      <div className="max-w-xs">
        <Label>Map</Label>
        <Select value={activeMapId ?? undefined} onValueChange={(v) => { setMapId(v); setDraft(null); }}>
          <SelectTrigger><SelectValue placeholder="Select map" /></SelectTrigger>
          <SelectContent>
            {maps.data?.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeMapId && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
          <Viewport aspect={1} onTap={place} className="glass">
            {url.data && (
              <img src={url.data} alt={map?.name} className="absolute inset-0 h-full w-full object-cover pointer-events-none" draggable={false} />
            )}
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {(pois.data ?? []).map((p) => (
                <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                  <circle r={1.8} fill="rgba(8,12,20,.85)" stroke="#fbbf24" strokeWidth={0.35} />
                  <circle r={0.6} fill="#fbbf24" />
                  <text y={-2.7} textAnchor="middle" fill="#fbbf24" fontSize={2.2} fontWeight={700}>{p.name}</text>
                </g>
              ))}
              {draft && <circle cx={draft.x} cy={draft.y} r={1.6} fill="#38bdf8" stroke="#fff" strokeWidth={0.3} />}
            </svg>
          </Viewport>

          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="text-sm font-bold">{form.id ? "Edit location" : "New location"}</div>
            <div>
              <Label>Name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Brasilia" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POI_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {form.id
                ? `Position ${form.x?.toFixed(1)}%, ${form.y?.toFixed(1)}%`
                : draft
                  ? `Spot picked: ${draft.x.toFixed(1)}%, ${draft.y.toFixed(1)}%`
                  : "Tap the map to pick a spot."}
            </div>
            <div className="flex gap-2">
              <Button onClick={savePoi} className="flex-1">Save location</Button>
              {(form.id || draft) && (
                <Button variant="ghost" onClick={() => { setForm({ category: "location" }); setDraft(null); }}>Cancel</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(pois.data ?? []).map((p) => (
          <div key={p.id} className="glass rounded-2xl p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{p.name}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{p.category}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setOpenPoi(openPoi === p.id ? null : p.id)}>
                  Images
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setForm(p); setDraft(null); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => delPoi(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            {openPoi === p.id && <PoiImages poiId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PoiImages({ poiId }: { poiId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const images = useQuery({ queryKey: ["poi-images", poiId], queryFn: () => listPoiImages(poiId) });
  const list = images.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["poi-images", poiId] });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      let order = list.length;
      for (const f of Array.from(files)) {
        const path = await uploadFile("tournament-media", f, "poi/");
        const { error } = await supabase.from("map_poi_images").insert({
          poi_id: poiId,
          image_url: path,
          title: f.name.replace(/\.[^.]+$/, ""),
          sort_order: order++,
          is_thumbnail: list.length === 0 && order === 1,
        });
        if (error) throw error;
      }
      refresh();
      toast.success("Images uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const swap = async (i: number, j: number) => {
    if (j < 0 || j >= list.length) return;
    const a = list[i];
    const b = list[j];
    await supabase.from("map_poi_images").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("map_poi_images").update({ sort_order: a.sort_order }).eq("id", b.id);
    refresh();
  };

  const rename = async (id: string, currentTitle: string | null) => {
    const t = prompt("Image title", currentTitle ?? "");
    if (t === null) return;
    await supabase.from("map_poi_images").update({ title: t }).eq("id", id);
    refresh();
  };

  const setThumb = async (id: string) => {
    await supabase.from("map_poi_images").update({ is_thumbnail: false }).eq("poi_id", poiId);
    await supabase.from("map_poi_images").update({ is_thumbnail: true }).eq("id", id);
    refresh();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this image and its annotations?")) return;
    await supabase.from("map_poi_images").delete().eq("id", id);
    refresh();
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3 space-y-3">
      <div>
        <Label>Upload images (multiple allowed)</Label>
        <Input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => upload(e.target.files)} />
        {busy && <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1"><Upload className="h-3 w-3" /> Uploading…</div>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((im, i) => (
          <div key={im.id} className="rounded-xl border border-white/10 overflow-hidden">
            <TournamentImage path={im.image_url} alt={im.title ?? "view"} className="w-full h-28 object-cover" />
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{im.title || `View ${i + 1}`}</div>
                  <div className="text-[10px] text-muted-foreground">Order {i + 1}{im.is_thumbnail ? " · thumbnail" : ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => swap(i, i - 1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => swap(i, i + 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => rename(im.id, im.title)}>Rename</Button>
                <Button size="sm" variant="ghost" onClick={() => setThumb(im.id)}><Star className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(im.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
        {!list.length && <div className="text-xs text-muted-foreground">No images yet.</div>}
      </div>
    </div>
  );
}
