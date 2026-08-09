import { positionPoints, didPlay, type Player } from "@/lib/data";
import type { StatEntry } from "@/lib/stats-core";

/* --------------------------- Per-match aggregation ------------------------- */

export type MatchAgg = {
  match_id: string;
  match_number: number;
  position: number | null;
  tournament_id: string;
  tournament_name: string;
  tournament_date: string;
  kills: number;
  damage: number;
  assists: number;
  points: number;
};

/** Collapse stat rows into one row per match with team totals + points. */
export function aggregateMatches(entries: StatEntry[]): MatchAgg[] {
  const map = new Map<string, MatchAgg>();
  for (const e of entries) {
    const cur =
      map.get(e.match_id) ??
      ({
        match_id: e.match_id,
        match_number: e.match_number,
        position: e.position,
        tournament_id: e.tournament_id,
        tournament_name: e.tournament_name,
        tournament_date: e.tournament_date,
        kills: 0,
        damage: 0,
        assists: 0,
        points: 0,
      } as MatchAgg);
    cur.kills += e.kills;
    cur.damage += e.damage;
    cur.assists += e.assists;
    map.set(e.match_id, cur);
  }
  const list = [...map.values()];
  for (const m of list) m.points = positionPoints(m.position) + m.kills;
  return list.sort(
    (a, b) =>
      String(a.tournament_date).localeCompare(String(b.tournament_date)) ||
      a.match_number - b.match_number,
  );
}

/* ------------------------- Match-number (slot) strength ------------------- */

export type SlotStat = {
  match_number: number;
  matches: number;
  points: number;
  kills: number;
  avgPoints: number;
  avgKills: number;
  avgPosition: number | null;
  wins: number;
  top3: number;
  bestPosition: number | null;
};

/**
 * How strong the team usually is in match #1, #2, #3 … across every
 * scrim/tournament — the "which round do we peak in" analysis.
 */
export function slotStrength(entries: StatEntry[]): SlotStat[] {
  const matches = aggregateMatches(entries);
  const map = new Map<number, SlotStat & { posSum: number; posCount: number }>();
  for (const m of matches) {
    const cur =
      map.get(m.match_number) ??
      ({
        match_number: m.match_number,
        matches: 0,
        points: 0,
        kills: 0,
        avgPoints: 0,
        avgKills: 0,
        avgPosition: null,
        wins: 0,
        top3: 0,
        bestPosition: null,
        posSum: 0,
        posCount: 0,
      } as SlotStat & { posSum: number; posCount: number });
    cur.matches += 1;
    cur.points += m.points;
    cur.kills += m.kills;
    if (m.position != null) {
      cur.posSum += m.position;
      cur.posCount += 1;
      cur.bestPosition =
        cur.bestPosition == null ? m.position : Math.min(cur.bestPosition, m.position);
      if (m.position === 1) cur.wins += 1;
      if (m.position <= 3) cur.top3 += 1;
    }
    map.set(m.match_number, cur);
  }
  return [...map.values()]
    .map((s) => ({
      match_number: s.match_number,
      matches: s.matches,
      points: s.points,
      kills: s.kills,
      avgPoints: s.matches ? s.points / s.matches : 0,
      avgKills: s.matches ? s.kills / s.matches : 0,
      avgPosition: s.posCount ? s.posSum / s.posCount : null,
      wins: s.wins,
      top3: s.top3,
      bestPosition: s.bestPosition,
    }))
    .sort((a, b) => a.match_number - b.match_number);
}

/* ----------------------------- Placement spread --------------------------- */

export type PlacementBucket = { position: number; count: number; share: number };

export function placementSpread(entries: StatEntry[]): PlacementBucket[] {
  const matches = aggregateMatches(entries).filter((m) => m.position != null);
  const total = matches.length || 1;
  const counts = new Map<number, number>();
  for (const m of matches) counts.set(m.position!, (counts.get(m.position!) ?? 0) + 1);
  return [...counts.entries()]
    .map(([position, count]) => ({ position, count, share: (count / total) * 100 }))
    .sort((a, b) => a.position - b.position);
}

/* --------------------------- Tournament-by-tournament --------------------- */

export type TournamentAgg = {
  tournament_id: string;
  name: string;
  date: string;
  matches: number;
  kills: number;
  damage: number;
  points: number;
  avgPoints: number;
  avgPosition: number | null;
  wins: number;
};

export function tournamentTrend(entries: StatEntry[]): TournamentAgg[] {
  const matches = aggregateMatches(entries);
  const map = new Map<string, TournamentAgg & { posSum: number; posCount: number }>();
  for (const m of matches) {
    const cur =
      map.get(m.tournament_id) ??
      ({
        tournament_id: m.tournament_id,
        name: m.tournament_name,
        date: m.tournament_date,
        matches: 0,
        kills: 0,
        damage: 0,
        points: 0,
        avgPoints: 0,
        avgPosition: null,
        wins: 0,
        posSum: 0,
        posCount: 0,
      } as TournamentAgg & { posSum: number; posCount: number });
    cur.matches += 1;
    cur.kills += m.kills;
    cur.damage += m.damage;
    cur.points += m.points;
    if (m.position != null) {
      cur.posSum += m.position;
      cur.posCount += 1;
      if (m.position === 1) cur.wins += 1;
    }
    map.set(m.tournament_id, cur);
  }
  return [...map.values()]
    .map((t) => ({
      tournament_id: t.tournament_id,
      name: t.name,
      date: t.date,
      matches: t.matches,
      kills: t.kills,
      damage: t.damage,
      points: t.points,
      avgPoints: t.matches ? t.points / t.matches : 0,
      avgPosition: t.posCount ? t.posSum / t.posCount : null,
      wins: t.wins,
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* ------------------------------ Kill share -------------------------------- */

export type ShareRow = { player: Player; kills: number; damage: number; assists: number; share: number };

export function killShare(entries: StatEntry[], players: Player[]): ShareRow[] {
  const map = new Map<string, { k: number; d: number; a: number }>();
  let total = 0;
  for (const e of entries) {
    const cur = map.get(e.player_id) ?? { k: 0, d: 0, a: 0 };
    cur.k += e.kills;
    cur.d += e.damage;
    cur.a += e.assists;
    total += e.kills;
    map.set(e.player_id, cur);
  }
  const denom = total || 1;
  return [...map.entries()]
    .map(([pid, v]) => {
      const player = players.find((p) => p.id === pid);
      return player
        ? { player, kills: v.k, damage: v.d, assists: v.a, share: (v.k / denom) * 100 }
        : null;
    })
    .filter((r): r is ShareRow => Boolean(r))
    .sort((a, b) => b.kills - a.kills);
}

/* ------------------------------ Team insights ----------------------------- */

export type Insights = {
  matches: number;
  avgPoints: number;
  avgPosition: number | null;
  winRate: number;
  top3Rate: number;
  consistency: number; // 0-100, higher = steadier points
  damagePerKill: number;
  bestSlot: SlotStat | null;
  worstSlot: SlotStat | null;
  bestMatch: MatchAgg | null;
  momentum: number; // % change, last 3 tournaments vs earlier
  survivalPoints: number;
  killPoints: number;
  activePlayers: number;
};

export function teamInsights(entries: StatEntry[]): Insights {
  const matches = aggregateMatches(entries);
  const slots = slotStrength(entries);
  const trend = tournamentTrend(entries);
  const withPos = matches.filter((m) => m.position != null);
  const pts = matches.map((m) => m.points);
  const avgPoints = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
  const variance = pts.length
    ? pts.reduce((a, b) => a + (b - avgPoints) ** 2, 0) / pts.length
    : 0;
  const sd = Math.sqrt(variance);
  const consistency = avgPoints > 0 ? Math.max(0, Math.min(100, 100 - (sd / avgPoints) * 100)) : 0;
  const kills = matches.reduce((a, m) => a + m.kills, 0);
  const damage = matches.reduce((a, m) => a + m.damage, 0);
  const survivalPoints = matches.reduce((a, m) => a + positionPoints(m.position), 0);

  const ranked = [...slots].filter((s) => s.matches > 0).sort((a, b) => b.avgPoints - a.avgPoints);
  const last3 = trend.slice(-3);
  const prev = trend.slice(0, -3);
  const lastAvg = last3.length ? last3.reduce((a, t) => a + t.avgPoints, 0) / last3.length : 0;
  const prevAvg = prev.length ? prev.reduce((a, t) => a + t.avgPoints, 0) / prev.length : 0;

  return {
    matches: matches.length,
    avgPoints,
    avgPosition: withPos.length
      ? withPos.reduce((a, m) => a + (m.position ?? 0), 0) / withPos.length
      : null,
    winRate: withPos.length
      ? (withPos.filter((m) => m.position === 1).length / withPos.length) * 100
      : 0,
    top3Rate: withPos.length
      ? (withPos.filter((m) => (m.position ?? 99) <= 3).length / withPos.length) * 100
      : 0,
    consistency,
    damagePerKill: kills ? damage / kills : 0,
    bestSlot: ranked[0] ?? null,
    worstSlot: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    bestMatch: [...matches].sort((a, b) => b.points - a.points)[0] ?? null,
    momentum: prevAvg > 0 ? ((lastAvg - prevAvg) / prevAvg) * 100 : 0,
    survivalPoints,
    killPoints: kills,
    activePlayers: new Set(entries.filter(didPlay).map((e) => e.player_id)).size,
  };
}
