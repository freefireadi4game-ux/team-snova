import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Eraser, Undo2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/maps/$id")({
  component: MapBoard,
});

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#eab308"];

type Pt = { x: number; y: number };
type Path = { id: string; color: string; points: Pt[]; user_id: string | null };

/** Smooth Catmull-Rom → cubic Bezier for a nice curve through all points. */
function smoothPath(pts: Pt[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function MapBoard() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const map = useQuery({
    queryKey: ["map", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("maps").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const url = useSignedUrl("tournament-media", map.data?.image_url ?? null);

  const paths = useQuery<Path[]>({
    queryKey: ["map-paths", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("map_paths")
        .select("*")
        .eq("map_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Pt[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ch = supabase
      .channel(`map-paths-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "map_paths", filter: `map_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["map-paths", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const addPoint = (e: React.MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    setDraft((d) => [...d, p]);
  };

  const commit = async () => {
    if (draft.length < 2) {
      toast.error("Add at least 2 points before finishing.");
      return;
    }
    const pts = draft;
    setDraft([]);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("map_paths").insert({
      map_id: id,
      user_id: sess.session?.user.id ?? null,
      color,
      points: pts,
    });
    if (error) {
      toast.error(error.message);
      setDraft(pts);
    } else {
      toast.success("Path saved");
    }
  };

  const undoDraft = () => setDraft((d) => d.slice(0, -1));
  const cancelDraft = () => setDraft([]);

  const deleteLast = async () => {
    const last = (paths.data ?? []).slice(-1)[0];
    if (!last) return;
    await supabase.from("map_paths").delete().eq("id", last.id);
  };

  const clearAll = async () => {
    if (!confirm("Clear every path on this map?")) return;
    await supabase.from("map_paths").delete().eq("map_id", id);
  };

  return (
    <Layout>
      <Link to="/maps" className="text-xs text-muted-foreground hover:text-neon inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to maps
      </Link>
      <h1 className="text-2xl md:text-3xl font-display mt-2">{map.data?.name ?? "Map"}</h1>
      <div className="text-xs text-muted-foreground mb-4">
        Tap to drop points — a smooth path builds between them. Hit <span className="text-neon font-semibold">Finish</span> to lock it in.
      </div>

      <div className="glass rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">Color</div>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-2 transition-all ${
              color === c ? "border-white scale-110" : "border-white/20"
            }`}
            style={{ background: c }}
            aria-label={`Pick ${c}`}
          />
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {draft.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={undoDraft}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo point
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelDraft}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={commit}>
                <Check className="h-3.5 w-3.5 mr-1" /> Finish ({draft.length})
              </Button>
            </>
          )}
          {draft.length === 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={deleteLast} disabled={!paths.data?.length}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo last path
              </Button>
              <Button size="sm" variant="destructive" onClick={clearAll} disabled={!paths.data?.length}>
                <Eraser className="h-3.5 w-3.5 mr-1" /> Clear all
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        ref={canvasRef}
        onClick={addPoint}
        className="relative rounded-2xl overflow-hidden select-none touch-none glass"
        style={{ aspectRatio: "1 / 1", cursor: "crosshair" }}
      >
        {url.data && (
          <img
            src={url.data}
            alt={map.data?.name ?? ""}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            draggable={false}
          />
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          {(paths.data ?? []).map((p) => (
            <g key={p.id}>
              <path d={smoothPath(p.points)} stroke={p.color} strokeWidth={0.7} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
              {p.points.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={0.7} fill={p.color} />
              ))}
            </g>
          ))}
          {draft.length > 0 && (
            <g>
              <path d={smoothPath(draft)} stroke={color} strokeWidth={0.7} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.2 0.8" />
              {draft.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={1} fill={color} stroke="white" strokeWidth={0.2} />
              ))}
            </g>
          )}
        </svg>
      </div>
    </Layout>
  );
}
