import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/storage";
import type { Player } from "@/lib/data";
import {
  clamp,
  createAnn,
  clearScope,
  deleteAnn,
  listAnnotations,
  MARKER_COLORS,
  MARKER_TYPES,
  patchAnn,
  playerColor,
  restoreAnn,
  scopeKey,
  smoothPath,
  type Ann,
  type AnnKind,
  type MarkerType,
  type Poi,
  type Pt,
  type Scope,
} from "@/lib/tactical";
import { Viewport, type ViewportHandle } from "./Viewport";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Circle as CircleIcon,
  Eraser,
  Expand,
  Locate,
  Maximize2,
  MousePointer2,
  Pencil,
  Redo2,
  Route as RouteIcon,
  Square,
  Star,
  Trash2,
  Type as TypeIcon,
  Undo2,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Tool =
  | "select"
  | "player"
  | "route"
  | "arrow"
  | "freehand"
  | "circle"
  | "rect"
  | "zone"
  | "text"
  | "marker"
  | "eraser";

const DRAG_TOOLS: Tool[] = ["arrow", "freehand", "circle", "rect", "zone"];

type Op =
  | { type: "create"; row: Ann }
  | { type: "delete"; row: Ann }
  | { type: "patch"; id: string; before: Pt[]; after: Pt[] }
  | { type: "clear"; rows: Ann[] };

export function TacticalBoard({
  scope,
  imageUrl,
  aspect = 1,
  players = [],
  pois = [],
  onPoiTap,
  legacyPaths = [],
  compact,
}: {
  scope: Scope;
  imageUrl: string | null;
  aspect?: number;
  players?: Player[];
  pois?: Poi[];
  onPoiTap?: (poi: Poi) => void;
  legacyPaths?: { id: string; color: string; points: Pt[] }[];
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const key = scopeKey(scope);
  const vp = useRef<ViewportHandle>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [playerId, setPlayerId] = useState<string | null>(players[0]?.id ?? null);
  const [markerType, setMarkerType] = useState<MarkerType>("enemy");
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showMarkers, setShowMarkers] = useState(false);

  useEffect(() => {
    if (!playerId && players.length) setPlayerId(players[0].id);
  }, [players, playerId]);

  const anns = useQuery({ queryKey: key, queryFn: () => listAnnotations(scope) });
  const rows = anns.data ?? [];

  const undoStack = useRef<Op[]>([]);
  const redoStack = useRef<Op[]>([]);
  const [histTick, setHistTick] = useState(0);
  const bump = () => setHistTick((t) => t + 1);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  useEffect(() => {
    const filter =
      scope.scope === "map" ? `map_id=eq.${scope.mapId}` : `poi_image_id=eq.${scope.poiImageId}`;
    const ch = supabase
      .channel(`tac-${filter}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tactical_annotations", filter },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.scope, (scope as any).mapId, (scope as any).poiImageId]);

  const H = 100 / aspect;
  const Y = (y: number) => (y * H) / 100;
  const k = clamp(1 / zoom, 0.28, 1); // keep decorations at a steady screen size

  const playerIdx = useMemo(() => {
    const m = new Map<string, number>();
    players.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [players]);
  const colorFor = (p: Player) => playerColor(playerIdx.get(p.id) ?? 0);
  const activePlayer = players.find((p) => p.id === playerId) ?? null;

  const routeOf = (pid: string) => rows.find((r) => r.kind === "route" && r.player_id === pid);

  /* --------------------------- mutations --------------------------- */

  const push = (op: Op) => {
    undoStack.current.push(op);
    redoStack.current = [];
    bump();
  };

  const add = async (
    kind: AnnKind,
    points: Pt[],
    color: string,
    meta: Record<string, any> = {},
    pid: string | null = null,
  ) => {
    try {
      const row = await createAnn(scope, { kind, points, color, meta, player_id: pid });
      push({ type: "create", row });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (row: Ann) => {
    try {
      await deleteAnn(row.id);
      push({ type: "delete", row });
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const movePoints = async (row: Ann, next: Pt[]) => {
    try {
      await patchAnn(row.id, { points: next });
      push({ type: "patch", id: row.id, before: row.points, after: next });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const undo = async () => {
    const op = undoStack.current.pop();
    if (!op) return;
    try {
      if (op.type === "create") await deleteAnn(op.row.id);
      if (op.type === "delete") await restoreAnn(op.row);
      if (op.type === "patch") await patchAnn(op.id, { points: op.before });
      if (op.type === "clear") for (const r of op.rows) await restoreAnn(r);
      redoStack.current.push(op);
      bump();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const redo = async () => {
    const op = redoStack.current.pop();
    if (!op) return;
    try {
      if (op.type === "create") await restoreAnn(op.row);
      if (op.type === "delete") await deleteAnn(op.row.id);
      if (op.type === "patch") await patchAnn(op.id, { points: op.after });
      if (op.type === "clear") for (const r of op.rows) await deleteAnn(r.id);
      undoStack.current.push(op);
      bump();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const clearAll = async () => {
    if (!rows.length) return;
    if (!confirm("Clear every marker, route and drawing on this layer?")) return;
    const snapshot = rows;
    try {
      await clearScope(scope);
      push({ type: "clear", rows: snapshot });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const clearPlayerRoute = async () => {
    if (!playerId) return;
    const r = routeOf(playerId);
    if (r) await remove(r);
  };

  /* --------------------------- interactions --------------------------- */

  const onTap = async (p: Pt) => {
    if (tool === "player") {
      if (!playerId || !activePlayer) return toast.error("Add active players first");
      const existing = routeOf(playerId);
      if (existing) await movePoints(existing, [...existing.points, p]);
      else await add("route", [p], colorFor(activePlayer), {}, playerId);
      return;
    }
    if (tool === "route") {
      const open = rows.find((r) => r.kind === "route" && !r.player_id && r.meta?.open);
      if (open) await movePoints(open, [...open.points, p]);
      else await add("route", [p], "#e2e8f0", { open: true });
      return;
    }
    if (tool === "marker") {
      await add("marker", [p], MARKER_COLORS[markerType] ?? "#e2e8f0", { markerType });
      return;
    }
    if (tool === "text") {
      const t = prompt("Label text");
      if (t?.trim()) await add("text", [p], "#fbbf24", { text: t.trim() });
      return;
    }
  };

  const drawMode = DRAG_TOOLS.includes(tool);

  const onDrawStart = (p: Pt) => setDraft([p, p]);
  const onDrawMove = (p: Pt) =>
    setDraft((d) => (!d ? d : tool === "freehand" ? [...d, p] : [d[0], p]));
  const onDrawEnd = async (p: Pt) => {
    const d = draft;
    setDraft(null);
    if (!d) return;
    const pts = tool === "freehand" ? [...d, p] : [d[0], p];
    const dist = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    if (dist < 1 && tool !== "freehand") return;
    const color =
      tool === "zone" ? "#38bdf8" : tool === "arrow" ? "#f97316" : tool === "circle" ? "#22c55e" : "#e2e8f0";
    await add(tool as AnnKind, pts, color);
  };

  /** Drag a stored point (waypoint / shape handle). */
  const dragPoint = (e: React.PointerEvent, row: Ann, index: number) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const svg = svgRef.current!;
    let next = row.points.slice();
    const move = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      next = next.slice();
      next[index] = {
        x: clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100),
        y: clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100),
      };
      qc.setQueryData<Ann[]>(key, (old) =>
        (old ?? []).map((o) => (o.id === row.id ? { ...o, points: next } : o)),
      );
      ev.preventDefault();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      void movePoints(row, next);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
  };

  const hit = (e: React.PointerEvent, row: Ann) => {
    if (tool === "eraser") {
      e.stopPropagation();
      void remove(row);
    } else if (tool === "select") {
      e.stopPropagation();
      setSelected((s) => (s === row.id ? null : row.id));
    }
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  /* ------------------------------ render ------------------------------ */

  const TOOLS: { id: Tool; label: string; icon: any }[] = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "player", label: "Player", icon: UserRound },
    { id: "route", label: "Route", icon: RouteIcon },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
    { id: "freehand", label: "Draw", icon: Pencil },
    { id: "circle", label: "Circle", icon: CircleIcon },
    { id: "rect", label: "Box", icon: Square },
    { id: "zone", label: "Zone", icon: Locate },
    { id: "text", label: "Text", icon: TypeIcon },
    { id: "marker", label: "Marker", icon: Star },
    { id: "eraser", label: "Erase", icon: Eraser },
  ];

  const selectedRow = rows.find((r) => r.id === selected) ?? null;

  return (
    <div ref={wrapRef} className="bg-background/60">
      {/* toolbar */}
      <div className="glass rounded-2xl p-2 mb-2 space-y-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTool(t.id);
                setShowMarkers(t.id === "marker");
              }}
              className={cn(
                "shrink-0 grid place-items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground transition-colors",
                tool === t.id && "bg-neon-soft text-neon",
              )}
              aria-pressed={tool === t.id}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1 shrink-0" />
          <button
            onClick={undo}
            disabled={!undoStack.current.length}
            className="shrink-0 grid place-items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" /> Undo
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.current.length}
            className="shrink-0 grid place-items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" /> Redo
          </button>
          <button
            onClick={clearAll}
            className="shrink-0 grid place-items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
          <span className="sr-only">{histTick}</span>
        </div>

        {tool === "player" && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlayerId(p.id)}
                className={cn(
                  "shrink-0 flex items-center gap-2 rounded-xl px-2 py-1.5 border transition-colors",
                  playerId === p.id ? "border-white/40 bg-white/5" : "border-white/10",
                )}
                style={playerId === p.id ? { borderColor: colorFor(p) } : undefined}
              >
                <PlayerDot player={p} color={colorFor(p)} />
                <span className="text-left leading-tight">
                  <span className="block text-[11px] font-bold">{p.ign}</span>
                  <span className="block text-[9px] text-muted-foreground uppercase tracking-wider">
                    {p.role}
                  </span>
                </span>
              </button>
            ))}
            {playerId && (
              <Button size="sm" variant="secondary" className="shrink-0" onClick={clearPlayerRoute}>
                Clear route
              </Button>
            )}
            {!players.length && (
              <div className="text-xs text-muted-foreground py-1">No active players on the roster.</div>
            )}
          </div>
        )}

        {showMarkers && tool === "marker" && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {MARKER_TYPES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarkerType(m.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold border",
                  markerType === m.id ? "border-white/40 bg-white/5" : "border-white/10 text-muted-foreground",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: MARKER_COLORS[m.id] }}
                />
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => vp.current?.zoomBy(1.4)} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => vp.current?.zoomBy(1 / 1.4)} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => vp.current?.reset()} aria-label="Fit map">
            <Expand className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={fullscreen} aria-label="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          {selectedRow && (
            <Button size="sm" variant="destructive" onClick={() => remove(selectedRow)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground">
            {tool === "select"
              ? "Drag to pan · pinch or scroll to zoom · drag handles to move waypoints"
              : tool === "player"
                ? "Pick a player, then tap the map to drop their position and extend their rotation."
                : DRAG_TOOLS.includes(tool)
                  ? "Tap and drag on the map to draw."
                  : "Tap the map to place."}
          </div>
        )}
      </div>

      <Viewport
        ref={vp}
        aspect={aspect}
        drawMode={drawMode}
        onTap={onTap}
        onDrawStart={onDrawStart}
        onDrawMove={onDrawMove}
        onDrawEnd={onDrawEnd}
        onZoomChange={setZoom}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-white/5" />
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 100 ${H}`}
          className="absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            {[...new Set([...rows.map((r) => r.color), "#f97316"])].map((c) => (
              <marker
                key={c}
                id={`arw-${c.replace("#", "")}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth={4}
                markerHeight={4}
                orient="auto-start-reverse"
              >
                <path d="M0,1 L9,5 L0,9 z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* legacy freehand paths from the original rotation board */}
          {legacyPaths.map((p) => (
            <path
              key={p.id}
              d={smoothPath(p.points.map((q) => ({ x: q.x, y: Y(q.y) })))}
              stroke={p.color}
              strokeWidth={0.5 * k}
              fill="none"
              opacity={0.45}
              strokeLinecap="round"
              pointerEvents="none"
            />
          ))}

          {rows.map((r) => (
            <Shape
              key={r.id}
              row={r}
              Y={Y}
              k={k}
              selected={selected === r.id}
              player={players.find((p) => p.id === r.player_id) ?? null}
              onHit={(e) => hit(e, r)}
              onHandle={(e, i) => dragPoint(e, r, i)}
            />
          ))}

          {draft && (
            <Shape
              row={{
                id: "draft",
                scope: scope.scope,
                map_id: null,
                poi_image_id: null,
                kind: (tool as AnnKind) ?? "freehand",
                player_id: null,
                color: "#38bdf8",
                points: draft,
                meta: {},
              }}
              Y={Y}
              k={k}
              ghost
            />
          )}

          {pois.map((poi) => (
            <g
              key={poi.id}
              transform={`translate(${poi.x} ${Y(poi.y)})`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPoiTap?.(poi);
              }}
              style={{ cursor: "pointer" }}
            >
              <circle r={2.1 * k} fill="rgba(8,12,20,.85)" stroke="#fbbf24" strokeWidth={0.35 * k} />
              <circle r={0.75 * k} fill="#fbbf24" />
              <text
                y={-3.1 * k}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize={2.4 * k}
                fontWeight="700"
                style={{ paintOrder: "stroke" }}
                stroke="rgba(0,0,0,.75)"
                strokeWidth={0.5 * k}
              >
                {poi.name}
              </text>
            </g>
          ))}
        </svg>
      </Viewport>
    </div>
  );
}

function PlayerDot({ player, color }: { player: Player; color: string }) {
  const { data: url } = useSignedUrl("player-photos", player.photo_url);
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 text-[9px] font-bold"
      style={{ borderColor: color }}
    >
      {url ? (
        <img src={url} alt={player.ign} className="h-full w-full object-cover" />
      ) : (
        player.ign.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function Shape({
  row,
  Y,
  k,
  selected,
  ghost,
  player,
  onHit,
  onHandle,
}: {
  row: Ann;
  Y: (y: number) => number;
  k: number;
  selected?: boolean;
  ghost?: boolean;
  player?: Player | null;
  onHit?: (e: React.PointerEvent) => void;
  onHandle?: (e: React.PointerEvent, i: number) => void;
}) {
  const p = row.points.map((q) => ({ x: q.x, y: Y(q.y) }));
  if (!p.length) return null;
  const sw = 0.65 * k;
  const arrow = `url(#arw-${row.color.replace("#", "")})`;
  const common = {
    stroke: row.color,
    strokeWidth: sw,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: ghost ? 0.7 : 1,
    strokeDasharray: ghost ? `${1.2 * k} ${0.8 * k}` : undefined,
  };
  const handles = !ghost && onHandle && (
    <>
      {p.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={1.5 * k}
          fill={selected ? row.color : "transparent"}
          fillOpacity={selected ? 0.9 : 0.001}
          stroke={selected ? "#fff" : "transparent"}
          strokeWidth={0.3 * k}
          onPointerDown={(e) => onHandle(e, i)}
          style={{ cursor: "grab" }}
        />
      ))}
    </>
  );

  const glow = selected ? { filter: "drop-shadow(0 0 1.2px rgba(255,255,255,.9))" } : undefined;

  if (row.kind === "route") {
    const first = p[0];
    const last = p[p.length - 1];
    return (
      <g onPointerDown={onHit} style={glow}>
        {p.length > 1 && (
          <path d={smoothPath(p)} {...common} markerEnd={arrow} />
        )}
        {p.slice(1, -1).map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={0.7 * k} fill={row.color} />
        ))}
        {p.length > 1 && (
          <circle cx={last.x} cy={last.y} r={1.1 * k} fill="none" stroke={row.color} strokeWidth={0.35 * k} />
        )}
        {player ? (
          <PlayerPin player={player} x={first.x} y={first.y} color={row.color} k={k} />
        ) : (
          <circle cx={first.x} cy={first.y} r={1.3 * k} fill={row.color} stroke="#fff" strokeWidth={0.3 * k} />
        )}
        {handles}
      </g>
    );
  }

  if (row.kind === "arrow") {
    return (
      <g onPointerDown={onHit} style={glow}>
        <line x1={p[0].x} y1={p[0].y} x2={p[1]?.x ?? p[0].x} y2={p[1]?.y ?? p[0].y} {...common} markerEnd={arrow} />
        {handles}
      </g>
    );
  }

  if (row.kind === "freehand") {
    return (
      <g onPointerDown={onHit} style={glow}>
        <path d={smoothPath(p)} {...common} />
        {!ghost && onHandle && (
          <circle cx={p[0].x} cy={p[0].y} r={1.4 * k} fill="transparent" fillOpacity={0.001} onPointerDown={(e) => onHandle(e, 0)} />
        )}
      </g>
    );
  }

  if (row.kind === "circle" || row.kind === "zone") {
    const b = p[1] ?? p[0];
    const rx = Math.abs(b.x - p[0].x) || 1;
    const ry = row.kind === "circle" ? rx : Math.abs(b.y - p[0].y) || 1;
    return (
      <g onPointerDown={onHit} style={glow}>
        <ellipse
          cx={p[0].x}
          cy={p[0].y}
          rx={rx}
          ry={ry}
          {...common}
          fill={row.color}
          fillOpacity={row.kind === "zone" ? 0.16 : 0.08}
        />
        {handles}
      </g>
    );
  }

  if (row.kind === "rect") {
    const b = p[1] ?? p[0];
    return (
      <g onPointerDown={onHit} style={glow}>
        <rect
          x={Math.min(p[0].x, b.x)}
          y={Math.min(p[0].y, b.y)}
          width={Math.abs(b.x - p[0].x)}
          height={Math.abs(b.y - p[0].y)}
          {...common}
          fill={row.color}
          fillOpacity={0.1}
        />
        {handles}
      </g>
    );
  }

  if (row.kind === "text") {
    return (
      <g onPointerDown={onHit} style={glow}>
        <text
          x={p[0].x}
          y={p[0].y}
          fill={row.color}
          fontSize={2.8 * k}
          fontWeight={700}
          textAnchor="middle"
          stroke="rgba(0,0,0,.8)"
          strokeWidth={0.55 * k}
          style={{ paintOrder: "stroke" }}
        >
          {row.meta?.text ?? ""}
        </text>
        {handles}
      </g>
    );
  }

  // marker
  const type = (row.meta?.markerType ?? "custom") as string;
  const label = MARKER_TYPES.find((m) => m.id === type)?.label ?? "Marker";
  return (
    <g onPointerDown={onHit} style={glow}>
      <circle cx={p[0].x} cy={p[0].y} r={1.8 * k} fill="rgba(8,12,20,.8)" stroke={row.color} strokeWidth={0.4 * k} />
      <circle cx={p[0].x} cy={p[0].y} r={0.7 * k} fill={row.color} />
      <text
        x={p[0].x}
        y={p[0].y + 4 * k}
        textAnchor="middle"
        fill={row.color}
        fontSize={2 * k}
        fontWeight={700}
        stroke="rgba(0,0,0,.75)"
        strokeWidth={0.45 * k}
        style={{ paintOrder: "stroke" }}
      >
        {label}
      </text>
      {handles}
    </g>
  );
}

function PlayerPin({
  player,
  x,
  y,
  color,
  k,
}: {
  player: Player;
  x: number;
  y: number;
  color: string;
  k: number;
}) {
  const { data: url } = useSignedUrl("player-photos", player.photo_url);
  const r = 2.6 * k;
  const cid = `clip-${player.id}`;
  return (
    <g>
      <clipPath id={cid}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <circle cx={x} cy={y} r={r + 0.35 * k} fill="rgba(8,12,20,.9)" />
      {url ? (
        <image
          href={url}
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
          clipPath={`url(#${cid})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <text x={x} y={y + 0.9 * k} textAnchor="middle" fill={color} fontSize={2.2 * k} fontWeight={800}>
          {player.ign.slice(0, 2).toUpperCase()}
        </text>
      )}
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={0.45 * k} />
      <text
        x={x}
        y={y - r - 1.1 * k}
        textAnchor="middle"
        fill={color}
        fontSize={2.1 * k}
        fontWeight={800}
        stroke="rgba(0,0,0,.75)"
        strokeWidth={0.45 * k}
        style={{ paintOrder: "stroke" }}
      >
        {player.ign}
      </text>
    </g>
  );
}
