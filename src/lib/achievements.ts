import type { PlayerAgg } from "@/lib/stats-core";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  group: AchievementGroup;
  rarity: Rarity;
  /** Value required to unlock */
  target: number;
  /** Reads the player's current value for this metric */
  metric: MetricKey;
};

export type AchievementGroup =
  | "Frags"
  | "Damage"
  | "Support"
  | "Experience"
  | "Circuit"
  | "Honours"
  | "Highlights"
  | "Consistency"
  | "Placements";

export type MetricKey =
  | "kills"
  | "damage"
  | "assists"
  | "matches"
  | "tournaments"
  | "mvps"
  | "bestKills"
  | "bestDamage"
  | "avgKills"
  | "avgDamage"
  | "wins"
  | "top3";

export type PlayerMetrics = PlayerAgg & {
  mvps: number;
  avgKills: number;
  avgDamage: number;
};

export function toMetrics(agg: PlayerAgg | undefined, mvps: number): PlayerMetrics {
  const base: PlayerAgg =
    agg ??
    ({
      player_id: "",
      kills: 0,
      damage: 0,
      assists: 0,
      matches: 0,
      bestKills: 0,
      bestDamage: 0,
      tournaments: 0,
      wins: 0,
      top3: 0,
    } as PlayerAgg);
  return {
    ...base,
    mvps,
    avgKills: base.matches ? base.kills / base.matches : 0,
    avgDamage: base.matches ? base.damage / base.matches : 0,
  };
}

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

function rarityFor(index: number, total: number): Rarity {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const slot = Math.min(RARITY_ORDER.length - 1, Math.floor(ratio * RARITY_ORDER.length));
  return RARITY_ORDER[slot];
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1000}k`;
  return String(n);
}

type Tier = {
  group: AchievementGroup;
  metric: MetricKey;
  targets: number[];
  names: string[];
  unit: string;
  decimals?: number;
};

const TIERS: Tier[] = [
  {
    group: "Frags",
    metric: "kills",
    unit: "career kills",
    targets: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000],
    names: [
      "First Blood", "Trigger Finger", "Half Century", "Sharp Shooter", "Century Club",
      "Frag Hunter", "Double Century", "Kill Collector", "Triple Threat", "Frag Machine",
      "Half-K Slayer", "Bullet Storm", "Executioner", "Thousand Cuts", "Warpath",
      "Nightmare Fuel", "Death Incarnate",
    ],
  },
  {
    group: "Damage",
    metric: "damage",
    unit: "career damage",
    targets: [10000, 25000, 50000, 100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000],
    names: [
      "Chip Damage", "Pressure Player", "Wall Breaker", "Damage Dealer", "Heavy Hitter",
      "Siege Engine", "Demolition Crew", "Havoc Bringer", "Devastator", "Cataclysm",
      "Million Club", "Apocalypse", "Total Annihilation",
    ],
  },
  {
    group: "Support",
    metric: "assists",
    unit: "career assists",
    targets: [5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500],
    names: [
      "Helping Hand", "Wingman", "Team Player", "Playmaker", "Enabler",
      "Assist Century", "Setup Artist", "Backbone", "Kingmaker", "Silent Engine",
      "Squad Pillar",
    ],
  },
  {
    group: "Experience",
    metric: "matches",
    unit: "matches played",
    targets: [1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500],
    names: [
      "Debut", "Getting Warm", "Regular", "Grinder", "Half Century Grinder",
      "Battle Tested", "Centurion", "Veteran", "Hardened", "Iron Will",
      "Living Legend", "Immortal Grinder",
    ],
  },
  {
    group: "Circuit",
    metric: "tournaments",
    unit: "tournaments played",
    targets: [1, 2, 3, 5, 8, 10, 15, 20, 30, 50],
    names: [
      "Rookie Circuit", "Back For More", "Hat-Trick Entry", "Circuit Regular", "Road Warrior",
      "Tenured", "Circuit Veteran", "Scene Fixture", "Era Defining", "Hall of Fame",
    ],
  },
  {
    group: "Honours",
    metric: "mvps",
    unit: "tournament MVP awards",
    targets: [1, 2, 3, 5, 10, 15, 20],
    names: [
      "MVP", "Twice The Best", "MVP Hat-Trick", "Crown Collector", "Ten Crowns",
      "Dynasty", "Untouchable",
    ],
  },
  {
    group: "Highlights",
    metric: "bestKills",
    unit: "kills in a single match",
    targets: [5, 8, 10, 12, 15, 18, 20, 25, 30],
    names: [
      "Solid Match", "Big Game", "Double Digits", "Carry Job", "Fifteen Bomb",
      "Rampage", "Twenty Bomb", "Unstoppable", "God Mode",
    ],
  },
  {
    group: "Highlights",
    metric: "bestDamage",
    unit: "damage in a single match",
    targets: [2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000],
    names: [
      "Hot Hands", "Pressure Cooker", "Wrecking Ball", "Five-K Match", "Meltdown",
      "Scorched Earth", "Ten-K Match", "Overkill", "Damage Deity",
    ],
  },
  {
    group: "Consistency",
    metric: "avgKills",
    unit: "average kills per match",
    decimals: 1,
    targets: [2, 3, 4, 5, 6, 7, 8, 10],
    names: [
      "Dependable", "Steady Aim", "Reliable Fragger", "Consistent Threat", "Elite Average",
      "Fear Factor", "Peak Form", "Statistical Anomaly",
    ],
  },
  {
    group: "Consistency",
    metric: "avgDamage",
    unit: "average damage per match",
    targets: [500, 1000, 1500, 2000, 2500, 3000, 4000],
    names: [
      "Warm Barrel", "Steady Output", "High Output", "Damage Engine", "Relentless",
      "Pressure Constant", "Damage Monolith",
    ],
  },
  {
    group: "Placements",
    metric: "wins",
    unit: "1st place matches",
    targets: [1, 2, 3, 5, 10, 15, 20, 30, 50],
    names: [
      "Winner Winner", "Double Dinner", "Triple Crown", "Five Star", "Ten Wins",
      "Win Machine", "Twenty Wins", "Serial Winner", "Champion Eternal",
    ],
  },
  {
    group: "Placements",
    metric: "top3",
    unit: "top-3 finishes",
    targets: [1, 3, 5, 10, 20, 30, 50],
    names: [
      "Podium", "Podium Regular", "Consistent Podium", "Top Tier", "Podium Machine",
      "Elite Bracket", "Podium Dynasty",
    ],
  },
];

function buildCatalog(): Achievement[] {
  const out: Achievement[] = [];
  for (const tier of TIERS) {
    tier.targets.forEach((target, i) => {
      const name = tier.names[i] ?? `${tier.group} ${i + 1}`;
      out.push({
        id: `${tier.metric}-${target}`,
        name,
        description: `Reach ${tier.decimals ? target.toFixed(tier.decimals) : fmt(target)} ${tier.unit}`,
        group: tier.group,
        rarity: rarityFor(i, tier.targets.length),
        target,
        metric: tier.metric,
      });
    });
  }
  return out;
}

/** 100+ achievements, all derived from already-logged match data. */
export const ACHIEVEMENTS: Achievement[] = buildCatalog();
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

export const RARITY_STYLE: Record<Rarity, { label: string; badge: string; ring: string }> = {
  common: {
    label: "Common",
    badge: "bg-white/[0.06] text-muted-foreground border-white/10",
    ring: "ring-white/10",
  },
  rare: {
    label: "Rare",
    badge: "bg-sky-400/10 text-sky-300 border-sky-400/30",
    ring: "ring-sky-400/30",
  },
  epic: {
    label: "Epic",
    badge: "bg-violet-400/10 text-violet-300 border-violet-400/30",
    ring: "ring-violet-400/30",
  },
  legendary: {
    label: "Legendary",
    badge: "bg-neon-soft text-neon border-neon/40",
    ring: "ring-neon/40",
  },
  mythic: {
    label: "Mythic",
    badge: "bg-rose-400/10 text-rose-300 border-rose-400/40",
    ring: "ring-rose-400/40",
  },
};

export const RARITY_POINTS: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  legendary: 12,
  mythic: 25,
};

export type EarnedAchievement = Achievement & {
  value: number;
  unlocked: boolean;
  progress: number;
};

export function evaluateAchievements(m: PlayerMetrics): EarnedAchievement[] {
  return ACHIEVEMENTS.map((a) => {
    const value = m[a.metric] ?? 0;
    return {
      ...a,
      value,
      unlocked: value >= a.target,
      progress: a.target ? Math.min(1, value / a.target) : 0,
    };
  });
}

export function achievementScore(list: EarnedAchievement[]): number {
  return list.reduce((acc, a) => (a.unlocked ? acc + RARITY_POINTS[a.rarity] : acc), 0);
}

/** Prestige tier drives the premium profile animations. */
export type Prestige = "none" | "bronze" | "silver" | "gold" | "elite";

export function prestigeOf(unlockedCount: number): Prestige {
  if (unlockedCount >= 60) return "elite";
  if (unlockedCount >= 40) return "gold";
  if (unlockedCount >= 22) return "silver";
  if (unlockedCount >= 8) return "bronze";
  return "none";
}

export const PRESTIGE_LABEL: Record<Prestige, string> = {
  none: "Unranked",
  bronze: "Bronze Collector",
  silver: "Silver Collector",
  gold: "Gold Collector",
  elite: "Elite Collector",
};
