import { didPlay, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * MERIT INDEX — deterministic 0-100 individual rating.
 *
 * Components (weights renormalised when a component has no data):
 *   45% Tasks           — assigned daily/weekly task performance
 *   40% Performance     — role-aware individual averages vs roster average
 *   15% Consistency     — task reliability + match output stability
 *
 * Fairness rules:
 *   - Placement is TEAM output -> never used.
 *   - Volume (match count / submission count) never adds points.
 *   - Attempted-but-not-passed tasks earn partial credit.
 *   - Untouched tasks are the only source of penalty.
 *   - Small match samples are shrunk toward the neutral 50 baseline.
 *   - A player with no assigned tasks is not punished: the task weight is
 *     redistributed over the remaining components.
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

  task_score: number;
  performance_score: number;
  consistency: number;
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
  avg_kd: number;

  /** Placement is team output — always 0, kept for UI compatibility. */
  avg_placement_points: number;

  /** Informational sample confidence (0-1). Never adds Merit by itself. */
  sample_weight: number;
};

/* -------------------------------------------------------------------------- */
/* WEIGHTS                                                                    */
/* -------------------------------------------------------------------------- */

const W_TASK = 45;
const W_PERFORMANCE = 40;
const W_CONSISTENCY = 15;

/** Partial credit for a task that was attempted but not passed. */
const PARTIAL_CREDIT = 0.4;

/** Capped bonus for verified extra passes beyond the assigned tasks. */
const MAX_EXTRA_BONUS = 8;

/** Capped penalty for assigned tasks the player never even attempted. */
const MAX_MISS_PENALTY = 12;

/** Shrinkage constant: small match samples move toward the neutral 50. */
const SAMPLE_K = 4;

const NEUTRAL = 50;

/* -------------------------------------------------------------------------- */
/* ROLE WEIGHTS (kills / damage / assists)                                    */
/* -------------------------------------------------------------------------- */

type RoleWeights = { kills: number; damage: number; assists: number };

function roleWeights(role: string): RoleWeights {
  switch (role.trim().toLowerCase()) {
    case "igl":
      return { kills: 0.3, damage: 0.35, assists: 0.35 };
    case "rusher":
      return { kills: 0.5, damage: 0.35, assists: 0.15 };
    case "fragger":
      return { kills: 0.55, damage: 0.35, assists: 0.1 };
    case "sniper":
      return { kills: 0.45, damage: 0.45, assists: 0.1 };
    case "support":
      return { kills: 0.25, damage: 0.35, assists: 0.4 };
    case "flex":
      return { kills: 0.4, damage: 0.35, assists: 0.25 };
    default:
      return { kills: 0.4, damage: 0.35, assists: 0.25 };
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Roster average -> 50, twice the roster average -> 100, zero -> 0.
 * With no usable roster baseline everyone sits at the neutral score.
 */
function relativeScore(value: number, rosterAverage: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(rosterAverage) || rosterAverage <= 0) return NEUTRAL;
  return clamp((value / rosterAverage) * NEUTRAL);
}

/* -------------------------------------------------------------------------- */
/* TASK DATA                                                                  */
/* -------------------------------------------------------------------------- */

export async function listMeritTaskStats(): Promise<MeritTaskStatsRow[]> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.rpc("merit_task_stats");

    if (error) {
      console.warn("[Merit] Task stats unavailable:", error.message);
      return [];
    }

    return (data ?? []) as MeritTaskStatsRow[];
  } catch (error) {
    console.warn("[Merit] Task stats unavailable:", error);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* SOURCE                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* AGGREGATION                                                                */
/* -------------------------------------------------------------------------- */

type PlayerAggregate = {
  matches: number;
  kills: number;
  damage: number;
  assists: number;
  /** Individual output per match (no placement). */
  matchOutput: number[];
};

function aggregatePlayers(
  players: Player[],
  entries: StatEntry[],
): Map<string, PlayerAggregate> {
  const map = new Map<string, PlayerAggregate>();

  for (const player of players) {
    map.set(player.id, {
      matches: 0,
      kills: 0,
      damage: 0,
      assists: 0,
      matchOutput: [],
    });
  }

  for (const entry of entries) {
    const aggregate = map.get(entry.player_id);
    if (!aggregate) continue;
    if (!didPlay(entry)) continue;

    aggregate.matches += 1;
    aggregate.kills += entry.kills;
    aggregate.damage += entry.damage;
    aggregate.assists += entry.assists;
    aggregate.matchOutput.push(
      entry.kills + entry.assists * 0.5 + entry.damage / 1000,
    );
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/* MAIN CALCULATION                                                           */
/* -------------------------------------------------------------------------- */

export function computeMeritIndex(source: MeritSource): MeritRow[] {
  const players = source.players
    .filter((player) => player.status === "active")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const aggregates = aggregatePlayers(players, source.entries);

  const taskMap = new Map<string, MeritTaskStatsRow>(
    source.taskStats.map((row) => [row.player_id, row]),
  );

  const playedPlayers = players.filter(
    (player) => (aggregates.get(player.id)?.matches ?? 0) > 0,
  );

  const averageStat = (
    player: Player,
    stat: "kills" | "damage" | "assists",
  ): number => {
    const aggregate = aggregates.get(player.id);
    if (!aggregate || aggregate.matches <= 0) return 0;
    return aggregate[stat] / aggregate.matches;
  };

  const rosterAverageKills = mean(
    playedPlayers.map((player) => averageStat(player, "kills")),
  );
  const rosterAverageDamage = mean(
    playedPlayers.map((player) => averageStat(player, "damage")),
  );
  const rosterAverageAssists = mean(
    playedPlayers.map((player) => averageStat(player, "assists")),
  );

  const rows: MeritRow[] = players.map((player) => {
    const aggregate = aggregates.get(player.id)!;
    const task = taskMap.get(player.id);

    /* ------------------------------- TASKS ------------------------------- */

    const assigned = Math.max(0, task?.assigned ?? 0);

    const completed = Math.min(Math.max(0, task?.completed ?? 0), assigned);

    const attemptedNotPassed = Math.min(
      Math.max(0, task?.attempted_not_passed ?? 0),
      Math.max(0, assigned - completed),
    );

    const missed = Math.max(0, assigned - completed);

    /** Assigned tasks with no submission at all. */
    const untouched = Math.max(0, assigned - completed - attemptedNotPassed);

    const passSubmissions = Math.max(0, task?.pass_submissions ?? 0);
    const totalSubmissions = Math.max(0, task?.total_submissions ?? 0);
    const extraPasses = Math.max(0, passSubmissions - completed);

    /**
     * Completed tasks earn full credit, attempted-but-below-target tasks earn
     * partial credit, untouched tasks earn nothing.
     */
    const taskScore =
      assigned > 0
        ? clamp(
            ((completed + attemptedNotPassed * PARTIAL_CREDIT) / assigned) *
              100,
          )
        : 0;

    /* ---------------------------- PERFORMANCE ---------------------------- */

    let performance = 0;

    if (aggregate.matches > 0) {
      const weights = roleWeights(player.role);

      const raw =
        relativeScore(averageStat(player, "kills"), rosterAverageKills) *
          weights.kills +
        relativeScore(averageStat(player, "damage"), rosterAverageDamage) *
          weights.damage +
        relativeScore(averageStat(player, "assists"), rosterAverageAssists) *
          weights.assists;

      /** Shrink small samples toward the neutral baseline (fairness). */
      const confidence =
        aggregate.matches / (aggregate.matches + SAMPLE_K);

      performance = clamp(NEUTRAL + (raw - NEUTRAL) * confidence);
    }

    /* ---------------------------- CONSISTENCY ---------------------------- */

    const taskReliability =
      totalSubmissions > 0
        ? clamp((passSubmissions / totalSubmissions) * 100)
        : 0;

    let matchConsistency = 0;

    if (aggregate.matches === 1) {
      matchConsistency = NEUTRAL;
    } else if (aggregate.matches >= 2) {
      const average = mean(aggregate.matchOutput);
      const variance = mean(
        aggregate.matchOutput.map((value) => (value - average) ** 2),
      );
      const coefficient =
        average > 0 ? Math.sqrt(variance) / average : 1;

      matchConsistency = clamp((1 - Math.min(1, coefficient)) * 100);
    }

    let consistency: number;

    if (totalSubmissions > 0 && aggregate.matches > 0) {
      consistency = clamp(taskReliability * 0.6 + matchConsistency * 0.4);
    } else if (totalSubmissions > 0) {
      consistency = taskReliability;
    } else {
      consistency = matchConsistency;
    }

    /* ------------------------ WEIGHT RENORMALISATION ---------------------- */

    const hasTasks = assigned > 0;
    const hasMatches = aggregate.matches > 0;
    const hasConsistency = hasTasks || hasMatches;

    let wTask = hasTasks ? W_TASK : 0;
    let wPerformance = hasMatches ? W_PERFORMANCE : 0;
    let wConsistency = hasConsistency ? W_CONSISTENCY : 0;

    const totalWeight = wTask + wPerformance + wConsistency;

    let base: number;

    if (totalWeight <= 0) {
      base = 0;
    } else {
      wTask = (wTask / totalWeight) * 100;
      wPerformance = (wPerformance / totalWeight) * 100;
      wConsistency = (wConsistency / totalWeight) * 100;

      base =
        (taskScore * wTask +
          performance * wPerformance +
          consistency * wConsistency) /
        100;
    }

    /* ----------------------------- ADJUSTMENTS --------------------------- */

    const penalty =
      assigned > 0 ? (untouched / assigned) * MAX_MISS_PENALTY : 0;

    const bonus =
      assigned > 0 ? Math.min(MAX_EXTRA_BONUS, extraPasses * 2) : 0;

    const merit = clamp(base - penalty + bonus);

    const sampleWeight =
      aggregate.matches > 0
        ? aggregate.matches / (aggregate.matches + SAMPLE_K)
        : 0;

    return {
      player,
      rank: 0,
      merit: round(merit),
      task_score: round(taskScore),
      performance_score: round(performance),
      consistency: round(consistency),
      penalty: round(penalty),
      assigned,
      completed,
      attempted_not_passed: attemptedNotPassed,
      missed,
      extra_passes: extraPasses,
      matches_played: aggregate.matches,
      avg_kills: round(averageStat(player, "kills"), 2),
      avg_damage: Math.round(averageStat(player, "damage")),
      avg_assists: round(averageStat(player, "assists"), 2),
      /** No deaths stored yet — kills per played match is the K/D-style proxy. */
      avg_kd: round(averageStat(player, "kills"), 2),
      avg_placement_points: 0,
      sample_weight: round(sampleWeight, 2),
    };
  });

  rows.sort(
    (a, b) =>
      b.merit - a.merit ||
      b.task_score - a.task_score ||
      b.performance_score - a.performance_score ||
      b.consistency - a.consistency ||
      b.avg_kills - a.avg_kills ||
      b.avg_damage - a.avg_damage ||
      a.player.ign.localeCompare(b.player.ign),
  );

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

/* -------------------------------------------------------------------------- */
/* MERIT TIERS                                                                */
/* -------------------------------------------------------------------------- */

export function meritTier(merit: number): {
  label: string;
  className: string;
} {
  if (merit >= 85) {
    return { label: "Elite", className: "text-neon" };
  }

  if (merit >= 70) {
    return { label: "Strong", className: "text-emerald-400" };
  }

  if (merit >= 55) {
    return { label: "Stable", className: "text-sky-400" };
  }

  if (merit >= 40) {
    return { label: "Developing", className: "text-yellow-400" };
  }

  return { label: "Needs Work", className: "text-destructive" };
}
