import { supabase } from "@/integrations/supabase/client";

export type Player = {
  id: string;
  ign: string;
  role: string;
  uid: string | null;
  photo_url: string | null;
  join_date: string;
  status: "active" | "inactive";
  created_at: string;
};

export type Tournament = {
  id: string;
  name: string;
  organizer: string | null;
  date: string;
  num_matches: number;
  status: "ongoing" | "completed";
  mvp_player_id: string | null;
  created_at: string;
};

export type Match = { id: string; tournament_id: string; match_number: number; position: number | null };
export type MatchStat = {
  id: string;
  match_id: string;
  player_id: string;
  kills: number;
  damage: number;
};
export type Achievement = {
  id: string;
  tournament_id: string;
  kind: "points_table" | "banner" | "certificate";
  image_url: string;
  created_at: string;
};

export async function listPlayers() {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function getPlayer(id: string) {
  const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Player | null;
}

export async function listTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function getTournament(id: string) {
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Tournament | null;
}

export async function listMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("match_number");
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function listAllStats() {
  const { data, error } = await supabase.from("match_stats").select("*");
  if (error) throw error;
  return (data ?? []) as MatchStat[];
}

export async function listStatsForTournament(tournamentId: string) {
  const matches = await listMatches(tournamentId);
  if (!matches.length) return { matches: [], stats: [] as MatchStat[] };
  const ids = matches.map((m) => m.id);
  const { data, error } = await supabase.from("match_stats").select("*").in("match_id", ids);
  if (error) throw error;
  return { matches, stats: (data ?? []) as MatchStat[] };
}

export async function listStatsForPlayer(playerId: string) {
  const { data, error } = await supabase
    .from("match_stats")
    .select("*, matches(match_number, tournament_id, created_at)")
    .eq("player_id", playerId);
  if (error) throw error;
  return data ?? [];
}

export async function listAchievements(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_achievements")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Achievement[];
}

export function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export function avg(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0;
}

export function rating(avgKills: number): "Excellent" | "Good" | "Average" | "Needs Improvement" {
  if (avgKills >= 8) return "Excellent";
  if (avgKills >= 5) return "Good";
  if (avgKills >= 2) return "Average";
  return "Needs Improvement";
}

// Tournament placement points table
export const POSITION_POINTS: Record<number, number> = {
  1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
};

export function positionPoints(pos: number | null | undefined): number {
  if (!pos) return 0;
  return POSITION_POINTS[pos] ?? 0;
}

/** Points for a single match = placement points + total team kills that match */
export function matchPoints(position: number | null | undefined, teamKills: number) {
  return positionPoints(position) + teamKills;
}

