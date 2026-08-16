import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Target, XCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { BenchmarkUploader } from "@/components/benchmark/BenchmarkUploader";
import { BENCHMARKS } from "@/data/benchmarks";
import type { BenchmarkEvaluation } from "@/lib/benchmark";

export const Route = createFileRoute("/_authenticated/benchmarks/$id")({
  component: BenchmarkDetailPage,
});

function BenchmarkDetailPage() {
  const { id } = Route.useParams();

  const benchmark = BENCHMARKS.find((item) => item.id === id);

  if (!benchmark) {
    throw notFound();
  }

  const [evaluation, setEvaluation] =
    useState<BenchmarkEvaluation | null>(null);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neon-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
              {benchmark.role === "all"
                ? "All Roles"
                : benchmark.role}
            </span>

            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {benchmark.source_type.replace("_", " ")}
            </span>

            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Screenshot Verification
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl md:text-5xl">
            {benchmark.name}
          </h1>

          {benchmark.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {benchmark.description}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 md:p-7">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-neon" />
            <h2 className="font-bold">Requirements</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {benchmark.requirements.map((requirement, index) => (
              <div
                key={requirement.id ?? `${benchmark.id}-${index}`}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neon-soft text-neon">
                  <Target className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {requirement.label}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {requirement.source_type?.replace("_", " ") ??
                      benchmark.source_type.replace("_", " ")}
                  </div>
                </div>

                <div className="text-sm font-black text-neon">
                  {requirement.operator} {requirement.target_value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 md:p-7">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-neon" />
            <h2 className="font-bold">Submit Evidence</h2>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Upload the original screenshot. The benchmark checker will read
            the values directly in your browser.
          </p>

          <div className="mt-5">
            <BenchmarkUploader
              benchmark={benchmark}
              onComplete={setEvaluation}
            />
          </div>
        </section>

        {evaluation && (
          <section
            className={`rounded-2xl border p-5 md:p-7 ${
              evaluation.status === "pass"
                ? "border-neon/40 bg-neon-soft/10"
                : evaluation.status === "fail"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-yellow-500/30 bg-yellow-500/5"
            }`}
          >
            <div className="flex items-center gap-3">
              {evaluation.status === "pass" ? (
                <CheckCircle2 className="h-6 w-6 text-neon" />
              ) : evaluation.status === "fail" ? (
                <XCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Clock3 className="h-6 w-6 text-yellow-400" />
              )}

              <div>
                <div className="font-bold">
                  {evaluation.status === "pass"
                    ? "Benchmark Completed"
                    : evaluation.status === "fail"
                      ? "Benchmark Failed"
                      : "Needs Review"}
                </div>

                <div className="text-xs text-muted-foreground">
                  {evaluation.passed_count} of{" "}
                  {evaluation.total_required} requirements passed
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {evaluation.checks.map((check, index) => (
                <div
                  key={`${check.requirement.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {check.requirement.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {check.message}
                    </div>
                  </div>

                  <div
                    className={
                      check.passed
                        ? "text-xs font-black text-neon"
                        : check.evaluable
                          ? "text-xs font-black text-destructive"
                          : "text-xs font-black text-yellow-400"
                    }
                  >
                    {check.passed
                      ? "PASS"
                      : check.evaluable
                        ? "FAIL"
                        : "REVIEW"}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEvaluation(null)}
              >
                Test Again
              </Button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
      }
