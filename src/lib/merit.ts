import { supabase } from "@/integrations/supabase/client";
import { didPlay, positionPoints, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * MERIT INDEX
 *
 * A deterministic 0-100 score built only from data that already exists in the
 * project: active roster players, active benchmark tasks + their submissions,
 * and stored match statistics.
 *
 * Design rules:
 *  - Volume is never rewarded. Match performance uses per-match averages,
 *    normalized across the roster, and is shrunk toward the roster mean for
 *    small sample sizes (so 20 matches can beat 50 matches).
 *  - Task coverage is a ratio of assigned tasks, so a player cannot inflate
 *    Merit by spamming submissions. Extra passes give a small capped bonus.
 *  - An attempted-but-below-target task earns partial credit; an untouched
 *    assigned task costs Merit.
 *  - Role-aware weighting: only stats meaningful for a role drive its score.
 *  - Same input data always produces the same score.
 */

export type MeritTaskStatsRow = {
  player_id: string;
  assigned: number;
  completed: number;
  attempted_not_passed: number;
  pass_submissions: number;
  total_submissions: number;
};

export type MeritRow = {
  player: Player;
  rank: number;
  merit: number;
  /** 0-100 task component */
  task_score: number;
  /** 0-100 competitive component */
  performance_score: number;
  /** 0-100 consistency component */
  consistency: number;
  /** Merit points removed for assigned tasks never attempted. */
  penalty: number;
  assigned: number;
  completed: number;
  attempted_not_passed: number;
  missed: number;
  extra_passes: number;
  matches_played: number;
  avg_kills: number;
  avg_damage: number;
  avg_assists: number;
  avg_placement_points: number;
  /** Reliability of the competitive sample (0-1). */
  sample_weight: number;
};

/* ------------------------------- weights --------------------------------- */

const W_TASK = 0.45;
const W_PERF = 0.4;
const W_CONSISTENCY = 0.15;

/** Merit points subtracted when 100% of assigned tasks are untouched. */
const MAX_MISS_PENALTY = 12;
/** Cap for over-delivering on tasks. */
const MAX_EXTRA_BONUS = 8;
/** Partial credit for attempting a task but missing the requirement. */
const PARTIAL_CREDIT = 0.4;
/** Shrinkage constant — a player needs ~8 matches for a full-weight sample. */
const SAMPLE_K = 8;

type RoleWeights = {
  kills: number;
  damage: number;
  assists: number;
  placement: number;
};

/**
 * Role-aware weighting. Only stats that are meaningful for a role carry
 * weight, so an IGL is not judged on raw frags and a support is not judged
 * purely on kills.
 */
function roleWeights(role: string): RoleWeights {
  switch (role.trim().toLowerCase()) {
    case "igl":
      return { kills: 0.15, damage: 0.15, assists: 0.2, placement: 0.5 };
    case "rusher":
    case "fragger":
      return { kills: 0.45, damage: 0.3, assists: 0.1, placement: 0.15 };
    case "sniper":
      return { kills: 0.35, damage: 0.35, assists: 0.1, placement: 0.2 };
    case "support":
      return { kills: 0.15, damage: 0.25, assists: 0.35, placement: 0.25 };
    case "flex":
      return { kills: 0.3, damage: 0.25, assists: 0.2, placement: 0.25 };
    default:
      return { kills: 0.28, damage: 0.25, assists: 0.22, placement: 0.25 };
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Min-max normalization across the roster; identical values map to 50. */
function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (value: number) => {
    if (!Number.isFinite(value)) return 0;
    if (max - min < 1e-9) return values.length ? 50 : 0;
    return ((value - min) / (max - min)) * 100;
  };
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* --------------------------------- data ---------------------------------- */

export async function listMeritTaskStats(): Promise<MeritTaskStatsRow[]> {
  const { data, error } = await supabase.rpc("merit_task_stats");
  if (error) throw error;
  return (data ?? []) as MeritTaskStatsRow[];
}

export type MeritSource = {
  players: Player[];
  taskStats: MeritTaskStatsRow[];
  entries: StatEntry[];
};

export async function loadMeritSource(): Promise<MeritSource> {
  const [players, taskStats, entries] = await Promise.all([
    listPlayers(),
    listMeritTaskStats(),
    listStatEntries(),
  ]);
  return { players: players as Player[], taskStats, entries };
}

/* ------------------------------ computation ------------------------------ */

type Agg = {
  matches: number;
  kills: number;
  damage: number;
  assists: number;
  placementPoints: number;
  /** per-match points used for consistency */
  perMatch: number[];
};

export function computeMeritIndex(source: MeritSource): MeritRow[] {
  const players = source.players
    .filter((p) => p.status === "active")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const aggs = new Map<string, Agg>();
  for (const p of players) {
    aggs.set(p.id, {
      matches: 0,
      kills: 0,
      damage: 0,
      assists: 0,
      placementPoints: 0,
      perMatch: [],
    });
  }

  for (const entry of source.entries) {
    const agg = aggs.get(entry.player_id);
    if (!agg) continue;
    if (!didPlay(entry)) continue;

    agg.matches += 1;
    agg.kills += entry.kills;
    agg.damage += entry.damage;
    agg.assists += entry.assists;
    const placement = positionPoints(entry.position);
    agg.placementPoints += placement;
    agg.perMatch.push(placement + entry.kills);
  }

  const tasksById = new Map(
    source.taskStats.map((row) => [row.player_id, row]),
  );

  /* ---- competitive averages (never totals) ---- */

  const played = players.filter((p) => (aggs.get(p.id)?.matches ?? 0) > 0);

  const avgOf = (p: Player, key: "kills" | "damage" | "assists") => {
    const agg = aggs.get(p.id)!;
    return agg.matches ? agg[key] / agg.matches : 0;
  };
  const avgPlacement = (p: Player) => {
    const agg = aggs.get(p.id)!;
    return agg.matches ? agg.placementPoints / agg.matches : 0;
  };

  const normKills = normalizer(played.map((p) => avgOf(p, "kills")));
  const normDamage = normalizer(played.map((p) => avgOf(p, "damage")));
  const normAssists = normalizer(played.map((p) => avgOf(p, "assists")));
  const normPlacement = normalizer(played.map(avgPlacement));

  const rawPerf = new Map<string, number>();
  for (const p of players) {
    const w = roleWeights(p.role);
    const agg = aggs.get(p.id)!;
    if (!agg.matches) {
      rawPerf.set(p.id, 0);
      continue;
    }
    const score =
      normKills(avgOf(p, "kills")) * w.kills +
      normDamage(avgOf(p, "damage")) * w.damage +
      normAssists(avgOf(p, "assists")) * w.assists +
      normPlacement(avgPlacement(p)) * w.placement;
    rawPerf.set(p.id, clamp(score));
  }

  // Roster mean of players who actually have matches — the shrinkage target.
  const perfMean = mean(played.map((p) => rawPerf.get(p.id) ?? 0)) || 0;

  const rows: MeritRow[] = players.map((p) => {
    const agg = aggs.get(p.id)!;
    const task = tasksById.get(p.id);

    const assigned = task?.assigned ?? 0;
    const completed = Math.min(task?.completed ?? 0, assigned);
    const attemptedNotPassed = task?.attempted_not_passed ?? 0;
    const missed = Math.max(0, assigned - completed - attemptedNotPassed);
    const passSubmissions = task?.pass_submissions ?? 0;
    const totalSubmissions = task?.total_submissions ?? 0;
    const extraPasses = Math.max(0, passSubmissions - completed);

    /* ---- A. task performance ---- */
    let taskScore: number;
    if (assigned === 0) {
      // No tasks assigned yet — do not punish, keep it neutral.
      taskScore = 50;
    } else {
      const coverage =
        (completed + attemptedNotPassed * PARTIAL_CREDIT) / assigned;
      const extraBonus =
        Math.min(1, extraPasses / assigned) * MAX_EXTRA_BONUS;
      taskScore = clamp(coverage * 100 + extraBonus);
    }

    /* ---- B. competitive performance (shrunk to roster mean) ---- */
    const sampleWeight = agg.matches
      ? agg.matches / (agg.matches + SAMPLE_K)
      : 0;
    const perf = agg.matches
      ? clamp(
          (rawPerf.get(p.id) ?? 0) * sampleWeight +
            perfMean * (1 - sampleWeight),
        )
      : 0;

    /* ---- C. consistency ---- */
    // Task reliability: how often an attempt actually met the requirement.
    const taskReliability = totalSubmissions
      ? passSubmissions / totalSubmissions
      : assigned === 0
        ? 0.5
        : 0;

    // Match steadiness: low relative spread of per-match points = consistent.
    let matchSteadiness = 0.5;
    if (agg.perMatch.length >= 2) {
      const m = mean(agg.perMatch);
      const variance =
        mean(agg.perMatch.map((v) => (v - m) * (v - m))) || 0;
      const cv = m > 0 ? Math.sqrt(variance) / m : 1;
      matchSteadiness = clamp((1 - Math.min(1, cv)) * 100, 0, 100) / 100;
    }

    const consistency = clamp(
      (taskReliability * 0.6 + matchSteadiness * 0.4) * 100,
    );

    /* ---- D. penalty for untouched assigned tasks ---- */
    const penalty = assigned
      ? (missed / assigned) * MAX_MISS_PENALTY
      : 0;

    const merit = clamp(
      taskScore * W_TASK +
        perf * W_PERF +
        consistency * W_CONSISTENCY -
        penalty,
    );

    return {
      player: p,
      rank: 0,
      merit: Math.round(merit * 10) / 10,
      task_score: Math.round(taskScore * 10) / 10,
      performance_score: Math.round(perf * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      penalty: Math.round(penalty * 10) / 10,
      assigned,
      completed,
      attempted_not_passed: attemptedNotPassed,
      missed,
      extra_passes: extraPasses,
      matches_played: agg.matches,
      avg_kills: Math.round((agg.matches ? agg.kills / agg.matches : 0) * 100) / 100,
      avg_damage: Math.round(agg.matches ? agg.damage / agg.matches : 0),
      avg_assists:
        Math.round((agg.matches ? agg.assists / agg.matches : 0) * 100) / 100,
      avg_placement_points:
        Math.round((agg.matches ? agg.placementPoints / agg.matches : 0) * 100) /
        100,
      sample_weight: Math.round(sampleWeight * 100) / 100,
    };
  });

  // Deterministic ordering: merit desc, then task score, then IGN.
  rows.sort(
    (a, b) =>
      b.merit - a.merit ||
      b.task_score - a.task_score ||
      b.performance_score - a.performance_score ||
      a.player.ign.localeCompare(b.player.ign),
  );

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

export function meritTier(merit: number): {
  label: string;
  className: string;
} {
  if (merit >= 80) return { label: "Elite", className: "text-neon" };
  if (merit >= 65) return { label: "Excellent", className: "text-neon" };
  if (merit >= 50) return { label: "Good", className: "text-foreground" };
  if (merit >= 35)
    return { label: "Developing", className: "text-yellow-400" };
  return { label: "Needs Work", className: "text-destructive" };
}
