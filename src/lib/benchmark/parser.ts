import type {
  BenchmarkSourceType,
  ExtractedBenchmarkStats,
  OCRResult,
} from "./types";

/* -------------------------------------------------------------------------- */
/* TEXT NORMALISATION                                                         */
/* -------------------------------------------------------------------------- */

export function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[|_]/g, " ")
    .replace(/[•·]/g, " ")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises OCR text for label matching. Game HUD fonts confuse Tesseract a
 * lot, so we fold the classic look-alike characters into digits/letters and
 * squash punctuation.
 */
function labelText(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9.%/#'" ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[,\s]/g, "").replace(/[^0-9.]/g, "");
  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function first(...values: (number | null | undefined)[]): number | null {
  for (const value in values) {
    void value;
  }

  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function match(text: string, patterns: RegExp[], group = 1): number | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const value = toNumber(m[group]);
      if (value !== null) return value;
    }
  }

  return null;
}

/**
 * Tesseract regularly drops the decimal point in small HUD text
 * ("1.42" -> "142"). A K/D ratio is realistically between 0 and 30, so a
 * dot-less value above that is rescaled.
 */
function fixRatio(value: number | null, max = 30): number | null {
  if (value === null) return null;

  let n = value;
  let guard = 0;

  while (n > max && guard < 4) {
    n = n / 10;
    guard += 1;
  }

  return Number(n.toFixed(2));
}

/* -------------------------------------------------------------------------- */
/* SOURCE DETECTION                                                           */
/* -------------------------------------------------------------------------- */

function detectSourceType(text: string): BenchmarkSourceType | null {
  const value = labelText(text);

  if (
    /headshot rate|highest elim|total damage|k\/?d ratio|eliminations/.test(
      value,
    ) &&
    !/survival time|revival/.test(value)
  ) {
    return "training";
  }

  if (/solo vs squad|solo versus squad/.test(value)) {
    return "solo_vs_squad";
  }

  if (
    /br[ -]?ranked|battle royale|survival time|revival|booyah|clash squad/.test(
      value,
    )
  ) {
    return "battle_royale";
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* TRAINING SCOREBOARD                                                        */
/* -------------------------------------------------------------------------- */

function parseTrainingText(raw: string): Partial<ExtractedBenchmarkStats> {
  const text = labelText(raw);

  const damage = match(text, [
    /total damage\D{0,12}([0-9][0-9, ]{2,9})/,
    /\bdamage\D{0,12}([0-9][0-9, ]{2,9})/,
  ]);

  const headshotRate = fixRatio(
    match(text, [
      /headshot rate\D{0,12}([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*%?/,
      /\bhsr\D{0,12}([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*%?/,
    ]),
    100,
  );

  const kd = fixRatio(
    match(text, [
      /k\s*\/?\s*d\s*ratio\D{0,12}([0-9]{1,4}(?:\.[0-9]{1,2})?)/,
      /k\s*\/?\s*d\D{0,12}([0-9]{1,4}(?:\.[0-9]{1,2})?)/,
    ]),
  );

  /*
   * The two stat tiles sit side by side above the table:
   *
   *      15                12
   *   HEADSHOTS   HIGHEST ELIMINATION STREAK
   *
   * Sparse-text OCR emits both numbers first, then both labels.
   */
  const pair = text.match(
    /\b([0-9]{1,3})\s+([0-9]{1,3})\s+headshots?\s+highest\s*elim/,
  );

  const headshots = first(
    pair ? toNumber(pair[1]) : null,
    match(text, [
      /\b([0-9]{1,3})\s+headshots?\b/,
      /headshots?\D{0,12}([0-9]{1,3})\b/,
    ]),
  );

  const streak = first(
    pair ? toNumber(pair[2]) : null,
    match(text, [
      /highest\s*elim\w*\s*\w*\s*strea\w*\D{0,12}([0-9]{1,3})\b/,
      /\b([0-9]{1,3})\s+highest\s*elim/,
    ]),
  );

  /*
   * The big number in the diamond: "168 ELIMINATIONS".
   * "ELIMINATED" (deaths) must never be used for it.
   */
  const kills = first(
    match(text, [
      /\b([0-9]{1,4})\s+eliminations\b/,
      /eliminations\D{0,10}([0-9]{1,4})\b/,
      /\beliminations?\b[^0-9]{0,10}([0-9]{1,4})/,
    ]),
    // Kills = deaths * K/D as a last resort (both are printed on this screen).
    (() => {
      const eliminated = match(text, [/eliminated\D{0,12}([0-9]{1,4})\b/]);
      if (eliminated === null || kd === null || kd <= 0) return null;
      return Math.round(eliminated * kd);
    })(),
  );

  return {
    kills,
    headshots,
    headshot_rate: headshotRate,
    damage,
    elimination_streak: streak,
    kd_ratio: kd,
    matches: null,
    assists: null,
    placement: null,
    wins: null,
    booyah: 0,
    mode: "training",
    source_type: "training",
  };
}

/* -------------------------------------------------------------------------- */
/* BATTLE ROYALE / SOLO VS SQUAD SCOREBOARD                                   */
/* -------------------------------------------------------------------------- */

function parsePlacement(raw: string): number | null {
  const text = labelText(raw);

  // "#1/14", "# 1 / 1 4", "#2 /11"
  const hash = text.match(/#\s*([0-9][0-9 ]{0,2})\s*\/\s*([0-9][0-9 ]{0,3})/);
  if (hash) {
    const value = toNumber(hash[1]);
    if (value !== null && value >= 1 && value <= 100) return value;
  }

  const alone = text.match(/#\s*([0-9]{1,2})\b/);
  if (alone) {
    const value = toNumber(alone[1]);
    if (value !== null && value >= 1 && value <= 100) return value;
  }

  return match(text, [
    /\b(?:rank|placement|position)\D{0,10}([0-9]{1,2})\b/,
  ]);
}

type ScoreRow = {
  kills: number;
  assists: number;
  damage: number;
};

/**
 * Scoreboard rows look like:
 *   NAME   K   A   DMG   REVIVAL   SURVIVAL TIME
 *   ...    22  3   9192  0         15'21"
 *
 * OCR usually collapses the survival time to "1521", so the numeric tail is
 * matched as: kills, assists, damage, revival, survival.
 */
function parseScoreRows(raw: string): ScoreRow[] {
  const text = labelText(raw);
  const rows: ScoreRow[] = [];

  const rowPattern =
    /\b([0-9]{1,3})\s+([0-9]{1,3})\s+([0-9]{3,6})\s+([0-9]{1,2})\s+([0-9]{1,2})['"]?\s*([0-9]{1,2})['"]?/g;

  for (const m of text.matchAll(rowPattern)) {
    const kills = toNumber(m[1]);
    const assists = toNumber(m[2]);
    const damage = toNumber(m[3]);

    if (kills === null || assists === null || damage === null) continue;
    if (kills > 60 || assists > 60) continue;

    rows.push({ kills, assists, damage });
  }

  if (rows.length) return rows;

  // Compact fallback: "22 3 9192" (survival time unreadable).
  const compact = /\b([0-9]{1,2})\s+([0-9]{1,2})\s+([0-9]{3,6})\b/g;

  for (const m of text.matchAll(compact)) {
    const kills = toNumber(m[1]);
    const assists = toNumber(m[2]);
    const damage = toNumber(m[3]);

    if (kills === null || assists === null || damage === null) continue;
    if (damage < 100) continue;

    rows.push({ kills, assists, damage });
  }

  return rows;
}

function parseScoreboardText(
  raw: string,
  sourceType: BenchmarkSourceType,
): Partial<ExtractedBenchmarkStats> {
  const text = labelText(raw);
  const placement = parsePlacement(raw);
  const rows = parseScoreRows(raw);

  // The player's own row is the strongest one on the board.
  const best = rows
    .slice()
    .sort((a, b) => b.damage - a.damage || b.kills - a.kills)[0];

  const kills = first(
    best?.kills,
    match(text, [
      /\bk\s+([0-9]{1,2})\b/,
      /\bkills?\D{0,10}([0-9]{1,3})\b/,
      /\beliminations?\D{0,10}([0-9]{1,3})\b/,
    ]),
  );

  const damage = first(
    best?.damage,
    match(text, [/\bdmg\D{0,10}([0-9]{3,6})\b/, /damage\D{0,10}([0-9]{3,6})\b/]),
  );

  const assists = first(
    best?.assists,
    match(text, [/\bassists?\D{0,10}([0-9]{1,3})\b/]),
  );

  const booyah =
    /booyah/.test(text) || placement === 1 ? 1 : placement !== null ? 0 : null;

  return {
    kills,
    damage,
    assists,
    placement,
    headshots: match(text, [/headshots?\D{0,10}([0-9]{1,3})\b/]),
    headshot_rate: null,
    booyah: booyah ?? 0,
    wins: placement === null ? null : placement === 1 ? 1 : 0,
    matches: 1,
    elimination_streak: null,
    kd_ratio: null,
    mode: sourceType === "solo_vs_squad" ? "solo vs squad" : "battle royale",
    source_type: sourceType,
  };
}

/* -------------------------------------------------------------------------- */
/* GENERIC FALLBACK                                                           */
/* -------------------------------------------------------------------------- */

function parseGenericText(raw: string): Partial<ExtractedBenchmarkStats> {
  const training = parseTrainingText(raw);
  const scoreboard = parseScoreboardText(raw, "battle_royale");

  return {
    ...scoreboard,
    ...Object.fromEntries(
      Object.entries(training).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    ),
    mode: null,
    source_type: null,
  };
}

/* -------------------------------------------------------------------------- */
/* MULTI-PASS MERGE                                                           */
/* -------------------------------------------------------------------------- */

const NUMERIC_KEYS = [
  "kills",
  "headshots",
  "headshot_rate",
  "damage",
  "booyah",
  "wins",
  "placement",
  "matches",
  "assists",
  "elimination_streak",
  "kd_ratio",
] as const;

function mergeCandidates(
  candidates: Partial<ExtractedBenchmarkStats>[],
): Partial<ExtractedBenchmarkStats> {
  const merged: Partial<ExtractedBenchmarkStats> = {};

  for (const key of NUMERIC_KEYS) {
    const values = candidates
      .map((candidate) => candidate[key])
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );

    if (!values.length) continue;

    // Most frequently agreed reading wins; ties fall back to the first pass.
    const counts = new Map<number, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    let bestValue = values[0];
    let bestCount = 0;

    for (const value of values) {
      const count = counts.get(value) ?? 0;
      if (count > bestCount) {
        bestCount = count;
        bestValue = value;
      }
    }

    (merged as Record<string, unknown>)[key] = bestValue;
  }

  return merged;
}

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

/** Extracts stats from a single OCR text blob. Exported for testing. */
export function parseStatsFromText(
  raw: string,
  sourceType: BenchmarkSourceType | null,
): Partial<ExtractedBenchmarkStats> {
  if (sourceType === "training") return parseTrainingText(raw);

  if (sourceType === "solo_vs_squad" || sourceType === "battle_royale") {
    return parseScoreboardText(raw, sourceType);
  }

  return parseGenericText(raw);
}

export function parseBenchmarkOCR(
  ocr: OCRResult,
  expectedSourceType?: BenchmarkSourceType | null,
): ExtractedBenchmarkStats {
  const texts = [
    ...(ocr.texts?.length ? ocr.texts : []),
    ocr.text,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

  const uniqueTexts = Array.from(new Set(texts));

  const detected =
    detectSourceType(uniqueTexts.join(" \n ")) ?? null;

  const sourceType = expectedSourceType ?? detected ?? null;

  const merged = mergeCandidates(
    uniqueTexts.map((text) => parseStatsFromText(text, sourceType)),
  );

  const template = parseStatsFromText(uniqueTexts[0] ?? "", sourceType);

  return {
    kills: merged.kills ?? null,
    headshots: merged.headshots ?? null,
    headshot_rate: merged.headshot_rate ?? null,
    damage: merged.damage ?? null,
    booyah: merged.booyah ?? 0,
    wins: merged.wins ?? null,
    placement: merged.placement ?? null,
    matches: merged.matches ?? null,
    assists: merged.assists ?? null,
    elimination_streak: merged.elimination_streak ?? null,
    kd_ratio: merged.kd_ratio ?? null,
    mode: template.mode ?? null,
    source_type: sourceType,
    confidence: ocr.confidence,
    raw_text: uniqueTexts.join("\n---\n"),
  };
}
