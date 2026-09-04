import { didPlay, listPlayers, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * Merit Index
 *
 * FIXED WEIGHTAGE:
 *   45% Tasks
 *   40% Individual Performance
 *   15% Consistency
 *
 * Individual Performance uses:
 *   - Avg Kills
 *   - Avg Damage
 *   - Avg Assists
 *   - Avg K/D-style value
 *
 * Placement is TEAM performance and is NOT used in individual Merit.
 * Matches played do not directly award Merit.
 *
 * Current database has no separate deaths column, so avg_kd currently
 * represents kills per played match. When deaths are stored later,
 * only avgKd() needs to change to true kills / deaths.
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
   * Placement is NOT used anywhere in Merit.
   */
  avg_placement_points: number;

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
 * Sample smoothing only.
 * More matches do NOT directly increase Merit.
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
    players: players as Player[],
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
   * Individual match score used only for consistency.
   * NO placement.
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

    if (!didPlay(entry)) {
      continue;
    }

    agg.matches += 1;
    agg.kills += entry.kills;
    agg.damage += entry.damage;
    agg.assists += entry.assists;

    /**
     * Consistency uses only individual output.
     *
     * Damage is scaled down only because its raw range is much
     * larger than kills/assists.
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

  const aggs =
    aggregatePlayers(
      source.entries,
      players,
    );

  const taskMap =
    new Map<string, MeritTaskStatsRow>(
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
  ): number => {
    const agg =
      aggs.get(player.id)!;

    return agg.matches
      ? agg[stat] /
        agg.matches
      : 0;
  };

  /**
   * Current database does not contain deaths.
   *
   * Current available K/D-style metric:
   *     kills / matches played
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
  /* NORMALIZATION                                                          */
  /* ---------------------------------------------------------------------- */

  const normKills =
    normalizer(
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "kills",
          ),
      ),
    );

  const normDamage =
    normalizer(
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "damage",
          ),
      ),
    );

  const normAssists =
    normalizer(
      playedPlayers.map(
        (player) =>
          averageStat(
            player,
            "assists",
          ),
      ),
    );

  const normKd =
    normalizer(
      playedPlayers.map(
        avgKd,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* RAW PERFORMANCE                                                        */
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
      normKills(
        averageStat(
          player,
          "kills",
        ),
      ) *
        weights.kills +

      normDamage(
        averageStat(
          player,
          "damage",
        ),
      ) *
        weights.damage +

      normAssists(
        averageStat(
          player,
          "assists",
        ),
      ) *
        weights.assists +

      normKd(
        avgKd(player),
      ) *
        weights.kd;

    rawPerformance.set(
      player.id,
      clamp(score),
    );
  }

  const performanceMean =
    mean(
      playedPlayers.map(
        (player) =>
          rawPerformance.get(
            player.id,
          ) ?? 0,
      ),
    );

  /* ---------------------------------------------------------------------- */
  /* FINAL ROWS                                                             */
  /* ---------------------------------------------------------------------- */

  const rows =
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
       * No task data = neutral task component.
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

      /* ------------------------ PERFORMANCE ---------------------------- */

      /**
       * Sample weight does not award points.
       * It only reduces volatility from very small samples.
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

      /* ------------------------- CONSISTENCY ---------------------------- */

      /**
       * Task reliability becomes neutral
       * until real task/OCR data exists.
       */
      const taskReliability =
        totalSubmissions > 0
          ? passSubmissions /
            totalSubmissions
          : 0.5;

      /**
       * Individual consistency only.
       * Placement is never used.
       */
      let matchConsistency = 0.5;

      if (
        agg.matchPerformance
          .length >= 2
      ) {
        const average =
          mean(
            agg.matchPerformance,
          );

        const variance =
          mean(
            agg.matchPerformance.map(
              (value) =>
                (value - average) **
                2,
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
          ) *
            100,
        );

      /* --------------------------- PENALTY ------------------------------ */

      const penalty =
        assigned > 0
          ? (
              missed /
              assigned
            ) *
            MAX_MISS_PENALTY
          : 0;

      /* ----------------------------- MERIT ------------------------------ */

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
            avgKd(player) * 100,
          ) / 100,

        /**
         * Placement is intentionally zero.
         * It does not participate in the formula.
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
