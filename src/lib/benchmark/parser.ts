import type {
  BenchmarkSourceType,
  ExtractedBenchmarkStats,
  OCRResult,
} from "./types";

function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return cleanText(text).toLowerCase();
}

function numberFromText(value: string): number | null {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.%-]/g, "");

  if (!cleaned) return null;

  const number = Number(cleaned.replace("%", ""));
  return Number.isFinite(number) ? number : null;
}

function findMetric(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    const value = numberFromText(match[1] ?? "");

    if (value !== null) {
      return value;
    }
  }

  return null;
}

/**
 * Fallback extractor for screenshots where OCR separates labels and values
 * into different words/lines instead of returning "LABEL: VALUE".
 */
function findValueNearLabel(
  ocr: OCRResult,
  labelPatterns: RegExp[],
  options?: {
    maxVerticalDistance?: number;
    minVerticalDistance?: number;
  },
): number | null {
  const words = (ocr.words ?? [])
    .map((word) => ({
      ...word,
      text: normalize(word.text ?? ""),
      left: Number(word.left ?? 0),
      top: Number(word.top ?? 0),
    }))
    .filter((word) => word.text);

  if (!words.length) return null;

  const maxVerticalDistance =
    options?.maxVerticalDistance ?? 220;
  const minVerticalDistance =
    options?.minVerticalDistance ?? 0;

  const numericWords = words
    .map((word) => ({
      ...word,
      value: numberFromText(word.text),
    }))
    .filter((word) => word.value !== null);

  if (!numericWords.length) return null;

  for (const labelPattern of labelPatterns) {
    const labels = words.filter((word) =>
      labelPattern.test(word.text),
    );

    for (const label of labels) {
      const candidates = numericWords
        .filter((candidate) => {
          const verticalDistance = Math.abs(
            candidate.top - label.top,
          );

          return (
            verticalDistance >= minVerticalDistance &&
            verticalDistance <= maxVerticalDistance &&
            Math.abs(candidate.left - label.left) <= 900
          );
        })
        .sort((a, b) => {
          const aDistance =
            Math.abs(a.top - label.top) * 10 +
            Math.abs(a.left - label.left);

          const bDistance =
            Math.abs(b.top - label.top) * 10 +
            Math.abs(b.left - label.left);

          return aDistance - bDistance;
        });

      const value = candidates[0]?.value;

      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }

  return null;
}

function detectSourceType(
  text: string,
): BenchmarkSourceType | null {
  const value = normalize(text);

  if (
    value.includes("scoreboard") &&
    (value.includes("eliminations") ||
      value.includes("headshot rate") ||
      value.includes("total damage"))
  ) {
    return "training";
  }

  if (
    value.includes("solo vs squad") ||
    value.includes("solo versus squad")
  ) {
    return "solo_vs_squad";
  }

  if (
    value.includes("battle royale") ||
    value.includes("br mode")
  ) {
    return "battle_royale";
  }

  return null;
}

function detectBooyah(text: string): number | null {
  const value = normalize(text);

  if (
    value.includes("booyah") ||
    value.includes("victory") ||
    value.includes("winner")
  ) {
    return 1;
  }

  return 0;
}

/**
 * Solo-vs-Squad result layouts commonly show placement as:
 * #1/14
 * #1 / 14
 * #1
 */
function extractSoloVsSquadPlacement(
  text: string,
): number | null {
  const direct = text.match(
    /(?:^|\s)#\s*(\d+)\s*\/\s*\d+(?:\s|$)/i,
  );

  if (direct) {
    return Number(direct[1]);
  }

  const compact = text.match(/#\s*(\d+)/i);

  if (compact) {
    return Number(compact[1]);
  }

  return null;
}

/**
 * Solo-vs-Squad scoreboard commonly uses:
 * K 22
 * K: 22
 * kills 22
 */
function extractSoloVsSquadKills(
  text: string,
): number | null {
  const direct = text.match(
    /(?:^|\s)k\s*[:\-]?\s*(\d+)(?:\s|$)/i,
  );

  if (direct) {
    return Number(direct[1]);
  }

  const killsLabel = text.match(
    /\bkill(?:s)?\s*[:\-]?\s*(\d+)/i,
  );

  if (killsLabel) {
    return Number(killsLabel[1]);
  }

  return null;
}

/**
 * Optional support for Solo-vs-Squad damage.
 */
function extractSoloVsSquadDamage(
  text: string,
): number | null {
  const direct = text.match(
    /\bdmg\s*[:\-]?\s*([\d,]+)/i,
  );

  if (direct) {
    return numberFromText(direct[1]);
  }

  const damageLabel = text.match(
    /\bdamage\s*[:\-]?\s*([\d,]+)/i,
  );

  if (damageLabel) {
    return numberFromText(damageLabel[1]);
  }

  return null;
}

/**
 * Optional support for Solo-vs-Squad assists.
 */
function extractSoloVsSquadAssists(
  text: string,
): number | null {
  const direct = text.match(
    /(?:^|\s)a\s*[:\-]?\s*(\d+)(?:\s|$)/i,
  );

  if (direct) {
    return Number(direct[1]);
  }

  const assistsLabel = text.match(
    /\bassists?\s*[:\-]?\s*(\d+)/i,
  );

  if (assistsLabel) {
    return Number(assistsLabel[1]);
  }

  return null;
}

export function parseBenchmarkOCR(
  ocr: OCRResult,
  /**
   * The source type of the task being submitted. Used as a fallback when the
   * screenshot text itself does not clearly announce the mode, so a
   * solo-vs-squad scoreboard is still parsed with the scoreboard rules.
   */
  expectedSourceType?: BenchmarkSourceType | null,
): ExtractedBenchmarkStats {
  const text = cleanText(ocr.text);
  const normalized = normalize(text);

  const detected = detectSourceType(text);
  const sourceType = detected ?? expectedSourceType ?? null;
  const isTraining = sourceType === "training";
  const isSoloVsSquad =
    sourceType === "solo_vs_squad" ||
    sourceType === "battle_royale";


  /*
   * TRAINING
   *
   * Exact fields from the Free Fire training scoreboard:
   * Eliminations
   * Headshots
   * Headshot Rate
   * Total Damage
   * Highest Elimination Streak
   * K/D Ratio
   *
   * Training placement/rank is intentionally ignored.
   */

  const kills =
    findMetric(text, [
      /\beliminations?\s*[:\-]?\s*([\d,]+)/i,
      /\bkills?\s*[:\-]?\s*([\d,]+)/i,
      /\bkill\s*[:\-]?\s*([\d,]+)/i,
    ]) ??
    findValueNearLabel(ocr, [
      /^eliminations?$/i,
      /^kills?$/i,
      /^kill$/i,
    ]);

  const headshots =
    findMetric(text, [
      /\bheadshots?\s*[:\-]?\s*([\d,]+)/i,
      /\bheadshot\s*[:\-]?\s*([\d,]+)/i,
    ]) ??
    findValueNearLabel(ocr, [
      /^headshots?$/i,
      /^headshot$/i,
    ]);

  const headshotRate =
    findMetric(text, [
      /\bheadshot\s*rate\s*[:\-]?\s*([\d.]+)\s*%/i,
      /\bheadshot\s*rate\s+([\d.]+)\s*%/i,
      /\bhsr\s*[:\-]?\s*([\d.]+)\s*%/i,
    ]) ??
    findValueNearLabel(
      ocr,
      [/^headshot$/i, /^rate$/i],
      {
        maxVerticalDistance: 260,
      },
    );

  const damage =
    findMetric(text, [
      /\btotal\s*damage\s*[:\-]?\s*([\d,]+)/i,
      /\bdamage\s*[:\-]?\s*([\d,]+)/i,
      /\bdmg\s*[:\-]?\s*([\d,]+)/i,
    ]) ??
    findValueNearLabel(ocr, [
      /^total$/i,
      /^damage$/i,
      /^dmg$/i,
    ]);

  const kdRatio = findMetric(text, [
    /\bk\/d\s*ratio\s*[:\-]?\s*([\d.]+)/i,
    /\bk\/d\s*[:\-]?\s*([\d.]+)/i,
    /\bk\s*\/\s*d\s*ratio\s*[:\-]?\s*([\d.]+)/i,
  ]);

  const eliminationStreak =
    findMetric(text, [
      /\bhighest\s*elimination\s*streak\s*[:\-]?\s*([\d,]+)/i,
      /\belimination\s*streak\s*[:\-]?\s*([\d,]+)/i,
    ]) ??
    findValueNearLabel(ocr, [
      /^highest$/i,
      /^elimination$/i,
      /^streak$/i,
    ]);

  /*
   * SOLO VS SQUAD
   *
   * Placement is important here.
   * Example:
   * #1/14
   *
   * Kills can appear in the K column:
   * K 22
   */

  const soloKills = isSoloVsSquad
    ? extractSoloVsSquadKills(text)
    : null;

  const soloPlacement = isSoloVsSquad
    ? extractSoloVsSquadPlacement(text)
    : null;

  const soloDamage = isSoloVsSquad
    ? extractSoloVsSquadDamage(text)
    : null;

  const soloAssists = isSoloVsSquad
    ? extractSoloVsSquadAssists(text)
    : null;

  const placement = isSoloVsSquad
    ? soloPlacement
    : null;

  const matches = findMetric(text, [
    /\bmatches?\s*[:\-]?\s*([\d,]+)/i,
    /\bmatch\s*count\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const assists =
    soloAssists ??
    findMetric(text, [
      /\bassists?\s*[:\-]?\s*([\d,]+)/i,
      /\bassist\s*[:\-]?\s*([\d,]+)/i,
    ]);

  const booyah = detectBooyah(text);

  const wins =
    booyah === 1
      ? 1
      : findMetric(text, [
          /\bwins?\s*[:\-]?\s*([\d,]+)/i,
        ]);

  return {
    kills: isSoloVsSquad
      ? soloKills ?? kills
      : kills,

    headshots,

    headshot_rate: headshotRate,

    damage: isSoloVsSquad
      ? soloDamage ?? damage
      : damage,

    booyah,

    wins,

    /*
     * Training placement is deliberately null.
     * Solo-vs-Squad uses the actual #position from the result screen.
     */
    placement,

    matches,

    assists,

    elimination_streak: eliminationStreak,

    kd_ratio: isTraining ? kdRatio : kdRatio,

    mode: isSoloVsSquad
      ? "solo vs squad"
      : normalized.includes("solo vs squad")
        ? "solo vs squad"
        : null,

    source_type: sourceType,

    confidence: ocr.confidence,

    raw_text: ocr.text,
  };
}
