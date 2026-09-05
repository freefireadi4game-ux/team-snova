export type PlayerRole =
  | "IGL"
  | "Rusher"
  | "Sniper"
  | "Support"
  | "Fragger"
  | "Flex"
  | "Other";

export type BenchmarkSourceType =
  | "training"
  | "battle_royale"
  | "solo_vs_squad"
  | "custom";

export type BenchmarkOperator = ">=" | "<=" | "=" | ">" | "<";

export type BenchmarkMetric =
  | "kills"
  | "headshots"
  | "headshot_rate"
  | "damage"
  | "booyah"
  | "wins"
  | "placement"
  | "matches"
  | "assists"
  | "elimination_streak"
  | "kd_ratio"
  | "custom";

export type BenchmarkStatus = "draft" | "active" | "inactive";

export type BenchmarkEvidenceStatus =
  | "pass"
  | "fail"
  | "needs_review"
  | "ocr_error";

export type BenchmarkRequirement = {
  id?: string;
  benchmark_id?: string;
  label: string;
  metric: BenchmarkMetric;
  operator: BenchmarkOperator;
  target_value: number;
  source_type?: BenchmarkSourceType;
  required?: boolean;
};

export type Benchmark = {
  id: string;
  name: string;
  description: string | null;
  source_type: BenchmarkSourceType;
  status: BenchmarkStatus;
  role: PlayerRole | "all";
  created_at?: string;
  updated_at?: string;
  requirements: BenchmarkRequirement[];
};

export type OCRWord = {
  text: string;
  confidence?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type OCRResult = {
  text: string;
  /** Raw text of every recognition pass (different preprocessing / page modes). */
  texts?: string[];
  words: OCRWord[];
  confidence: number;
  width: number;
  height: number;
};

export type ExtractedBenchmarkStats = {
  kills: number | null;
  headshots: number | null;
  headshot_rate: number | null;
  damage: number | null;
  booyah: number | null;
  wins: number | null;
  placement: number | null;
  matches: number | null;
  assists: number | null;
  elimination_streak: number | null;
  kd_ratio: number | null;
  mode: string | null;
  source_type: BenchmarkSourceType | null;
  confidence: number;
  raw_text: string;
};

export type BenchmarkCheckResult = {
  requirement: BenchmarkRequirement;
  actual_value: number | null;
  passed: boolean;
  evaluable: boolean;
  message: string;
};

export type BenchmarkEvaluation = {
  status: BenchmarkEvidenceStatus;
  checks: BenchmarkCheckResult[];
  passed_count: number;
  total_required: number;
  extracted: ExtractedBenchmarkStats;
};
