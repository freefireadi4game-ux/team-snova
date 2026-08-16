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

function detectSourceType(text: string): BenchmarkSourceType | null {
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

export function parseBenchmarkOCR(
  ocr: OCRResult,
): ExtractedBenchmarkStats {
  const text = cleanText(ocr.text);
  const normalized = normalize(text);

  const kills = findMetric(text, [
    /\beliminations?\s*[:\-]?\s*([\d,]+)/i,
    /\bkills?\s*[:\-]?\s*([\d,]+)/i,
    /\bkill\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const headshots = findMetric(text, [
    /\bheadshots?\s*[:\-]?\s*([\d,]+)/i,
    /\bheadshot\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const headshotRate = findMetric(text, [
    /\bheadshot\s*rate\s*[:\-]?\s*([\d.]+)\s*%/i,
    /\bheadshot\s*rate\s+([\d.]+)\s*%/i,
    /\bhsr\s*[:\-]?\s*([\d.]+)\s*%/i,
  ]);

  const damage = findMetric(text, [
    /\btotal\s*damage\s*[:\-]?\s*([\d,]+)/i,
    /\bdamage\s*[:\-]?\s*([\d,]+)/i,
    /\bdmg\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const kdRatio = findMetric(text, [
    /\bk\/d\s*ratio\s*[:\-]?\s*([\d.]+)/i,
    /\bk\/d\s*[:\-]?\s*([\d.]+)/i,
  ]);

  const eliminationStreak = findMetric(text, [
    /\bhighest\s*elimination\s*streak\s*[:\-]?\s*([\d,]+)/i,
    /\belimination\s*streak\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const placement = findMetric(text, [
    /\brank\s*[:\-]?\s*([\d,]+)/i,
    /\bplacement\s*[:\-]?\s*([\d,]+)/i,
    /\bposition\s*[:\-]?\s*([\d,]+)/i,
    /(?:^|\s)#\s*([\d]+)/i,
  ]);

  const matches = findMetric(text, [
    /\bmatches?\s*[:\-]?\s*([\d,]+)/i,
    /\bmatch\s*count\s*[:\-]?\s*([\d,]+)/i,
  ]);

  const assists = findMetric(text, [
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

  const sourceType = detectSourceType(text);

  return {
    kills,
    headshots,
    headshot_rate: headshotRate,
    damage,
    booyah,
    wins,
    placement,
    matches,
    assists,
    elimination_streak: eliminationStreak,
    kd_ratio: kdRatio,
    mode: normalized.includes("solo vs squad")
      ? "solo vs squad"
      : null,
    source_type: sourceType,
    confidence: ocr.confidence,
    raw_text: ocr.text,
  };
    }
