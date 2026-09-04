import { didPlay, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * MERIT INDEX
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
 *   - Placement is TEAM performance -> NOT USED.
 *   - Match count does NOT directly add Merit.
 *   - Task completed -> points.
 *   - Task incomplete -> 0 points.
 *   - Task failed -> 0 points.
 *   - NO partial credit.
 *
 * NOTE:
 * Current database does not contain deaths in match_stats.
 * Therefore avg_kd currently uses kills per played match.
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
   * Kept only for compatibility with existing UI/data types.
   * Placement is never used in Merit.
   */
  avg_placement_points: number;

  /**
   * Informational only.
   * Never adds Merit points.
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
 * Only informational sample value.
 * Match count does not directly award Merit.
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

function roleWeights(
  role: string,
): RoleWeights {
  switch (
    role
      .trim()
      .toLowerCase()
  ) {
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
 * Score an individual average against the roster average.
 *
 * Roster average = 50
 * 2x roster average = 100
 * 0x roster average = 0
 *
 * This avoids min/max normalization and avoids match-count
 * shrinkage changing the actual performance order.
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
    (value /
      rosterAverage) *
      50,
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
   * Individual output per match.
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
     * Individual consistency only.
     *
     * Placement is intentionally absent.
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

  const playedPlayers =
    players.filter(
      (player) =>
        (
          aggregates.get(
            player.id,
          )?.matches ?? 0
        ) > 0,
    );

  /* ---------------------------------------------------------------------- */
  /* AVERAGE HELPERS                                                        */
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
   * Current DB has no deaths.
   *
   * Current available K/D-style metric:
   * kills per played match.
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
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "kills",
          ),
      ),
    );

  const rosterAverageDamage =
    mean(
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "damage",
          ),
      ),
    );

  const rosterAverageAssists =
    mean(
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "assists",
          ),
      ),
    );

  const rosterAverageKd =
    mean(
      playedPlayers.map(
        avgKd,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* PERFORMANCE SCORE                                                      */
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
     * Every metric uses the player's average.
     *
     * NO placement.
     * NO total volume.
     * NO match-count bonus.
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
  /* FINAL ROWS                                                             */
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

      /**
       * Every uncompleted task remains uncompleted,
       * regardless of whether it was attempted.
       */
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
       * TASK RULE:
       *
       * Only completed tasks receive points.
       * Every incomplete/failed task = 0.
       * NO partial credit.
       *
       * Example:
       *   5 assigned / 3 completed = 60 task score
       *   5 assigned / 0 completed = 0 task score
       */
      const taskScore =
        assigned > 0
          ? clamp(
              (
                completed /
                assigned
              ) *
                100,
            )
          : 0;

      /* ------------------------ PERFORMANCE ---------------------------- */

      const performance =
        aggregate.matches > 0
          ? performanceMap.get(
              player.id,
            ) ?? 0
          : 0;

      /* ------------------------- CONSISTENCY ---------------------------- */

      /**
       * Task reliability:
       *
       * No completed task attempts = 0.
       * Once real task data exists, pass rate matters.
       */
      const taskReliability =
        totalSubmissions > 0
          ? clamp(
              passSubmissions /
                totalSubmissions,
              0,
              1,
            )
          : 0;

      /**
       * Individual match consistency.
       *
       * No placement.
       */
      let matchConsistency =
        0;

      if (
        aggregate.matches === 1
      ) {
        /**
         * With only one match there is no spread to measure.
         * Use a neutral consistency score.
         */
        matchConsistency = 50;
      } else if (
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
            ) *
              100,
          );
      }

      /**
       * Before tasks are active:
       *   consistency = individual match consistency
       *
       * Once task submissions exist:
       *   60% task reliability
       *   40% individual match consistency
       */
      const consistency =
        totalSubmissions > 0
          ? clamp(
              taskReliability *
                60 +
                matchConsistency *
                  0.4,
            )
          : matchConsistency;

      /**
       * Correct the units of the 60/40 formula.
       *
       * taskReliability is 0-1,
       * matchConsistency is 0-100.
       */
      const finalConsistency =
        totalSubmissions > 0
          ? clamp(
              taskReliability *
                60 +
                matchConsistency *
                0.40,
            )
          : matchConsistency;

      /* --------------------------- PENALTY ------------------------------ */

      /**
       * Additional penalty for incomplete tasks.
       *
       * Important:
       * incomplete/failed task already has 0 task points,
       * and the existing missed-task penalty remains separate.
       */
      const penalty =
        assigned > 0
          ? (
              missed /
              assigned
            ) *
            MAX_MISS_PENALTY
          : 0;

      /* ----------------------------- MERIT ------------------------------ */

      /**
       * FINAL WEIGHTAGE:
       *
       * 45% Tasks
       * 40% Individual Performance
       * 15% Consistency
       */
      const merit =
        clamp(
          taskScore *
            W_TASK +
          performance *
            W_PERFORMANCE +
          finalConsistency *
            W_CONSISTENCY -
          penalty,
        );

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
            finalConsistency *
              10,
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
         * Explicitly zero.
         * Placement is team performance.
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
/* ------------------------
