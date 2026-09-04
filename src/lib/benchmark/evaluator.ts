import type {
  BenchmarkEvaluation,
  BenchmarkRequirement,
  ExtractedBenchmarkStats,
} from "./types";

function compare(
  actual: number,
  operator: BenchmarkRequirement["operator"],
  target: number,
): boolean {
  switch (operator) {
    case ">=":
      return actual >= target;
    case "<=":
      return actual <= target;
    case "=":
      return actual === target;
    case ">":
      return actual > target;
    case "<":
      return actual < target;
    default:
      return false;
  }
}

function getMetricValue(
  stats: ExtractedBenchmarkStats,
  metric: BenchmarkRequirement["metric"],
): number | null {
  switch (metric) {
    case "kills":
      return stats.kills;

    case "headshots":
      return stats.headshots;

    case "headshot_rate":
      return stats.headshot_rate;

    case "damage":
      return stats.damage;

    case "booyah":
      return stats.booyah;

    case "wins":
      return stats.wins;

    case "placement":
      return stats.placement;

    case "matches":
      return stats.matches;

    case "assists":
      return stats.assists;

    case "elimination_streak":
      return stats.elimination_streak;

    case "kd_ratio":
      return stats.kd_ratio;

    case "custom":
    default:
      return null;
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function evaluateRequirement(
  requirement: BenchmarkRequirement,
  stats: ExtractedBenchmarkStats,
) {
  const actual = getMetricValue(stats, requirement.metric);

  if (actual === null || Number.isNaN(actual)) {
    return {
      requirement,
      actual_value: null,
      passed: false,
      evaluable: false,
      message: `${requirement.label}: value could not be extracted from the screenshot.`,
    };
  }

  const passed = compare(
    actual,
    requirement.operator,
    requirement.target_value,
  );

  return {
    requirement,
    actual_value: actual,
    passed,
    evaluable: true,
    message: passed
      ? `${requirement.label}: ${formatNumber(actual)} ${requirement.operator} ${formatNumber(
          requirement.target_value,
        )} ✓`
      : `${requirement.label}: ${formatNumber(actual)} does not satisfy ${requirement.operator} ${formatNumber(
          requirement.target_value,
        )}`,
  };
}

export function evaluateBenchmark(
  requirements: BenchmarkRequirement[],
  stats: ExtractedBenchmarkStats,
): BenchmarkEvaluation {
  const checks = requirements.map((requirement) =>
    evaluateRequirement(requirement, stats),
  );

  const requiredChecks = checks.filter(
    (check) => check.requirement.required !== false,
  );

  const passedCount = requiredChecks.filter(
    (check) => check.evaluable && check.passed,
  ).length;

  const hasMissingValues = requiredChecks.some(
    (check) => !check.evaluable,
  );

  const hasFailedRequirements = requiredChecks.some(
    (check) => check.evaluable && !check.passed,
  );

  let status: BenchmarkEvaluation["status"];

  if (hasMissingValues) {
    status = "needs_review";
  } else if (hasFailedRequirements) {
    status = "fail";
  } else {
    status = "pass";
  }

  return {
    status,
    checks,
    passed_count: passedCount,
    total_required: requiredChecks.length,
    extracted: stats,
  };
  }
