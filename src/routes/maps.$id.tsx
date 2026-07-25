import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useSignedUrl } from "@/lib/storage";
import { useSession, useCanVoice } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eraser, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/maps/$id")({
  component: MapBoard,
});

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#eab308"];

type Path = { id: string; color: string; points: { x: number; y: number }[]; user_id: string };

function MapBoard() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { session } = useSession();
  const canDraw = useCanVoice();

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
      const { data, error } = await supabase.from("map_paths").select("*").eq("map_id", id).order("created_at");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const [color, setColor] = useState(COLORS[0]);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`map-paths-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "map_paths", filter: `map_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["map-paths", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const pointFromEvent = (e: React.PointerEvent | PointerEvent) => {
    const el = canvasRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const startDraw = (e: React.PointerEvent) => {
    if (!canDraw.data) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (p) setDrawing([p]);
  };
  const moveDraw = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = pointFromEvent(e);
    if (p) setDrawing([...drawing, p]);
  };
  const endDraw = async () => {
    if (!drawing || drawing.length < 2 || !session) {
      setDrawing(null);
      return;
    }
    const pts = drawing;
    setDrawing(null);
    const { error } = await supabase.from("map_paths").insert({
      map_id: id,
      user_id: session.user.id,
      color,
      points: pts,
    });
    if (error) toast.error(error.message);
  };

  const undoMine = async () => {
    if (!session) return;
    const mine = (paths.data ?? []).filter((p) => p.user_id === session.user.id).slice(-1)[0];
    if (!mine) return;
    await supabase.from("map_paths").delete().eq("id", mine.id);
  };

  const clearAll = async () => {
    if (!confirm("Clear all paths on this map?")) return;
    await supabase.from("map_paths").delete().eq("map_id", id);
  };

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <Layout>
      <Link to="/maps" className="text-xs text-muted-foreground hover:text-neon inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to maps
      </Link>
      <h1 className="text-2xl md:text-3xl font-display mt-2">{map.data?.name ?? "Map"}</h1>
      <div className="text-xs text-muted-foreground mb-4">
        {canDraw.data ? "Drag to draw a rotation path. Live sync." : "View-only. Ask admin for the player invite to draw."}
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
          />
        ))}
        {canDraw.data && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={undoMine}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo mine
            </Button>
            <Button size="sm" variant="destructive" onClick={clearAll}>
              <Eraser className="h-3.5 w-3.5 mr-1" /> Clear all
            </Button>
          </div>
        )}
      </div>

      <div
        ref={canvasRef}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        className="relative rounded-2xl overflow-hidden select-none touch-none glass"
        style={{ aspectRatio: "1 / 1", cursor: canDraw.data ? "crosshair" : "default" }}
      >
        {url.data && (
          <img src={url.data} alt={map.data?.name ?? ""} className="absolute inset-0 h-full w-full object-cover pointer-events-none" draggable={false} />
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          {(paths.data ?? []).map((p) => (
            <path key={p.id} d={buildPath(p.points)} stroke={p.color} strokeWidth={0.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {drawing && (
            <path d={buildPath(drawing)} stroke={color} strokeWidth={0.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>
    </Layout>
  );
}
