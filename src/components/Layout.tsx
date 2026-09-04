import { didPlay, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * MERIT INDEX
 *
 * FIXED WEIGHTAGE:
 *   45% Tasks
 *   40% Individual Performance
 *   15% Consistency
 *
 * IMPORTANT:
 * - Placement is TEAM performance and is NOT used for individual Merit.
 * - Match count does NOT directly award Merit.
 * - Performance is based only on individual statistics.
 * - When OCR/task data becomes available, it automatically fills the 45%
 *   task component without changing the overall formula.
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

  /**
   * Current database does not store deaths separately.
   * Therefore this is the available K/D-style value:
   * kills per played match.
   */
  avg_kd: number;

  /**
   * Kept for UI compatibility only.
   * NEVER used in Merit calculation.
   */
  avg_placement_points: number;

  /**
   * 0-1 reliability of the competitive sample.
   * It does not itself add points.
   */
  sample_weight: number;
};

/* -------------------------------------------------------------------------- */
/* WEIGHTS                                                                    */
/* -------------------------------------------------------------------------- */

const W_TASK = 0.45;
const W_PERFORMANCE = 0.4;
const W_CONSISTENCY = 0.15;

const MAX_MISS_PENALTY = 12;
const MAX_EXTRA_BONUS = 8;
const PARTIAL_CREDIT = 0.4;

/**
 * Sample-size smoothing.
 *
 * More matches do NOT automatically increase Merit.
 * This only reduces the influence of tiny samples.
 */
const SAMPLE_K = 8;

/* -------------------------------------------------------------------------- */
/* ROLE WEIGHTS                                                               */
/* -------------------------------------------------------------------------- */

type RoleWeights = {
  kills: number;
  damage: number;
  assists: number;
  kd: number;
};

/**
 * Role-aware weighting is applied only to INDIVIDUAL metrics.
 *
 * Placement is intentionally absent.
 */
function roleWeights(role: string): RoleWeights {
  switch (role.trim().toLowerCase()) {
    case "igl":
      return {
        kills: 0.2,
        damage: 0.2,
        assists: 0.25,
        kd: 0.35,
      };

    case "rusher":
    case "fragger":
      return {
        kills: 0.4,
        damage: 0.25,
        assists: 0.1,
        kd: 0.25,
      };

    case "sniper":
      return {
        kills: 0.3,
        damage: 0.35,
        assists: 0.1,
        kd: 0.25,
      };

    case "support":
      return {
        kills: 0.15,
        damage: 0.25,
        assists: 0.35,
        kd: 0.25,
      };

    case "flex":
      return {
        kills: 0.3,
        damage: 0.25,
        assists: 0.2,
        kd: 0.25,
      };

    default:
      return {
        kills: 0.3,
        damage: 0.25,
        assists: 0.2,
        kd: 0.25,
      };
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function mean(values: number[]): number {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

/**
 * Normalizes a metric across players.
 *
 * Lowest  -> 0
 * Highest -> 100
 * Same    -> 50
 */
function normalizer(
  values: number[],
) {
  const finite = values.filter(
    Number.isFinite,
  );

  if (!finite.length) {
    return () => 0;
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);

  return (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (max - min < 1e-9) {
      return 50;
    }

    return (
      ((value - min) /
        (max - min)) *
      100
    );
  };
}

/* -------------------------------------------------------------------------- */
/* TASK DATA                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Task/OCR data is optional.
 *
 * Until the RPC exists/returns data:
 * - task score stays neutral at 50
 * - no player is falsely rewarded or punished
 *
 * Once OCR/task data starts returning rows, the same 45% bucket
 * automatically starts using it.
 */
export async function listMeritTaskStats(): Promise<
  MeritTaskStatsRow[]
> {
  try {
    const { supabase } = await import(
      "@/integrations/supabase/client"
    );

    const {
      data,
      error,
    } = await supabase.rpc(
      "merit_task_stats",
    );

    if (error) {
      console.warn(
        "[Merit] Task stats unavailable:",
        error.message,
      );

      return [];
    }

    return (
      data ?? []
    ) as MeritTaskStatsRow[];
  } catch (error) {
    console.warn(
      "[Merit] Task stats unavailable:",
      error,
    );

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

export async function loadMeritSource(): Promise<
  MeritSource
> {
  const [
    players,
    taskStats,
    entries,
  ] = await Promise.all([
    listPlayers(),
    listMeritTaskStats(),
    listStatEntries(),
  ]);

  return {
    players:
      players as Player[],
    taskStats,
    entries,
  };
}

/* -------------------------------------------------------------------------- */
/* AGGREGATION                                                                */
/* -------------------------------------------------------------------------- */

type PlayerAggregate = {
  matches: number;
  kills: number;
  damage: number;
  assists: number;

  /**
   * Individual match performance used for consistency.
   * Placement is NEVER included.
   */
  matchPerformance: number[];
};

function aggregatePlayers(
  entries: StatEntry[],
  players: Player[],
): Map<string, PlayerAggregate> {
  const map = new Map<
    string,
    PlayerAggregate
  >();

  for (const player of players) {
    map.set(player.id, {
      matches: 0,
      kills: 0,
      damage: 0,
      assists: 0,
      matchPerformance: [],
    });
  }

  for (const entry of entries) {
    const agg = map.get(
      entry.player_id,
    );

    if (!agg) continue;

    /**
     * Same played-match rule already used elsewhere:
     * a player counts for the match if any individual stat > 0.
     */
    if (!didPlay(entry)) {
      continue;
    }

    agg.matches += 1;
    agg.kills += entry.kills;
    agg.damage += entry.damage;
    agg.assists += entry.assists;

    /**
     * Individual-only consistency number.
     *
     * Damage is scaled only so it can be combined with kills/assists.
     * This is NOT the final Merit score.
     *
     * NO placement.
     */
    agg.matchPerformance.push(
      entry.kills +
        entry.assists +
        entry.damage / 1000,
    );
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/* MAIN CALCULATION                                                           */
/* -------------------------------------------------------------------------- */

export function computeMeritIndex(
  source: MeritSource,
): MeritRow[] {
  const players = source.players
    .filter(
      (player) =>
        player.status === "active",
    )
    .slice()
    .sort((a, b) =>
      a.id.localeCompare(b.id),
    );

  const aggs = aggregatePlayers(
    source.entries,
    players,
  );

  const taskMap = new Map(
    source.taskStats.map(
      (row) => [
        row.player_id,
        row,
      ],
    ),
  );

  const playersWithMatches =
    players.filter(
      (player) =>
        (aggs.get(
          player.id,
        )?.matches ?? 0) > 0,
    );

  /* ---------------------------------------------------------------------- */
  /* AVERAGES                                                               */
  /* ---------------------------------------------------------------------- */

  const averageStat = (
    player: Player,
    stat:
      | "kills"
      | "damage"
      | "assists",
  ) => {
    const agg =
      aggs.get(player.id)!;

    if (!agg.matches) {
      return 0;
    }

    return (
      agg[stat] /
      agg.matches
    );
  };

  /**
   * Current DB has no separate deaths field.
   *
   * So the currently available K/D-style metric is:
   *
   *     kills / played matches
   *
   * As soon as a deaths field exists, this function can become
   * actual kills/deaths without touching the rest of the formula.
   */
  const averageKd = (
    player: Player,
  ) => {
    return averageStat(
      player,
      "kills",
    );
  };

  /* ---------------------------------------------------------------------- */
  /* NORMALIZATION                                                          */
  /* ---------------------------------------------------------------------- */

  const normalizeKills =
    normalizer(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "kills",
          ),
      ),
    );

  const normalizeDamage =
    normalizer(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "damage",
          ),
      ),
    );

  const normalizeAssists =
    normalizer(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "assists",
          ),
      ),
    );

  const normalizeKd =
    normalizer(
      playersWithMatches.map(
        averageKd,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* RAW INDIVIDUAL PERFORMANCE                                             */
  /* ---------------------------------------------------------------------- */

  const rawPerformance =
    new Map<string, number>();

  for (const player of players) {
    const agg =
      aggs.get(player.id)!;

    if (!agg.matches) {
      rawPerformance.set(
        player.id,
        0,
      );

      continue;
    }

    const weights =
      roleWeights(
        player.role,
      );

    const score =
      normalizeKills(
        averageStat(
          player,
          "kills",
        ),
      ) *
        weights.kills +
      normalizeDamage(
        averageStat(
          player,
          "damage",
        ),
      ) *
        weights.damage +
      normalizeAssists(
        averageStat(
          player,
          "assists",
        ),
      ) *
        weights.assists +
      normalizeKd(
        averageKd(player),
      ) *
        weights.kd;

    rawPerformance.set(
      player.id,
      clamp(score),
    );
  }

  const performanceMean =
    mean(
      playersWithMatches.map(
        (player) =>
          rawPerformance.get(
            player.id,
          ) ?? 0,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* FINAL ROWS                                                             */
  /* ---------------------------------------------------------------------- */

  const rows: MeritRow[] =
    players.map((player) => {
      const agg =
        aggs.get(player.id)!;

      const task =
        taskMap.get(player.id);

      /* ---------------------------- TASKS ----------------------------- */

      const assigned =
        task?.assigned ?? 0;

      const completed =
        Math.min(
          task?.completed ?? 0,
          assigned,
        );

      const attemptedNotPassed =
        task?.attempted_not_passed ??
        0;

      const missed =
        Math.max(
          0,
          assigned -
            completed -
            attemptedNotPassed,
        );

      const passSubmissions =
        task?.pass_submissions ??
        0;

      const totalSubmissions =
        task?.total_submissions ??
        0;

      const extraPasses =
        Math.max(
          0,
          passSubmissions -
            completed,
        );

      /**
       * Until real task/OCR data exists,
       * this remains neutral.
       */
      let taskScore = 50;

      if (assigned > 0) {
        const coverage =
          (
            completed +
            attemptedNotPassed *
              PARTIAL_CREDIT
          ) /
          assigned;

        const extraBonus =
          Math.min(
            1,
            extraPasses /
              assigned,
          ) *
          MAX_EXTRA_BONUS;

        taskScore =
          clamp(
            coverage * 100 +
              extraBonus,
          );
      }

      /* ----------------------- PERFORMANCE ---------------------------- */

      /**
       * Match count ONLY affects reliability.
       * It does not add points directly.
       */
      const sampleWeight =
        agg.matches > 0
          ? agg.matches /
            (agg.matches +
              SAMPLE_K)
          : 0;

      const performance =
        agg.matches > 0
          ? clamp(
              (
                rawPerformance.get(
                  player.id,
                ) ?? 0
              ) *
                sampleWeight +
                performanceMean *
                  (1 -
                    sampleWeight),
            )
          : 0;

      /* ------------------------ CONSISTENCY ---------------------------- */

      /**
       * Task reliability is neutral until task/OCR data exists.
       */
      const taskReliability =
        totalSubmissions > 0
          ? passSubmissions /
            totalSubmissions
          : 0.5;

      /**
       * Individual match consistency.
       *
       * NO PLACEMENT.
       */
      let matchConsistency = 0.5;

      if (
        agg.matchPerformance
          .length >= 2
      ) {
        const avg =
          mean(
            agg.matchPerformance,
          );

        const variance =
          mean(
            agg.matchPerformance.map(
              (value) =>
                (
                  value - avg
                ) ** 2,
            ),
          );

        const standardDeviation =
          Math.sqrt(
            variance,
          );

        const coefficient =
          avg > 0
            ? standardDeviation /
              avg
            : 1;

        matchConsistency =
          clamp(
            1 -
              Math.min(
                1,
                coefficient,
              ),
            0,
            1,
          );
      }

      const consistency =
        clamp(
          (
            taskReliability *
              0.6 +
            matchConsistency *
              0.4
          ) * 100,
        );

      /* -------------------------- PENALTY ------------------------------ */

      const penalty =
        assigned > 0
          ? (
              missed /
              assigned
            ) *
            MAX_MISS_PENALTY
          : 0;

      /* ---------------------------- MERIT ------------------------------ */

      /**
       * FINAL FORMULA:
       *
       * 45% Tasks
       * 40% Individual Performance
       * 15% Consistency
       *
       * Placement = ZERO.
       */
      const merit =
        clamp(
          taskScore *
            W_TASK +
            performance *
              W_PERFORMANCE +
            consistency *
              W_CONSISTENCY -
            penalty,
        );

      return {
        player,
        rank: 0,

        merit:
          Math.round(
            merit * 10,
          ) / 10,

        task_score:
          Math.round(
            taskScore * 10,
          ) / 10,

        performance_score:
          Math.round(
            performance * 10,
          ) / 10,

        consistency:
          Math.round(
            consistency * 10,
          ) / 10,

        penalty:
          Math.round(
            penalty * 10,
          ) / 10,

        assigned,
        completed,

        attempted_not_passed:
          attemptedNotPassed,

        missed,
        extra_passes:
          extraPasses,

        matches_played:
          agg.matches,

        avg_kills:
          Math.round(
            averageStat(
              player,
              "kills",
            ) * 100,
          ) / 100,

        avg_damage:
          Math.round(
            averageStat(
              player,
              "damage",
            ),
          ),

        avg_assists:
          Math.round(
            averageStat(
              player,
              "assists",
            ) * 100,
          ) / 100,

        avg_kd:
          Math.round(
            averageKd(player) *
              100,
          ) / 100,

        /**
         * Explicitly zero.
         * Placement is team performance and is never used.
         */
        avg_placement_points: 0,

        sample_weight:
          Math.round(
            sampleWeight * 100,
          ) / 100,
      };
    });

  /* ---------------------------------------------------------------------- */
  /* RANKING                                                                */
  /* ---------------------------------------------------------------------- */

  rows.sort(
    (a, b) =>
      b.merit - a.merit ||
      b.performance_score -
        a.performance_score ||
      b.avg_kd -
        a.avg_kd ||
      b.avg_kills -
        a.avg_kills ||
      b.avg_damage -
        a.avg_damage ||
      a.player.ign.localeCompare(
        b.player.ign,
      ),
  );

  rows.forEach(
    (row, index) => {
      row.rank =
        index + 1;
    },
  );

  return rows;
}

/* -------------------------------------------------------------------------- */
/* TIERS                                                                      */
/* -------------------------------------------------------------------------- */

export function meritTier(
  merit: number,
): {
  label: string;
  className: string;
} {
  if (merit >= 80) {
    return {
      label: "Elite",
      className: "text-neon",
    };
  }

  if (merit >= 65) {
    return {
      label: "Excellent",
      className: "text-neon",
    };
  }

  if (merit >= 50) {
    return {
      label: "Good",
      className: "text-foreground",
    };
  }

  if (merit >= 35) {
    return {
      label: "Developing",
      className: "text-yellow-400",
    };
  }

  return {
    label: "Needs Work",
    className: "text-destructive",
  };
}
