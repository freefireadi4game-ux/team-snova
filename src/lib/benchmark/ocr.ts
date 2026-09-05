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

type OCRPass = {
  text: string;
  words: OCRWord[];
  confidence: number;
  width: number;
  height: number;
};

async function loadImage(
  source: File | Blob | string,
): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";

  const objectUrl =
    typeof source === "string" ? null : URL.createObjectURL(source);

  image.src = objectUrl ?? (source as string);

  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load screenshot."));
    });
  }

  if (objectUrl) URL.revokeObjectURL(objectUrl);

  return image;
}

type Preprocess = "upscaled" | "threshold-light" | "threshold-dark";

/**
 * Game HUD text is thin, small and sits on busy backgrounds. Upscaling with a
 * grayscale/threshold pass massively improves Tesseract's hit rate.
 */
function drawPreprocessed(
  image: HTMLImageElement,
  mode: Preprocess,
): HTMLCanvasElement {
  const targetWidth = 2400;

  const scale = Math.min(
    3,
    Math.max(1.6, targetWidth / Math.max(image.naturalWidth, 1)),
  );

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Your browser could not prepare the screenshot.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    let value: number;

    if (mode === "upscaled") {
      const centered = (gray - 128) * 1.35 + 128;
      value = Math.max(0, Math.min(255, centered));
    } else if (mode === "threshold-light") {
      // White HUD text on darker background.
      value = gray > 140 ? 255 : 0;
    } else {
      // Same threshold, inverted: dark glyphs on light background.
      value = gray > 140 ? 0 : 255;
    }

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

async function recognize(
  worker: Tesseract.Worker,
  source: File | Blob | HTMLCanvasElement,
  pageSegMode: string,
): Promise<OCRPass> {
  await worker.setParameters({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tessedit_pageseg_mode: pageSegMode as any,
  });

  const result = await worker.recognize(source);

  const words: OCRWord[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result.data.words as any[] | undefined)?.map((word: any) => ({
      text: String(word.text ?? "").trim(),
      confidence:
        typeof word.confidence === "number" ? word.confidence : undefined,
      left: word.bbox?.x0,
      top: word.bbox?.y0,
      width:
        typeof word.bbox?.x1 === "number" && typeof word.bbox?.x0 === "number"
          ? word.bbox.x1 - word.bbox.x0
          : undefined,
      height:
        typeof word.bbox?.y1 === "number" && typeof word.bbox?.y0 === "number"
          ? word.bbox.y1 - word.bbox.y0
          : undefined,
    })) ?? [];

  const confidenceValues = words
    .map((word) => word.confidence)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

  const confidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) /
      confidenceValues.length
    : Number(result.data.confidence ?? 0);

  return {
    text: String(result.data.text ?? ""),
    words,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    width: 0,
    height: 0,
  };
}

/**
 * PSM 11 (sparse text) is by far the best mode for scattered HUD numbers,
 * PSM 6 (uniform block) recovers table rows and decimal points. Both are run
 * over two preprocessed variants and the parser merges the readings.
 */
export async function runBrowserOCR(
  source: File | Blob | string,
): Promise<OCRResult> {
  if (typeof window === "undefined") {
    throw new Error("Browser OCR is only available on the client.");
  }

  const worker = await getWorker();
  const image = await loadImage(source);

  const upscaled = drawPreprocessed(image, "upscaled");
  const light = drawPreprocessed(image, "threshold-light");
  const dark = drawPreprocessed(image, "threshold-dark");

  const plan: { canvas: HTMLCanvasElement; psm: string }[] = [
    { canvas: upscaled, psm: "11" },
    { canvas: upscaled, psm: "6" },
    { canvas: light, psm: "11" },
    { canvas: light, psm: "6" },
    { canvas: dark, psm: "11" },
  ];

  const passes: OCRPass[] = [];

  for (const step of plan) {
    try {
      passes.push(await recognize(worker, step.canvas, step.psm));
    } catch (error) {
      console.warn("[benchmark OCR] pass failed", step.psm, error);
    }
  }

  if (!passes.length) {
    throw new Error(
      "OCR could not read this screenshot. Please try a clearer screenshot.",
    );
  }

  const best = passes
    .slice()
    .sort(
      (a, b) =>
        b.words.length * 2 +
        b.confidence / 10 -
        (a.words.length * 2 + a.confidence / 10),
    )[0];

  return {
    text: best.text,
    texts: passes.map((pass) => pass.text),
    words: best.words,
    confidence: Math.max(...passes.map((pass) => pass.confidence), 0),
    width: image.naturalWidth || 0,
    height: image.naturalHeight || 0,
  };
}

export async function terminateBrowserOCR(): Promise<void> {
  if (!workerPromise) return;

  const worker = await workerPromise;
  await worker.terminate();

  workerPromise = null;
}
