import Tesseract from "tesseract.js";
import type { OCRResult, OCRWord } from "./types";

let workerPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      logger: () => {
        // OCR progress can be wired to UI later.
      },
    });
  }

  return workerPromise;
}

export async function runBrowserOCR(
  source: File | Blob | string,
): Promise<OCRResult> {
  const worker = await getWorker();
  const result = await worker.recognize(source);

  const words: OCRWord[] =
    result.data.words?.map((word: any) => ({
      text: String(word.text ?? "").trim(),
      confidence:
        typeof word.confidence === "number" ? word.confidence : undefined,
      left: word.bbox?.x0,
      top: word.bbox?.y0,
      width:
        typeof word.bbox?.x1 === "number" &&
        typeof word.bbox?.x0 === "number"
          ? word.bbox.x1 - word.bbox.x0
          : undefined,
      height:
        typeof word.bbox?.y1 === "number" &&
        typeof word.bbox?.y0 === "number"
          ? word.bbox.y1 - word.bbox.y0
          : undefined,
    })) ?? [];

  const confidenceValues = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === "number");

  const confidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) /
      confidenceValues.length
    : 0;

  return {
    text: String(result.data.text ?? ""),
    words,
    confidence,
    width: Number((result.data as any).image?.width ?? 0),
    height: Number((result.data as any).image?.height ?? 0),
  };
}

export async function terminateBrowserOCR(): Promise<void> {
  if (!workerPromise) return;

  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
