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

function canvasToBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("Could not prepare image for OCR."),
          );
        }
      },
      "image/png",
      1,
    );
  });
}

async function loadImage(
  source: File | Blob | string,
): Promise<HTMLImageElement> {
  const image = new Image();

  image.decoding = "async";

  if (typeof source === "string") {
    image.src = source;
  } else {
    image.src = URL.createObjectURL(source);
  }

  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error("Could not load screenshot."),
        );
    });
  }

  if (typeof source !== "string") {
    URL.revokeObjectURL(image.src);
  }

  return image;
}

function drawPreprocessed(
  image: HTMLImageElement,
  mode: "enhanced" | "high-contrast",
): HTMLCanvasElement {
  const maxWidth = 2600;

  const scale = Math.min(
    4,
    Math.max(
      1.5,
      maxWidth / Math.max(image.naturalWidth, 1),
    ),
  );

  const width = Math.max(
    1,
    Math.round(image.naturalWidth * scale),
  );

  const height = Math.max(
    1,
    Math.round(image.naturalHeight * scale),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error(
      "Your browser could not prepare the screenshot.",
    );
  }

  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(
    0,
    0,
    width,
    height,
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Perceived luminance.
    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    if (mode === "enhanced") {
      // Stronger contrast while preserving enough grey detail
      // for small HUD text.
      const contrast = 1.65;
      const centered =
        (gray - 128) * contrast + 128;

      const value = Math.max(
        0,
        Math.min(255, centered),
      );

      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    } else {
      // High contrast threshold for small white UI text.
      const value = gray > 145 ? 255 : 0;

      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

function chooseBetterPass(
  passes: OCRPass[],
): OCRPass {
  return passes
    .slice()
    .sort((a, b) => {
      const aUseful =
        a.words.length * 2 +
        Math.min(a.text.length, 3000) / 100 +
        a.confidence / 10;

      const bUseful =
        b.words.length * 2 +
        Math.min(b.text.length, 3000) / 100 +
        b.confidence / 10;

      return bUseful - aUseful;
    })[0];
}

async function recognize(
  worker: Tesseract.Worker,
  source: File | Blob | HTMLCanvasElement,
): Promise<OCRPass> {
  const result = await worker.recognize(source);

  const words: OCRWord[] =
    result.data.words?.map((word: any) => ({
      text: String(word.text ?? "").trim(),

      confidence:
        typeof word.confidence === "number"
          ? word.confidence
          : undefined,

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
    .filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value),
    );

  const confidence = confidenceValues.length
    ? confidenceValues.reduce(
        (sum, value) => sum + value,
        0,
      ) / confidenceValues.length
    : Number(result.data.confidence ?? 0);

  return {
    text: String(result.data.text ?? ""),
    words,
    confidence: Number.isFinite(confidence)
      ? confidence
      : 0,
    width: Number(
      (result.data as any).image?.width ?? 0,
    ),
    height: Number(
      (result.data as any).image?.height ?? 0,
    ),
  };
}

export async function runBrowserOCR(
  source: File | Blob | string,
): Promise<OCRResult> {
  if (typeof window === "undefined") {
    throw new Error(
      "Browser OCR is only available on the client.",
    );
  }

  const worker = await getWorker();
  const image = await loadImage(source);

  const passes: OCRPass[] = [];

  // Pass 1: Original screenshot.
  try {
    const original = await recognize(
      worker,
      source instanceof File || source instanceof Blob
        ? source
        : image,
    );

    passes.push(original);
  } catch (error) {
    console.warn(
      "[benchmark OCR] original pass failed",
      error,
    );
  }

  // Pass 2: Upscaled + enhanced grayscale.
  try {
    const enhancedCanvas = drawPreprocessed(
      image,
      "enhanced",
    );

    const enhanced = await recognize(
      worker,
      enhancedCanvas,
    );

    passes.push(enhanced);
  } catch (error) {
    console.warn(
      "[benchmark OCR] enhanced pass failed",
      error,
    );
  }

  // Pass 3: Strong black/white threshold.
  try {
    const highContrastCanvas = drawPreprocessed(
      image,
      "high-contrast",
    );

    const highContrast = await recognize(
      worker,
      highContrastCanvas,
    );

    passes.push(highContrast);
  } catch (error) {
    console.warn(
      "[benchmark OCR] high-contrast pass failed",
      error,
    );
  }

  if (!passes.length) {
    throw new Error(
      "OCR could not read this screenshot. Please try a clearer screenshot.",
    );
  }

  const best = chooseBetterPass(passes);

  return {
    text: best.text,
    words: best.words,
    confidence: best.confidence,
    width:
      best.width ||
      image.naturalWidth ||
      0,
    height:
      best.height ||
      image.naturalHeight ||
      0,
  };
}

export async function terminateBrowserOCR(): Promise<void> {
  if (!workerPromise) return;

  const worker = await workerPromise;
  await worker.terminate();

  workerPromise = null;
}
