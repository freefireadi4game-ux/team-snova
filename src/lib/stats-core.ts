import { supabase } from "@/integrations/supabase/client";
import { didPlay, positionPoints, type Player } from "@/lib/data";

/** A single flattened stat row joined with its match + tournament context. */
export type StatEntry = {
  id: string;
  player_id: string;
  match_id: string;
  kills: number;
  damage: number;
  assists: number;
  match_number: number;
  position: number | null;
  match_created_at: string;
  tournament_id: string;
  tournament_name: string;
  tournament_date: string;
};

/** One fetch that powers every leaderboard, KPI and achievement on the site. */
export async function listStatEntries(): Promise<StatEntry[]> {
  const { data, error } = await supabase
    .from("match_stats")
    .select(
      "id, player_id, match_id, kills, damage, assists, matches(match_number, position, created_at, tournament_id, tournaments(name, date))",
    );
  if (error) throw error;
  const rows: StatEntry[] = [];
  for (const s of (data ?? []) as any[]) {
    const m = s.matches;
    if (!m) continue;
    rows.push({
      id: s.id,
      player_id: s.player_id,
      match_id: s.match_id,
      kills: s.kills ?? 0,
      damage: s.damage ?? 0,
      assists: s.assists ?? 0,
      match_number: m.match_number,
      position: m.position ?? null,
      match_created_at: m.created_at,
      tournament_id: m.tournament_id,
      tournament_name: m.tournaments?.name ?? "—",
      tournament_date: m.tournaments?.date ?? m.created_at?.slice(0, 10) ?? "",
    });
  }
  return rows;
}

/* ------------------------------ Month periods ----------------------------- */

/** "2026-08" */
export type MonthKey = string;
export const OVERALL = "overall" as const;
export type Period = MonthKey | typeof OVERALL;

export function monthKeyOf(entry: StatEntry): MonthKey {
  const d = entry.tournament_date || entry.match_created_at;
  return String(d).slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function monthShortLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/** Descending list of months that actually contain data. */
export function availableMonths(entries: StatEntry[]): MonthKey[] {
  const set = new Set<MonthKey>();
  for (const e of entries) {
    const k = monthKeyOf(e);
    if (k) set.add(k);
  }
  return [...set].sort().reverse();
}

export function filterByPeriod(entries: StatEntry[], period: Period): StatEntry[] {
  if (period === OVERALL) return entries;
  return entries.filter((e) => monthKeyOf(e) === period);
}

export function periodLabel(period: Period): string {
  return period === OVERALL ? "All Time" : monthLabel(period);
}

/* ------------------------------- Aggregation ------------------------------ */

export type PlayerAgg = {
  player_id: string;
  kills: number;
  damage: number;
  assists: number;
  matches: number;
  bestKills: number;
  bestDamage: number;
  tournaments: number;
  wins: number;
  top3: number;
};

/** Aggregate per player. Only matches where the player actually logged something count. */
export function aggregateByPlayer(entries: StatEntry[]): Map<string, PlayerAgg> {
  const map = new Map<string, PlayerAgg>();
  const tourSets = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!didPlay(e)) continue;
    const cur =
      map.get(e.player_id) ??
      ({
        player_id: e.player_id,
        kills: 0,
        damage: 0,
        assists: 0,
        matches: 0,
        bestKills: 0,
        bestDamage: 0,
        tournaments: 0,
        wins: 0,
        top3: 0,
      } as PlayerAgg);
    cur.kills += e.kills;
    cur.damage += e.damage;
    cur.assists += e.assists;
    cur.matches += 1;
    cur.bestKills = Math.max(cur.bestKills, e.kills);
    cur.bestDamage = Math.max(cur.bestDamage, e.damage);
    if (e.position === 1) cur.wins += 1;
    if (e.position !== null && e.position <= 3) cur.top3 += 1;
    map.set(e.player_id, cur);
    const ts = tourSets.get(e.player_id) ?? new Set<string>();
    ts.add(e.tournament_id);
    tourSets.set(e.player_id, ts);
  }
  for (const [pid, set] of tourSets) {
    const agg = map.get(pid);
    if (agg) agg.tournaments = set.size;
  }
  return map;
}

export type TeamTotals = {
  kills: number;
  damage: number;
  assists: number;
  matches: number;
  tournaments: number;
  points: number;
  killsPerMatch: number;
  killsPerTournament: number;
};

export function teamTotals(entries: StatEntry[]): TeamTotals {
  let kills = 0;
  let damage = 0;
  let assists = 0;
  const matchSet = new Set<string>();
  const tourSet = new Set<string>();
  const matchKills = new Map<string, { k: number; pos: number | null }>();
  for (const e of entries) {
    kills += e.kills;
    damage += e.damage;
    assists += e.assists;
    if (didPlay(e)) matchSet.add(e.match_id);
    tourSet.add(e.tournament_id);
    const cur = matchKills.get(e.match_id) ?? { k: 0, pos: e.position };
    cur.k += e.kills;
    matchKills.set(e.match_id, cur);
  }
  let points = 0;
  for (const [, v] of matchKills) points += positionPoints(v.pos) + v.k;
  const matches = matchSet.size;
  const tournaments = tourSet.size;
  return {
    kills,
    damage,
    assists,
    matches,
    tournaments,
    points,
    killsPerMatch: matches ? kills / matches : 0,
    killsPerTournament: tournaments ? kills / tournaments : 0,
  };
}

export type BoardRow = PlayerAgg & { player: Player };

export function buildLeaderboard(entries: StatEntry[], players: Player[]): BoardRow[] {
  const agg = aggregateByPlayer(entries);
  return [...agg.values()]
    .map((a) => ({ ...a, player: players.find((p) => p.id === a.player_id) }))
    .filter((r): r is BoardRow => Boolean(r.player))
    .sort((a, b) => b.kills - a.kills || b.damage - a.damage);
}
