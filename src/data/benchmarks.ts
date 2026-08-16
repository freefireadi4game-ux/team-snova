import type {
  Benchmark,
  BenchmarkRequirement,
} from "@/lib/benchmark";

const requirement = (
  label: string,
  metric: BenchmarkRequirement["metric"],
  operator: BenchmarkRequirement["operator"],
  target_value: number,
  source_type?: BenchmarkRequirement["source_type"],
): BenchmarkRequirement => ({
  label,
  metric,
  operator,
  target_value,
  source_type,
  required: true,
});

export const BENCHMARKS: Benchmark[] = [
  {
    id: "rusher-training",
    name: "Rusher Training Drill",
    description: "Aggressive close-range training benchmark.",
    source_type: "training",
    role: "Rusher",
    status: "active",
    requirements: [
      requirement("Eliminations", "kills", ">=", 200, "training"),
      requirement("Headshot Rate", "headshot_rate", ">=", 50, "training"),
      requirement(
        "Highest Elimination Streak",
        "elimination_streak",
        ">=",
        10,
        "training",
      ),
    ],
  },

  {
    id: "sniper-training",
    name: "Sniper Training Drill",
    description: "Precision and headshot benchmark for snipers.",
    source_type: "training",
    role: "Sniper",
    status: "active",
    requirements: [
      requirement("Headshots", "headshots", ">=", 100, "training"),
      requirement("Headshot Rate", "headshot_rate", ">=", 40, "training"),
      requirement("Eliminations", "kills", ">=", 100, "training"),
    ],
  },

  {
    id: "igl-solo-squad",
    name: "IGL Solo vs Squad",
    description: "Solo vs squad decision-making benchmark.",
    source_type: "solo_vs_squad",
    role: "IGL",
    status: "active",
    requirements: [
      requirement("Booyah", "booyah", ">=", 1, "solo_vs_squad"),
      requirement("Kills", "kills", ">=", 20, "solo_vs_squad"),
    ],
  },
];
