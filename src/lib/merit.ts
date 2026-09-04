import { didPlay, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * Merit Index
 *
 * FINAL WEIGHTAGE:
 *   45% Tasks
 *   40% Individual Performance
 *   15% Consistency
 *
 * INDIVIDUAL PERFORMANCE:
 *   - Average Kills
 *   - Average Damage
 *   - Average Assists
 *   - K/D-style metric
 *
 * RULES:
 *   - Placement = TEAM performance -> never used.
 *   - Match count = never gives direct Merit points.
 *   - A task gets points ONLY when completed.
 *   - Incomplete task = 0 points.
 *   - Failed task = 0 points.
 *   - No partial credit.
 *
 * NOTE:
 * Current match_stats does not contain deaths.
 * Therefore avg_kd currently represents kills per played match.
 * Once deaths are stored, only avgKd() needs to change.
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

  /**
   * Compatibility field only.
   * Always 0 because placement is not part of individual Merit.
   */
  avg_placement_points: number;

  /**
   * Informational sample value only.
   * Never added as points.
   */
  sample_weight: number;
};

/* -------------------------------------------------------------------------- */
/* FIXED MERIT WEIGHTS                                                        */
/* -------------------------------------------------------------------------- */

const W_TASK = 0.45;
const W_PERFORMANCE = 0.40;
const W_CONSISTENCY = 0.15;

const MAX_MISS_PENALTY = 12;
const MAX_EXTRA_BONUS = 8;

/**
 * More matches do NOT directly increase Merit.
 * This constant is only used for the informational sample_weight.
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

function roleWeights(role: string): RoleWeights {
  switch (role.trim().toLowerCase()) {
    case "igl":
      return {
        kills: 0.15,
        damage: 0.25,
        assists: 0.30,
        kd: 0.30,
      };

    case "rusher":
      return {
        kills: 0.40,
        damage: 0.25,
        assists: 0.10,
        kd: 0.25,
      };

    case "fragger":
      return {
        kills: 0.45,
        damage: 0.25,
        assists: 0.05,
        kd: 0.25,
      };

    case "sniper":
      return {
        kills: 0.35,
        damage: 0.35,
        assists: 0.05,
        kd: 0.25,
      };

    case "support":
      return {
        kills: 0.15,
        damage: 0.30,
        assists: 0.30,
        kd: 0.25,
      };

    case "flex":
      return {
        kills: 0.30,
        damage: 0.25,
        assists: 0.15,
        kd: 0.30,
      };

    default:
      return {
        kills: 0.30,
        damage: 0.25,
        assists: 0.15,
        kd: 0.30,
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

function mean(
  values: number[],
): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

/**
 * Converts a player metric into a 0-100 score relative to the roster average.
 *
 * Roster average -> 50
 * 2x average     -> 100
 * 0x average     -> 0
 *
 * There is no min-max normalization and no sample-based score distortion.
 */
function relativeScore(
  value: number,
  rosterAverage: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (
    !Number.isFinite(
      rosterAverage,
    ) ||
    rosterAverage <= 0
  ) {
    return 50;
  }

  return clamp(
    (value / rosterAverage) * 50,
  );
}

/* -------------------------------------------------------------------------- */
/* TASK DATA                                                                  */
/* -------------------------------------------------------------------------- */

export async function listMeritTaskStats(): Promise<
  MeritTaskStatsRow[]
> {
  try {
    const { supabase } =
      await import(
        "@/integrations/supabase/client"
      );

    const {
      data,
      error,
    } = await supabase.rpc(
      "merit_task_stats",
    );

    /**
     * The task system is allowed to be unavailable while
     * OCR/task infrastructure is still being completed.
     */
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
/* PLAYER AGGREGATION                                                         */
/* -------------------------------------------------------------------------- */

type PlayerAggregate = {
  matches: number;
  kills: number;
  damage: number;
  assists: number;

  /**
   * Individual match output used only for consistency.
   * Placement is never included.
   */
  matchOutput: number[];
};

function aggregatePlayers(
  players: Player[],
  entries: StatEntry[],
): Map<
  string,
  PlayerAggregate
> {
  const map =
    new Map<
      string,
      PlayerAggregate
    >();

  for (const player of players) {
    map.set(
      player.id,
      {
        matches: 0,
        kills: 0,
        damage: 0,
        assists: 0,
        matchOutput: [],
      },
    );
  }

  for (const entry of entries) {
    const aggregate =
      map.get(
        entry.player_id,
      );

    if (!aggregate) {
      continue;
    }

    /**
     * Count only matches where the player actually
     * logged an individual stat.
     */
    if (!didPlay(entry)) {
      continue;
    }

    aggregate.matches += 1;
    aggregate.kills +=
      entry.kills;
    aggregate.damage +=
      entry.damage;
    aggregate.assists +=
      entry.assists;

    /**
     * Individual output only.
     *
     * Damage is divided by 1000 simply to keep
     * the consistency metric numerically balanced.
     */
    aggregate.matchOutput.push(
      entry.kills +
        entry.assists +
        entry.damage /
          1000,
    );
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/* MAIN MERIT CALCULATION                                                     */
/* -------------------------------------------------------------------------- */

export function computeMeritIndex(
  source: MeritSource,
): MeritRow[] {
  const players =
    source.players
      .filter(
        (player) =>
          player.status ===
          "active",
      )
      .slice()
      .sort((a, b) =>
        a.id.localeCompare(
          b.id,
        ),
      );

  const aggregates =
    aggregatePlayers(
      players,
      source.entries,
    );

  const taskMap =
    new Map<
      string,
      MeritTaskStatsRow
    >(
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
        (
          aggregates.get(
            player.id,
          )?.matches ?? 0
        ) > 0,
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
  ): number => {
    const aggregate =
      aggregates.get(
        player.id,
      );

    if (
      !aggregate ||
      aggregate.matches <= 0
    ) {
      return 0;
    }

    return (
      aggregate[stat] /
      aggregate.matches
    );
  };

  /**
   * Current database does not contain deaths.
   *
   * Current available K/D-style value:
   *     kills / played matches
   *
   * This is kept only until actual deaths data is added.
   */
  const avgKd = (
    player: Player,
  ): number => {
    return averageStat(
      player,
      "kills",
    );
  };

  /* ---------------------------------------------------------------------- */
  /* ROSTER AVERAGES                                                        */
  /* ---------------------------------------------------------------------- */

  const rosterAverageKills =
    mean(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "kills",
          ),
      ),
    );

  const rosterAverageDamage =
    mean(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "damage",
          ),
      ),
    );

  const rosterAverageAssists =
    mean(
      playersWithMatches.map(
        (player) =>
          averageStat(
            player,
            "assists",
          ),
      ),
    );

  const rosterAverageKd =
    mean(
      playersWithMatches.map(
        avgKd,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* INDIVIDUAL PERFORMANCE                                                 */
  /* ---------------------------------------------------------------------- */

  const performanceMap =
    new Map<
      string,
      number
    >();

  for (const player of players) {
    const aggregate =
      aggregates.get(
        player.id,
      );

    if (
      !aggregate ||
      aggregate.matches <= 0
    ) {
      performanceMap.set(
        player.id,
        0,
      );

      continue;
    }

    const weights =
      roleWeights(
        player.role,
      );

    /**
     * Every metric is based on the PLAYER'S AVERAGE.
     *
     * Placement is completely absent.
     */
    const killsScore =
      relativeScore(
        averageStat(
          player,
          "kills",
        ),
        rosterAverageKills,
      );

    const damageScore =
      relativeScore(
        averageStat(
          player,
          "damage",
        ),
        rosterAverageDamage,
      );

    const assistsScore =
      relativeScore(
        averageStat(
          player,
          "assists",
        ),
        rosterAverageAssists,
      );

    const kdScore =
      relativeScore(
        avgKd(player),
        rosterAverageKd,
      );

    const performance =
      killsScore *
        weights.kills +
      damageScore *
        weights.damage +
      assistsScore *
        weights.assists +
      kdScore *
        weights.kd;

    performanceMap.set(
      player.id,
      clamp(performance),
    );
  }

  /* ---------------------------------------------------------------------- */
  /* BUILD ROWS                                                             */
  /* ---------------------------------------------------------------------- */

  const rows: MeritRow[] =
    players.map((player) => {
      const aggregate =
        aggregates.get(
          player.id,
        )!;

      const task =
        taskMap.get(
          player.id,
        );

      /* ---------------------------- TASKS ----------------------------- */

      const assigned =
        Math.max(
          0,
          task?.assigned ?? 0,
        );

      const completed =
        Math.min(
          Math.max(
            0,
            task?.completed ?? 0,
          ),
          assigned,
        );

      const attemptedNotPassed =
        Math.max(
          0,
          task?.attempted_not_passed ??
            0,
        );

      const missed =
        Math.max(
          0,
          assigned -
            completed,
        );

      const passSubmissions =
        Math.max(
          0,
          task?.pass_submissions ??
            0,
        );

      const totalSubmissions =
        Math.max(
          0,
          task?.total_submissions ??
            0,
        );

      const extraPasses =
        Math.max(
          0,
          passSubmissions -
            completed,
        );

      /**
       * CRITICAL TASK RULE
       *
       * Every task that is not completed gives ZERO.
       *
       * No partial credit.
       * No failed-task credit.
       *
       * Example:
       *   10 assigned
       *   7 completed
       *
       *   Task score = 70/100
       */
      const taskScore =
        assigned > 0
          ? clamp(
              (
                completed /
                assigned
              ) * 100,
            )
          : 0;

      /* ----------------------- PERFORMANCE ---------------------------- */

      /**
       * No sample shrinkage.
       *
       * More matches don't automatically increase
       * or decrease the player's performance score.
       */
      const performance =
        aggregate.matches > 0
          ? performanceMap.get(
              player.id,
            ) ?? 0
          : 0;

      /* ------------------------- CONSISTENCY --------------------------- */

      /**
       * Task reliability.
       *
       * No task attempts yet -> 0 because no task
       * has been completed.
       */
      const taskReliability =
        totalSubmissions > 0
          ? passSubmissions /
            totalSubmissions
          : 0;

      /**
       * Individual match consistency.
       *
       * No placement.
       */
      let matchConsistency =
        aggregate.matches >= 2
          ? 0
          : 100;

      if (
        aggregate.matches >= 2
      ) {
        const average =
          mean(
            aggregate.matchOutput,
          );

        const variance =
          mean(
            aggregate.matchOutput.map(
              (value) =>
                (
                  value -
                  average
                ) ** 2,
            ),
          );

        const standardDeviation =
          Math.sqrt(
            variance,
          );

        const coefficient =
          average > 0
            ? standardDeviation /
              average
            : 1;

        matchConsistency =
          clamp(
            (
              1 -
              Math.min(
                1,
                coefficient,
              )
            ) * 100,
          );
      }

      /**
       * If task system is not active yet,
       * consistency is based only on individual matches.
       *
       * Once task submissions exist:
       *   60% task reliability
       *   40% match consistency
       */
      const consistency =
        totalSubmissions > 0
          ? clamp(
              taskReliability *
                  60 +
                matchConsistency *
                  40,
            )
          : matchConsistency;

      /* -------------------------- PENALTY ------------------------------ */

      /**
       * Existing missed-task penalty.
       *
       * This is separate from taskScore.
       * Therefore an incomplete task:
       *   - receives 0 task points
       *   - can also receive the existing missed-task penalty
       */
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
       * FINAL FORMULA
       *
       * 45% Tasks
       * 40% Individual Performance
       * 15% Consistency
       *
       * Placement = 0%
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

      /**
       * Sample weight is informational only.
       */
      const sampleWeight =
        aggregate.matches > 0
          ? aggregate.matches /
            (
              aggregate.matches +
              SAMPLE_K
            )
          : 0;

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
          aggregate.matches,

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
            avgKd(player) * 100,
          ) / 100,

        /**
         * NEVER used in calculation.
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
      b.merit -
        a.merit ||

      b.performance_score -
        a.performance_score ||

      b.avg_kd -
        a.avg_kd ||

      b.avg_kills -
        a.avg_kills ||

      b.avg_damage -
        a.avg_damage ||

      b.avg_assists -
        a.avg_assists ||

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
/* MERIT TIERS                                                                */
/* -------------------------------------------------------------------------- */

export function meritTier(
  merit: number,
): {
  label: string;
  className: 
