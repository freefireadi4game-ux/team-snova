import { didPlay, listPlayers, positionPoints, type Player } from "@/lib/data";
import { listStatEntries, type StatEntry } from "@/lib/stats-core";

/**
 * MERIT INDEX
 *
 * Existing weightage is preserved:
 *   45% Tasks
 *   40% Competitive Performance
 *   15% Consistency
 *
 * Tasks are optional for now. Until OCR/submission data is available,
 * task_score stays neutral at 50. Once task data starts arriving,
 * the existing 45% task weight automatically starts using it.
 *
 * Performance uses only existing match data:
 *   kills, damage, assists, placement points
 *
 * Match volume itself never gives Merit points.
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

  /** Competitive sample reliability, 0-1 */
  sample_weight: number;
};

/* ------------------------------- weights --------------------------------- */

/**
 * KEEP THESE EXACT WEIGHTS.
 * Future OCR/task data will automatically plug into the 45% Task component.
 */
const W_TASK = 0.45;
const W_PERF = 0.4;
const W_CONSISTENCY = 0.15;

const MAX_MISS_PENALTY = 12;
const MAX_EXTRA_BONUS = 8;
const PARTIAL_CREDIT = 0.4;

/**
 * Small-sample shrinkage.
 * Around 8 matches reaches roughly half/full confidence.
 */
const SAMPLE_K = 8;

/* ---------------------------- role weightage ----------------------------- */

type RoleWeights = {
  kills: number;
  damage: number;
  assists: number;
  placement: number;
};

function roleWeights(role: string): RoleWeights {
  switch (role.trim().toLowerCase()) {
    case "igl":
      return {
        kills: 0.15,
        damage: 0.15,
        assists: 0.2,
        placement: 0.5,
      };

    case "rusher":
    case "fragger":
      return {
        kills: 0.45,
        damage: 0.3,
        assists: 0.1,
        placement: 0.15,
      };

    case "sniper":
      return {
        kills: 0.35,
        damage: 0.35,
        assists: 0.1,
        placement: 0.2,
      };

    case "support":
      return {
        kills: 0.15,
        damage: 0.25,
        assists: 0.35,
        placement: 0.25,
      };

    case "flex":
      return {
        kills: 0.3,
        damage: 0.25,
        assists: 0.2,
        placement: 0.25,
      };

    default:
      return {
        kills: 0.28,
        damage: 0.25,
        assists: 0.22,
        placement: 0.25,
      };
  }
}

/* -------------------------------- helpers -------------------------------- */

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (!values.length) return 0;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

/**
 * Min-max normalization across active roster.
 *
 * Lowest -> 0
 * Highest -> 100
 * Same values -> 50
 */
function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (value: number) => {
    if (!Number.isFinite(value)) return 0;

    if (max - min < 1e-9) {
      return values.length ? 50 : 0;
    }

    return ((value - min) / (max - min)) * 100;
  };
}

/* --------------------------------- tasks --------------------------------- */

/**
 * Task RPC is optional.
 *
 * IMPORTANT:
 * Merit Index must still work even before task/OCR infrastructure exists.
 *
 * Later, when the RPC exists and starts returning rows, those rows are
 * automatically included without changing the 45/40/15 weightage.
 */
export async function listMeritTaskStats(): Promise<MeritTaskStatsRow[]> {
  try {
    const { supabase } = await import(
      "@/integrations/supabase/client"
    );

    const { data, error } = await supabase.rpc(
      "merit_task_stats",
    );

    if (error) {
      console.warn(
        "[Merit] Task stats unavailable:",
        error.message,
      );
      return [];
    }

    return (data ?? []) as MeritTaskStatsRow[];
  } catch (error) {
    console.warn(
      "[Merit] Task stats unavailable:",
      error,
    );

    return [];
  }
}

/* -------------------------------- source --------------------------------- */

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

  return {
    players: players as Player[],
    taskStats,
    entries,
  };
}

/* ------------------------------- aggregation ------------------------------ */

type Agg = {
  matches: number;
  kills: number;
  damage: number;
  assists: number;
  placementPoints: number;

  /**
   * Used only for consistency.
   * Each match contributes:
   *   kills + placement points
   */
  perMatch: number[];
};

/* ------------------------------ main formula ------------------------------ */

export function computeMeritIndex(
  source: MeritSource,
): MeritRow[] {
  const players = source.players
    .filter((p) => p.status === "active")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const aggs = new Map<string, Agg>();

  for (const player of players) {
    aggs.set(player.id, {
      matches: 0,
      kills: 0,
      damage: 0,
      assists: 0,
      placementPoints: 0,
      perMatch: [],
    });
  }

  /**
   * Build player match performance.
   */
  for (const entry of source.entries) {
    const agg = aggs.get(entry.player_id);

    if (!agg) continue;

    /**
     * Same played-match rule already used by the project.
     */
    if (!didPlay(entry)) continue;

    agg.matches += 1;
    agg.kills += entry.kills;
    agg.damage += entry.damage;
    agg.assists += entry.assists;

    const placement = positionPoints(entry.position);

    agg.placementPoints += placement;

    /**
     * Match performance used for consistency.
     */
    agg.perMatch.push(
      entry.kills + placement,
    );
  }

  const tasksByPlayer = new Map<string, MeritTaskStatsRow>(
    source.taskStats.map((row) => [
      row.player_id,
      row,
    ]),
  );

  /**
   * Only players with actual match data participate in
   * roster-relative competitive normalization.
   */
  const playedPlayers = players.filter(
    (player) =>
      (aggs.get(player.id)?.matches ?? 0) > 0,
  );

  /* ----------------------------- averages -------------------------------- */

  const avgMetric = (
    player: Player,
    key: "kills" | "damage" | "assists",
  ) => {
    const agg = aggs.get(player.id)!;

    return agg.matches
      ? agg[key] / agg.matches
      : 0;
  };

  const avgPlacement = (player: Player) => {
    const agg = aggs.get(player.id)!;

    return agg.matches
      ? agg.placementPoints / agg.matches
      : 0;
  };

  /* ------------------------ roster normalization ------------------------- */

  const normKills = normalizer(
    playedPlayers.map((p) =>
      avgMetric(p, "kills"),
    ),
  );

  const normDamage = normalizer(
    playedPlayers.map((p) =>
      avgMetric(p, "damage"),
    ),
  );

  const normAssists = normalizer(
    playedPlayers.map((p) =>
      avgMetric(p, "assists"),
    ),
  );

  const normPlacement = normalizer(
    playedPlayers.map(avgPlacement),
  );

  /* ------------------------ performance score ---------------------------- */

  const rawPerformance = new Map<string, number>();

  for (const player of players) {
    const agg = aggs.get(player.id)!;

    if (!agg.matches) {
      rawPerformance.set(player.id, 0);
      continue;
    }

    const weights = roleWeights(player.role);

    const score =
      normKills(
        avgMetric(player, "kills"),
      ) * weights.kills +
      normDamage(
        avgMetric(player, "damage"),
      ) * weights.damage +
      normAssists(
        avgMetric(player, "assists"),
      ) * weights.assists +
      normPlacement(
        avgPlacement(player),
      ) * weights.placement;

    rawPerformance.set(
      player.id,
      clamp(score),
    );
  }

  /**
   * Roster competitive mean.
   * Used as shrinkage target for smaller samples.
   */
  const performanceMean =
    mean(
      playedPlayers.map(
        (player) =>
          rawPerformance.get(player.id) ?? 0,
      ),
    ) || 0;

  /* ------------------------------- rows --------------------------------- */

  const rows: MeritRow[] = players.map(
    (player) => {
      const agg = aggs.get(player.id)!;

      const task =
        tasksByPlayer.get(player.id);

      const assigned = task?.assigned ?? 0;

      const completed = Math.min(
        task?.completed ?? 0,
        assigned,
      );

      const attemptedNotPassed =
        task?.attempted_not_passed ?? 0;

      const missed = Math.max(
        0,
        assigned -
          completed -
          attemptedNotPassed,
      );

      const passSubmissions =
        task?.pass_submissions ?? 0;

      const totalSubmissions =
        task?.total_submissions ?? 0;

      const extraPasses = Math.max(
        0,
        passSubmissions -
          completed,
      );

      /* ------------------------------ TASKS ----------------------------- */

      /**
       * IMPORTANT:
       *
       * No task data yet:
       *   task_score = 50
       *
       * This means the 45% weight remains present,
       * but we don't falsely reward/punish anyone before
       * the OCR/task pipeline is producing data.
       */
      let taskScore = 50;

      if (assigned > 0) {
        const coverage =
          (
            completed +
            attemptedNotPassed *
              PARTIAL_CREDIT
          ) / assigned;

        const extraBonus =
          Math.min(
            1,
            extraPasses / assigned,
          ) * MAX_EXTRA_BONUS;

        taskScore = clamp(
          coverage * 100 +
            extraBonus,
        );
      }

      /* ---------------------- COMPETITIVE PERFORMANCE ------------------ */

      const sampleWeight = agg.matches
        ? agg.matches /
          (agg.matches + SAMPLE_K)
        : 0;

      const performance = agg.matches
        ? clamp(
            (
              rawPerformance.get(
                player.id,
              ) ?? 0
            ) *
              sampleWeight +
              performanceMean *
                (1 - sampleWeight),
          )
        : 0;

      /* --------------------------- CONSISTENCY -------------------------- */

      /**
       * Task reliability:
       *
       * With task submissions -> actual
       * Without submissions -> neutral 50%
       */
      const taskReliability =
        totalSubmissions > 0
          ? passSubmissions /
            totalSubmissions
          : 0.5;

      /**
       * Match consistency:
       *
       * Lower variation between match
       * performance values = better consistency.
       */
      let matchSteadiness = 0.5;

      if (agg.perMatch.length >= 2) {
        const average =
          mean(agg.perMatch);

        const variance =
          mean(
            agg.perMatch.map(
              (value) =>
                (value - average) *
                (value - average),
            ),
          ) || 0;

        const standardDeviation =
          Math.sqrt(variance);

        const coefficientOfVariation =
          average > 0
            ? standardDeviation /
              average
            : 1;

        matchSteadiness = clamp(
          1 -
            Math.min(
              1,
              coefficientOfVariation,
            ),
          0,
          1,
        );
      }

      /**
       * Existing 60/40 consistency split:
       *   60% task reliability
       *   40% match steadiness
       */
      const consistency = clamp(
        (
          taskReliability *
            0.6 +
          matchSteadiness *
            0.4
        ) * 100,
      );

      /* ---------------------------- PENALTY ----------------------------- */

      const penalty =
        assigned > 0
          ? (
              missed /
              assigned
            ) * MAX_MISS_PENALTY
          : 0;

      /* ------------------------------ MERIT ----------------------------- */

      /**
       * FINAL EXISTING WEIGHTAGE:
       *
       *   45% Tasks
       *   40% Performance
       *   15% Consistency
       */
      const merit = clamp(
        taskScore * W_TASK +
          performance * W_PERF +
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
        extra_passes: extraPasses,

        matches_played:
          agg.matches,

        avg_kills:
          Math.round(
            (
              agg.matches
                ? agg.kills /
                  agg.matches
                : 0
            ) * 100,
          ) / 100,

        avg_damage:
          Math.round(
            agg.matches
              ? agg.damage /
                  agg.matches
              : 0,
          ),

        avg_assists:
          Math.round(
            (
              agg.matches
                ? agg.assists /
                  agg.matches
                : 0
            ) * 100,
          ) / 100,

        avg_placement_points:
          Math.round(
            (
              agg.matches
                ? agg.placementPoints /
                  agg.matches
                : 0
            ) * 100,
          ) / 100,

        sample_weight:
          Math.round(
            sampleWeight * 100,
          ) / 100,
      };
    },
  );

  /* ----------------------------- ranking -------------------------------- */

  rows.sort(
    (a, b) =>
      b.merit - a.merit ||
      b.performance_score -
        a.performance_score ||
      a.player.ign.localeCompare(
        b.player.ign,
      ),
  );

  rows.forEach(
    (row, index) => {
      row.rank = index + 1;
    },
  );

  return rows;
}

/* -------------------------------- tiers --------------------------------- */

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
