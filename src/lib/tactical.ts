import { supabase } from "@/integrations/supabase/client";

/** Normalized point: x/y in 0..100 (percent of the image box). */
export type Pt = { x: number; y: number };

export type AnnKind =
  | "route"
  | "marker"
  | "arrow"
  | "freehand"
  | "circle"
  | "rect"
  | "zone"
  | "text";

export type Ann = {
  id: string;
  scope: "map" | "poi_image";
  map_id: string | null;
  poi_image_id: string | null;
  kind: AnnKind;
  player_id: string | null;
  color: string;
  points: Pt[];
  meta: Record<string, any>;
};

export type Poi = {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  category: string;
  x: number;
  y: number;
  sort_order: number;
};

export type PoiImage = {
  id: string;
  poi_id: string;
  image_url: string;
  title: string | null;
  sort_order: number;
  is_thumbnail: boolean;
};

export type Scope = { scope: "map"; mapId: string } | { scope: "poi_image"; poiImageId: string };

export function scopeKey(s: Scope) {
  return s.scope === "map" ? ["ann", "map", s.mapId] : ["ann", "poi_image", s.poiImageId];
}

function scopeCols(s: Scope) {
  return s.scope === "map"
    ? { scope: "map", map_id: s.mapId, poi_image_id: null }
    : { scope: "poi_image", map_id: null, poi_image_id: s.poiImageId };
}

export async function listAnnotations(s: Scope): Promise<Ann[]> {
  let q = supabase.from("tactical_annotations").select("*").order("created_at");
  q = s.scope === "map" ? q.eq("map_id", s.mapId) : q.eq("poi_image_id", s.poiImageId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Ann[];
}

export async function createAnn(
  s: Scope,
  a: {
    kind: AnnKind;
    color: string;
    points: Pt[];
    player_id?: string | null;
    meta?: Record<string, any>;
  },
): Promise<Ann> {
  const { data: sess } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("tactical_annotations")
    .insert({
      ...scopeCols(s),
      kind: a.kind,
      color: a.color,
      points: a.points as any,
      player_id: a.player_id ?? null,
      meta: (a.meta ?? {}) as any,
      user_id: sess.session?.user.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Ann;
}

export async function restoreAnn(a: Ann) {
  const { error } = await supabase.from("tactical_annotations").insert({
    id: a.id,
    scope: a.scope,
    map_id: a.map_id,
    poi_image_id: a.poi_image_id,
    kind: a.kind,
    player_id: a.player_id,
    color: a.color,
    points: a.points as any,
    meta: a.meta as any,
  });
  if (error) throw error;
}

export async function patchAnn(id: string, patch: Partial<Pick<Ann, "points" | "meta" | "color">>) {
  const { error } = await supabase
    .from("tactical_annotations")
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnn(id: string) {
  const { error } = await supabase.from("tactical_annotations").delete().eq("id", id);
  if (error) throw error;
}

export async function clearScope(s: Scope) {
  let q = supabase.from("tactical_annotations").delete();
  q = s.scope === "map" ? q.eq("map_id", s.mapId) : q.eq("poi_image_id", s.poiImageId);
  const { error } = await q;
  if (error) throw error;
}

/* ------------------------------- POIs -------------------------------- */

export async function listPois(mapId: string): Promise<Poi[]> {
  const { data, error } = await supabase
    .from("map_pois")
    .select("*")
    .eq("map_id", mapId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Poi[];
}

export async function listPoiImages(poiId: string): Promise<PoiImage[]> {
  const { data, error } = await supabase
    .from("map_poi_images")
    .select("*")
    .eq("poi_id", poiId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as PoiImage[];
}

export const POI_CATEGORIES = [
  "location",
  "hot drop",
  "rotation",
  "high ground",
  "danger",
  "safe hold",
] as const;

/* ------------------------- markers & colors -------------------------- */

export const MARKER_TYPES = [
  { id: "player", label: "Player", icon: "user" },
  { id: "enemy", label: "Enemy", icon: "crosshair" },
  { id: "landing", label: "Landing", icon: "parachute" },
  { id: "hold", label: "Hold", icon: "shield" },
  { id: "attack", label: "Attack", icon: "swords" },
  { id: "defend", label: "Defend", icon: "shield-half" },
  { id: "entry", label: "Entry", icon: "log-in" },
  { id: "exit", label: "Exit", icon: "log-out" },
  { id: "high_ground", label: "High Ground", icon: "mountain" },
  { id: "danger", label: "Danger", icon: "alert" },
  { id: "sniper", label: "Sniper", icon: "scope" },
  { id: "vehicle", label: "Vehicle", icon: "car" },
  { id: "revival", label: "Revival", icon: "heart" },
  { id: "poi", label: "Important", icon: "star" },
  { id: "custom", label: "Custom", icon: "pin" },
] as const;

export type MarkerType = (typeof MARKER_TYPES)[number]["id"];

export const MARKER_COLORS: Record<string, string> = {
  player: "#38bdf8",
  enemy: "#ef4444",
  landing: "#a855f7",
  hold: "#22c55e",
  attack: "#f97316",
  defend: "#0ea5e9",
  entry: "#84cc16",
  exit: "#eab308",
  high_ground: "#14b8a6",
  danger: "#f43f5e",
  sniper: "#c084fc",
  vehicle: "#94a3b8",
  revival: "#f472b6",
  poi: "#fbbf24",
  custom: "#e2e8f0",
};

export const PLAYER_COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7", "#14b8a6"];

export function playerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

/** Smooth Catmull-Rom → cubic Bezier through all points. */
export function smoothPath(pts: Pt[]) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${
      p2.y - (p3.y - p1.y) / 6
    } ${p2.x},${p2.y}`;
  }
  return d;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
