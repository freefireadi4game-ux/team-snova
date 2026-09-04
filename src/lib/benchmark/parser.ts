import type {
  BenchmarkSourceType,
  ExtractedBenchmarkStats,
  OCRResult,
  OCRWord,
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
  const cleaned = value
    .replace(/,/g, "")
    .replace(/[^0-9.%-]/g, "");

  if (!cleaned) return null;

  const normalized = cleaned.replace("%", "");
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function wordsFromOCR(ocr: OCRResult): OCRWord[] {
  return (ocr.words ?? [])
    .map((word) => ({
      ...word,
      text: cleanText(String(word.text ?? "")),
      left: Number(word.left ?? 0),
      top: Number(word.top ?? 0),
      width: Number(word.width ?? 0),
      height: Number(word.height ?? 0),
    }))
    .filter((word) => word.text);
}

function findMetric(
  text: string,
  patterns: RegExp[],
): number | null {
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

function detectSourceType(
  text: string,
): BenchmarkSourceType | null {
  const value = normalize(text);

  if (
    value.includes("scoreboard") &&
    (
      value.includes("eliminations") ||
      value.includes("headshots") ||
      value.includes("headshot rate") ||
      value.includes("total damage") ||
      value.includes("highest elimination streak")
    )
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
    value.includes("br-ranked") ||
    value.includes("br ranked") ||
    value.includes("br mode")
  ) {
    return "battle_royale";
  }

  return null;
}

/**
 * Find a numeric OCR word close to a label.
 *
 * This is deliberately stricter than the previous implementation:
 * - horizontal distance matters
 * - vertical distance matters
 * - tiny unrelated HUD numbers are rejected where possible
 */
function findNumberNearLabel(
  ocr: OCRResult,
  labelPattern: RegExp,
  options?: {
    direction?: "right" | "below" | "any";
    maxX?: number;
    maxY?: number;
    minValue?: number;
    maxValue?: number;
    requireConfidence?: number;
  },
): number | null {
  const words = wordsFromOCR(ocr);

  const labels = words.filter((word) =>
    labelPattern.test(normalize(word.text)),
  );

  if (!labels.length) return null;

  const numericWords = words
    .map((word) => ({
      ...word,
      value: numberFromText(word.text),
    }))
    .filter((word) => {
      if (word.value === null) return false;

      const minValue = options?.minValue ?? 0;
      const maxValue =
        options?.maxValue ?? Number.POSITIVE_INFINITY;

      if (word.value < minValue || word.value > maxValue) {
        return false;
      }

      if (
        options?.requireConfidence !== undefined &&
        (word.confidence ?? 0) < options.requireConfidence
      ) {
        return false;
      }

      return true;
    });

  if (!numericWords.length) return null;

  let best:
    | {
        value: number;
        score: number;
      }
    | null = null;

  for (const label of labels) {
    for (const candidate of numericWords) {
      const labelCenterX =
        label.left + Math.max(label.width ?? 0, 0) / 2;

      const candidateCenterX =
        candidate.left +
        Math.max(candidate.width ?? 0, 0) / 2;

      const dx = candidateCenterX - labelCenterX;
      const dy = candidate.top - label.top;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      const direction =
        options?.direction ?? "any";

      if (direction === "right" && dx < -20) {
        continue;
      }

      if (direction === "below" && dy < -10) {
        continue;
      }

      if (options?.maxX !== undefined && absX > options.maxX) {
        continue;
      }

      if (options?.maxY !== undefined && absY > options.maxY) {
        continue;
      }

      const score =
        absY * 5 +
        absX +
        (direction === "right" && dx < 0 ? 500 : 0) +
        (direction === "below" && dy < 0 ? 500 : 0);

      if (!best || score < best.score) {
        best = {
          value: candidate.value!,
          score,
        };
      }
    }
  }

  return best?.value ?? null;
}

/**
 * Training screenshots have a distinctive scoreboard:
 *
 *          168
 *      ELIMINATIONS
 *
 * and the smaller right-side stats:
 * 15 HEADSHOTS
 * 12 HIGHEST ELIMINATION STREAK
 * TOTAL DAMAGE 70397
 * HEADSHOT RATE 8.93%
 * K/D RATIO 1.42
 *
 * Prefer label/value relationships over random OCR numbers.
 */
function parseTraining(
  ocr: OCRResult,
  text: string,
): Partial<ExtractedBenchmarkStats> {
  const words = wordsFromOCR(ocr);

  const numericWords = words
    .map((word) => ({
      ...word,
      value: numberFromText(word.text),
    }))
    .filter(
      (word) =>
        word.value !== null &&
        Number.isFinite(word.value),
    );

  /*
   * ELIMINATIONS
   *
   * In the supplied screenshots this is the large number on the
   * left side of the scoreboard. It is normally much larger than
   * the small HUD numbers around it.
   */
  let kills: number | null = null;

  const eliminationLabelIndex = words.findIndex((word) =>
    /^eliminations?$/i.test(word.text),
  );

  if (eliminationLabelIndex >= 0) {
    const label = words[eliminationLabelIndex];

    const candidates = numericWords
      .filter((candidate) => {
        const dx =
          candidate.left -
          label.left;

        const dy =
          candidate.top -
          label.top;

        return (
          Math.abs(dx) <= 350 &&
          dy < 40 &&
          dy > -450 &&
          candidate.value! >= 20
        );
      })
      .sort((a, b) => {
        const aDx = Math.abs(
          a.left - label.left,
        );
        const aDy = Math.abs(
          a.top - label.top,
        );

        const bDx = Math.abs(
          b.left - label.left,
        );
        const bDy = Math.abs(
          b.top - label.top,
        );

        return (
          (aDy * 5 + aDx) -
          (bDy * 5 + bDx)
        );
      });

    kills = candidates[0]?.value ?? null;
  }

  /*
   * If spatial extraction fails, use a conservative textual
   * fallback. Require a reasonably large value so HUD numbers
   * like 1 / 8 / 12 are less likely to be selected as kills.
   */
  if (kills === null) {
    kills = findMetric(text, [
      /\beliminations?\s*[:\-]?\s*([0-9]{2,4})\b/i,
      /\bkills?\s*[:\-]?\s*([0-9]{2,4})\b/i,
    ]);
  }

  const headshots =
    findMetric(text, [
      /\bheadshots?\s*[:\-]?\s*([0-9]{1,4})\b/i,
      /\bheadshot\s*[:\-]?\s*([0-9]{1,4})\b/i,
    ]) ??
    findNumberNearLabel(
      ocr,
      /^headshots?$/i,
      {
        direction: "right",
        maxX: 420,
        maxY: 100,
        minValue: 1,
        maxValue: 999,
      },
    );

  const headshotRate =
    findMetric(text, [
      /\bheadshot\s*rate\s*[:\-]?\s*([0-9.]+)\s*%/i,
      /\bheadshot\s*rate\s+([0-9.]+)\s*%/i,
      /\bhsr\s*[:\-]?\s*([0-9.]+)\s*%/i,
    ]) ??
    findNumberNearLabel(
      ocr,
      /^rate$/i,
      {
        direction: "right",
        maxX: 420,
        maxY: 110,
        minValue: 0,
        maxValue: 100,
      },
    );

  const damage =
    findMetric(text, [
      /\btotal\s*damage\s*[:\-]?\s*([0-9,]+)\b/i,
      /\bdamage\s*[:\-]?\s*([0-9,]+)\b/i,
      /\bdmg\s*[:\-]?\s*([0-9,]+)\b/i,
    ]) ??
    findNumberNearLabel(
      ocr,
      /^damage$/i,
      {
        direction: "right",
        maxX: 450,
        maxY: 120,
        minValue: 100,
        maxValue: 500000,
      },
    );

  const kdRatio = findMetric(text, [
    /\bk\/d\s*ratio\s*[:\-]?\s*([0-9.]+)/i,
    /\bk\/d\s*[:\-]?\s*([0-9.]+)/i,
    /\bk\s*\/\s*d\s*ratio\s*[:\-]?\s*([0-9.]+)/i,
  ]);

  const eliminationStreak =
    findMetric(text, [
      /\bhighest\s*elimination\s*streak\s*[:\-]?\s*([0-9,]+)/i,
      /\belimination\s*streak\s*[:\-]?\s*([0-9,]+)/i,
    ]) ??
    findNumberNearLabel(
      ocr,
      /^streak$/i,
      {
        direction: "right",
        maxX: 450,
        maxY: 130,
        minValue: 1,
        maxValue: 999,
      },
    );

  return {
    kills,
    headshots,
    headshot_rate: headshotRate,
    damage,
    kd_ratio: kdRatio,
    elimination_streak: eliminationStreak,

    // Training rank/placement is intentionally ignored.
    placement: null,

    // Training screenshots do not provide these benchmark values.
    booyah: 0,
    wins: null,
    matches: null,
    assists: null,

    mode: null,
    source_type: "training",
  };
}

/**
 * Solo-vs-Squad / BR-Ranked:
 *
 * Example supplied screenshot:
 *   #1/14
 *
 * Player row:
 *   K = 22
 *   A = 3
 *   DMG = 9192
 */
function parseSoloVsSquad(
  ocr: OCRResult,
  text: string,
): Partial<ExtractedBenchmarkStats> {
  let placement: number | null = null;

  /*
   * Placement:
   * #1/14
   * #1 / 14
   * #1
   */
  const placementMatch = text.match(
    /#\s*(\d+)\s*\/\s*\d+/i,
  );

  if (placementMatch) {
    placement = Number(placementMatch[1]);
  }

  if (placement === null) {
    const compactPlacement = text.match(
      /#\s*(\d+)\b/i,
    );

    if (compactPlacement) {
      placement = Number(
        compactPlacement[1],
      );
    }
  }

  /*
   * Kills:
   * K 22
   * K: 22
   */
  let kills =
    findMetric(text, [
      /(?:^|\s)k\s*[:\-]?\s*(\d+)(?:\s|$)/i,
    ]);

  if (kills === null) {
    kills = findNumberNearLabel(
      ocr,
      /^k$/i,
      {
        direction: "right",
        maxX: 500,
        maxY: 120,
        minValue: 0,
        maxValue: 100,
      },
    );
  }

  /*
   * Assists:
   * A 3
   * A: 3
   */
  let assists =
    findMetric(text, [
      /(?:^|\s)a\s*[:\-]?\s*(\d+)(?:\s|$)/i,
    ]);

  if (assists === null) {
    assists = findNumberNearLabel(
      ocr,
      /^a$/i,
      {
        direction: "right",
        maxX: 500,
        maxY: 120,
        minValue: 0,
        maxValue: 100,
      },
    );
  }

  /*
   * Damage:
   * DMG 9192
   * damage 9192
   */
  let damage =
    findMetric(text, [
      /\bdmg\s*[:\-]?\s*([0-9,]+)/i,
      /\bdamage\s*[:\-]?\s*([0-9,]+)/i,
    ]);

  if (damage === null) {
    damage = findNumberNearLabel(
      ocr,
      /^dmg$/i,
      {
        direction: "right",
        maxX: 600,
        maxY: 140,
        minValue: 0,
        maxValue: 500000,
      },
    );
  }

  return {
    kills,
    damage,
    assists,
    placement,
    headshots: null,
    headshot_rate: null,
    booyah:
      placement === 1 ? 1 : 0,
    wins:
      placement === 1 ? 1 : null,
    matches: 1,
    elimination_streak: null,
    kd_ratio: null,
    mode: "solo vs squad",
    source_type: "solo_vs_squad",
  };
}

export function parseBenchmarkOCR(
  ocr: OCRResult,
  expectedSourceType?: BenchmarkSourceType | null,
): ExtractedBenchmarkStats {
  const text = cleanText(ocr.text);

  const detectedSourceType =
    detectSourceType(text);

  const sourceType =
    expectedSourceType ??
    detectedSourceType ??
    null;

  let extracted: Partial<ExtractedBenchmarkStats>;

  if (sourceType === "training") {
    extracted = parseTraining(ocr, text);
  } else if (
    sourceType === "solo_vs_squad" ||
    sourceType === "battle_royale"
  ) {
    extracted = parseSoloVsSquad(
      ocr,
      text,
    );
  } else {
    /*
     * Generic fallback for custom tasks.
     */
    extracted = {
      kills: findMetric(text, [
        /\beliminations?\s*[:\-]?\s*([0-9,]+)/i,
        /\bkills?\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      headshots: findMetric(text, [
        /\bheadshots?\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      headshot_rate: findMetric(text, [
        /\bheadshot\s*rate\s*[:\-]?\s*([0-9.]+)\s*%/i,
      ]),

      damage: findMetric(text, [
        /\b(?:total\s*)?damage\s*[:\-]?\s*([0-9,]+)/i,
        /\bdmg\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      booyah: 0,

      wins: findMetric(text, [
        /\bwins?\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      placement: findMetric(text, [
        /\b(?:rank|placement|position)\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      matches: findMetric(text, [
        /\bmatches?\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      assists: findMetric(text, [
        /\bassists?\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      elimination_streak: findMetric(text, [
        /\bhighest\s*elimination\s*streak\s*[:\-]?\s*([0-9,]+)/i,
      ]),

      kd_ratio: findMetric(text, [
        /\bk\/d\s*ratio\s*[:\-]?\s*([0-9.]+)/i,
      ]),

      mode: null,
      source_type: sourceType,
    };
  }

  return {
    kills:
      extracted.kills ?? null,

    headshots:
      extracted.headshots ?? null,

    headshot_rate:
      extracted.headshot_rate ?? null,

    damage:
      extracted.damage ?? null,

    booyah:
      extracted.booyah ?? 0,

    wins:
      extracted.wins ?? null,

    placement:
      extracted.placement ?? null,

    matches:
      extracted.matches ?? null,

    assists:
      extracted.assists ?? null,

    elimination_streak:
      extracted.elimination_streak ?? null,

    kd_ratio:
      extracted.kd_ratio ?? null,

    mode:
      extracted.mode ?? null,

    source_type:
      extracted.source_type ?? sourceType,

    confidence:
      ocr.confidence,

    raw_text:
      ocr.text,
  };
      }
