import { useRef, useState } from "react";
import { ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  evaluateBenchmark,
  parseBenchmarkOCR,
  runBrowserOCR,
  type Benchmark,
  type BenchmarkEvaluation,
} from "@/lib/benchmark";

type Props = {
  benchmark: Benchmark;
  onComplete?: (evaluation: BenchmarkEvaluation) => void;
};

export function BenchmarkUploader({
  benchmark,
  onComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [evaluation, setEvaluation] =
    useState<BenchmarkEvaluation | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const processImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large. Maximum size is 15 MB.");
      return;
    }

    setScanning(true);
    setEvaluation(null);

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const ocrResult = await runBrowserOCR(file);

      if (!ocrResult.text.trim()) {
        toast.error("No readable text found in the screenshot.");
        return;
      }

      const stats = parseBenchmarkOCR(
        ocrResult,
        benchmark.source_type,
      );

      const result = evaluateBenchmark(
        benchmark.requirements,
        stats,
      );

      setEvaluation(result);

      if (result.status === "pass") {
        toast.success("Benchmark completed!");
      } else if (result.status === "fail") {
        toast.error("Benchmark requirements not completed.");
      } else {
        toast.warning(
          "Some values could not be read. Manual review is required.",
        );
      }

      onComplete?.(result);
    } catch (error: any) {
      console.error("[benchmark OCR]", error);

      toast.error(
        error?.message ??
          "Could not read the screenshot. Please try again.",
      );
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setEvaluation(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void processImage(file);
          }
        }}
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={scanning}
          className="w-full rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center transition-colors hover:border-neon/50 hover:bg-white/[0.03]"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-neon-soft text-neon">
            <ImageUp className="h-6 w-6" />
          </div>

          <div className="mt-3 font-semibold">
            Upload benchmark screenshot
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            OCR runs directly in your browser.
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-black/20">
            <img
              src={previewUrl}
              alt="Benchmark evidence"
              className="max-h-[420px] w-full object-contain"
            />
          </div>

          {scanning && (
            <div className="flex items-center gap-2 rounded-xl bg-neon-soft px-4 py-3 text-sm text-neon">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading screenshot…
            </div>
          )}

          {!scanning && !evaluation && (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = "";
                  inputRef.current.click();
                }
              }}
            >
              Try another screenshot
            </Button>
          )}

          {!scanning && evaluation && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={reset}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Submit another screenshot
            </Button>
          )}
        </div>
      )}

      {evaluation && (
        <div
          className={`rounded-2xl border p-4 ${
            evaluation.status === "pass"
              ? "border-neon/40 bg-neon-soft/20"
              : evaluation.status === "fail"
                ? "border-destructive/30 bg-destructive/5"
                : "border-yellow-500/30 bg-yellow-500/5"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="font-bold">
              {evaluation.status === "pass"
                ? "Benchmark Completed"
                : evaluation.status === "fail"
                  ? "Benchmark Not Completed"
                  : "Needs Review"}
            </div>

            <div className="text-xs text-muted-foreground">
              {evaluation.passed_count}/
              {evaluation.total_required}
            </div>
          </div>

          <div className="grid gap-2">
            {evaluation.checks.map((check, index) => (
              <div
                key={`${check.requirement.label}-${index}`}
                className="rounded-xl bg-white/[0.03] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    {check.requirement.label}
                  </span>

                  <span
                    className={
                      check.passed
                        ? "text-xs font-bold text-neon"
                        : check.evaluable
                          ? "text-xs font-bold text-destructive"
                          : "text-xs font-bold text-yellow-400"
                    }
                  >
                    {check.passed
                      ? "PASS"
                      : check.evaluable
                        ? "FAIL"
                        : "REVIEW"}
                  </span>
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {check.message}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-muted-foreground">
            OCR confidence: {evaluation.extracted.confidence.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
  }
