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

  const n = Number(cleaned.replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function findMetric(
  text: string,
  patterns: RegExp[],
): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const value = numberFromText(match[1] ?? "");
    if (value !== null) return value;
  }

  return null;
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

function findNumberNearLabel(
  ocr: OCRResult,
  labelPattern: RegExp,
  options?: {
    direction?: "right" | "below" | "any";
    maxX?: number;
    maxY?: number;
    minValue?: number;
    maxValue?: number;
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

      if (
        options?.minValue !== undefined &&
        word.value < options.minValue
      ) {
        return false;
      }

      if (
        options?.maxValue !== undefined &&
        word.value > options.maxValue
      ) {
        return false;
      }

      return true;
    });

  let best: {
    value: number;
    score: number;
  } | null = null;

  for (const label of labels) {
    for (const candidate of numericWords) {
      const labelCenterX =
        label.left + label.width / 2;

      const candidateCenterX =
        candidate.left + candidate.width / 2;

      const dx = candidateCenterX - labelCenterX;
      const dy = candidate.top - label.top;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      const direction =
        options?.direction ?? "any";

      if (direction === "right" && dx < -25) {
        continue;
      }

      if (direction === "below" && dy < -15) {
        continue;
      }

      if (
        options?.maxX !== undefined &&
        absX > options.maxX
      ) {
        continue;
      }

      if (
        options?.maxY !== undefined &&
        absY > options.maxY
      ) {
        continue;
      }

      const score = absY * 6 + absX;

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

function detectBooyah(text: string): number | null {
  const value = normalize(text);

  return value.includes("booyah") ||
    value.includes("victory") ||
    value.includes("winner")
    ? 1
    : 0;
}

/* -------------------------------------------------------------------------- */
/* TRAINING SCOREBOARD                                                        */
/* -------------------------------------------------------------------------- */

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
   * In the provided Free Fire training screenshot:
   *
   * 168
   * ELIMINATIONS
   *
   * The eliminations number is the large number above the label.
   *
   * We therefore search specifically above ELIMINATIONS and reject
   * tiny HUD numbers.
   */
  let kills: number | null = null;

  const eliminationLabel = words.find((word) =>
    /^eliminations?$/i.test(word.text),
  );

  if (eliminationLabel) {
    const candidates = numericWords
      .filter((candidate) => {
        const dx =
          candidate.left - eliminationLabel.left;

        const dy =
          candidate.top - eliminationLabel.top;

        return (
          Math.abs(dx) <= 350 &&
          dy < 50 &&
          dy > -500 &&
          candidate.value! >= 20
        );
      })
      .sort((a, b) => {
        const scoreA =
          Math.abs(
            a.top - eliminationLabel.top,
          ) * 5 +
          Math.abs(
            a.left - eliminationLabel.left,
          );

        const scoreB =
          Math.abs(
            b.top - eliminationLabel.top,
          ) * 5 +
          Math.abs(
            b.left - eliminationLabel.left,
          );

        return scoreA - scoreB;
      });

    kills = candidates[0]?.value ?? null;
  }

  /*
   * Text fallback.
   *
   * Require at least two digits so numbers like 1, 8 or 12
   * from unrelated HUD elements are not chosen as kills.
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
        maxX: 450,
        maxY: 140,
        minValue: 0,
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
        maxX: 450,
        maxY: 140,
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
        maxX: 500,
        maxY: 150,
        minValue: 100,
        maxValue: 500000,
      },
    );

  /*
   * K/D is read directly from the screenshot.
   * It is never calculated from matches or deaths.
   */
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
        maxX: 500,
        maxY: 160,
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

    /*
     * TRAINING DOES NOT USE PLACEMENT.
     */
    placement: null,

    booyah: 0,
    wins: null,
    matches: null,
    assists: null,

    mode: null,
    source_type: "training",
  };
}

/* -------------------------------------------------------------------------- */
/* SOLO VS SQUAD / BR SCOREBOARD                                              */
/* -------------------------------------------------------------------------- */

function parseSoloVsSquad(
  ocr: OCRResult,
  text: string,
): Partial<ExtractedBenchmarkStats> {
  let placement: number | null = null;

  /*
   * Example:
   * #1/14
   */
  const placementMatch = text.match(
    /#\s*(\d+)\s*\/\s*\d+/i,
  );

  if (placementMatch) {
    placement = Number(
      placementMatch[1],
    );
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
   * K 22
   * K: 22
   */
  let kills = findMetric(text, [
    /(?:^|\s)k\s*[:\-]?\s*(\d+)(?:\s|$)/i,
    /\bkills?\s*[:\-]?\s*(\d+)/i,
  ]);

  if (kills === null) {
    kills = findNumberNearLabel(
      ocr,
      /^k$/i,
      {
        direction: "right",
        maxX: 500,
        maxY: 140,
        minValue: 0,
        maxValue: 100,
      },
    );
  }

  /*
   * A 3
   * A: 3
   */
  let assists = findMetric(text, [
    /(?:^|\s)a\s*[:\-]?\s*(\d+)(?:\s|$)/i,
    /\bassists?\s*[:\-]?\s*(\d+)/i,
  ]);

  if (assists === null) {
    assists = findNumberNearLabel(
      ocr,
      /^a$/i,
      {
        direction: "right",
        maxX: 500,
        maxY: 140,
        minValue: 0,
        maxValue: 100,
      },
    );
  }

  /*
   * DMG 9192
   */
  let damage = findMetric(text, [
    /\bdmg\s*[:\-]?\s*([0-9,]+)/i,
    /\bdamage\s*[:\-]?\s*([0-9,]+)/i,
  ]);

  if (damage === null) {
    damage = findNumberNearLabel(
      ocr,
      /^dmg$/i,
      {
        direction: "right",
        maxX: 650,
        maxY: 160,
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

/* -------------------------------------------------------------------------- */
/* MAIN PARSER                                                               */
/* -------------------------------------------------------------------------- */

export function parseBenchmarkOCR(
  ocr: OCRResult,
  expectedSourceType?: BenchmarkSourceType | null,
): ExtractedBenchmarkStats {
  const text = cleanText(ocr.text);

  const detectedSourceType =
    detectSourceType(text);

  /*
   * IMPORTANT:
   * The task's configured source type has priority.
   *
   * This is important because a screenshot may not OCR
   * the mode name correctly.
   */
  const sourceType =
    expectedSourceType ??
    detectedSourceType ??
    null;

  let extracted:
    Partial<ExtractedBenchmarkStats>;

  if (sourceType === "training") {
    extracted = parseTraining(
      ocr,
      text,
    );
  } else if (
    sourceType === "solo_vs_squad" ||
    sourceType === "battle_royale"
  ) {
    extracted = parseSoloVsSquad(
      ocr,
      text,
    );
  } else {
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

      booyah: detectBooyah(text),

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

      elimination_streak: findMetric(
        text,
        [
          /\bhighest\s*elimination\s*streak\s*[:\-]?\s*([0-9,]+)/i,
        ],
      ),

      kd_ratio: findMetric(text, [
        /\bk\/d\s*ratio\s*[:\-]?\s*([0-9.]+)/i,
      ]),

      mode: null,
      source_type: sourceType,
    };
  }

  return {
    kills: extracted.kills ?? null,

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
      extracted.source_type ??
      sourceType,

    confidence:
      ocr.confidence,

    raw_text:
      ocr.text,
  };
}
