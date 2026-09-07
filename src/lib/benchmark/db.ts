import { supabase } from "@/integrations/supabase/client";
import type {
  Benchmark,
  BenchmarkFrequency,
  BenchmarkEvaluation,
  BenchmarkMetric,
  BenchmarkOperator,
  BenchmarkRequirement,
  BenchmarkSourceType,
  BenchmarkStatus,
  PlayerRole,
} from "./types";

export type BenchmarkSubmission = {
  id: string;
  benchmark_id: string;
  player_id: string;
  status: string;
  ocr_confidence: number | null;
  submitted_at: string;
};

/** Fetch all benchmarks with their requirements. */
export async function listBenchmarksFromDb(): Promise<Benchmark[]> {
  const [{ data: rows, error }, { data: reqs, error: reqError }] =
    await Promise.all([
      supabase.from("benchmarks").select("*").order("created_at"),
      supabase.from("benchmark_requirements").select("*").order("created_at"),
    ]);

  if (error) throw error;
  if (reqError) throw reqError;

  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    source_type: row.source_type as BenchmarkSourceType,
    status: row.status as BenchmarkStatus,
    role: row.role as PlayerRole | "all",
    created_at: row.created_at,
    updated_at: row.updated_at,
    frequency: (row.frequency ?? "once") as BenchmarkFrequency,
    scheduled_date: row.scheduled_date ?? null,
    scheduled_day: row.scheduled_day ?? null,
    scheduled_time: row.scheduled_time ?? null,
    is_active: row.is_active ?? true,
    requirements: (reqs ?? [])
      .filter((r) => r.benchmark_id === row.id)
      .map(
        (r): BenchmarkRequirement => ({
          id: r.id,
          benchmark_id: r.benchmark_id,
          label: r.label,
          metric: r.metric as BenchmarkMetric,
          operator: r.operator as BenchmarkOperator,
          target_value: Number(r.target_value),
          source_type: (r.source_type ?? undefined) as
            | BenchmarkSourceType
            | undefined,
          required: r.required,
        }),
      ),
  }));
}

export async function getBenchmarkFromDb(
  id: string,
): Promise<Benchmark | null> {
  const all = await listBenchmarksFromDb();
  return all.find((b) => b.id === id) ?? null;
}

/** All submissions for one player (used to tick completed tasks). */
export async function listMySubmissions(
  playerId: string,
): Promise<BenchmarkSubmission[]> {
  const { data, error } = await supabase
    .from("benchmark_submissions")
    .select("id, benchmark_id, player_id, status, ocr_confidence, submitted_at")
    .eq("player_id", playerId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BenchmarkSubmission[];
}

/** Persist an OCR evaluation so the task gets ticked for this player. */
export async function saveSubmission(
  playerId: string,
  benchmark: Benchmark,
  evaluation: BenchmarkEvaluation,
): Promise<void> {
  const { data: submission, error } = await supabase
    .from("benchmark_submissions")
    .insert({
      benchmark_id: benchmark.id,
      player_id: playerId,
      status: evaluation.status,
      ocr_confidence: Math.round(evaluation.extracted.confidence),
      raw_text: evaluation.extracted.raw_text.slice(0, 8000),
    })
    .select("id")
    .single();

  if (error) throw error;

  const rows = evaluation.checks
    .filter((check) => check.requirement.id)
    .map((check) => ({
      submission_id: submission.id,
      requirement_id: check.requirement.id as string,
      actual_value: check.actual_value,
      expected_value: check.requirement.target_value,
      passed: check.passed,
      evaluable: check.evaluable,
      message: check.message,
    }));

  if (rows.length) {
    const { error: resultError } = await supabase
      .from("benchmark_results")
      .insert(rows);
    if (resultError) throw resultError;
  }
}

/* -------------------------------------------------------------------------- */
/* REPEAT / RESET LOGIC                                                       */
/* -------------------------------------------------------------------------- */

export function frequencyLabel(frequency: BenchmarkFrequency | undefined) {
  switch (frequency) {
    case "daily":
      return "Repeats daily";
    case "weekly":
      return "Repeats weekly";
    case "monthly":
      return "Repeats monthly";
    default:
      return "One-time task";
  }
}

/** Start of the current repeat window (local time). */
export function periodStart(frequency: BenchmarkFrequency | undefined): Date {
  const now = new Date();

  if (frequency === "daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (frequency === "weekly") {
    const day = now.getDay();
    // Week starts on Monday.
    const offset = (day + 6) % 7;
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset,
    );
  }

  if (frequency === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(0);
}

export function periodResetLabel(frequency: BenchmarkFrequency | undefined) {
  switch (frequency) {
    case "daily":
      return "today";
    case "weekly":
      return "this week";
    case "monthly":
      return "this month";
    default:
      return "";
  }
}

/** Submissions that fall inside the current repeat window of a benchmark. */
export function submissionsInPeriod(
  submissions: BenchmarkSubmission[],
  benchmark: Pick<Benchmark, "id" | "frequency">,
): BenchmarkSubmission[] {
  const start = periodStart(benchmark.frequency).getTime();

  return submissions.filter(
    (submission) =>
      submission.benchmark_id === benchmark.id &&
      new Date(submission.submitted_at).getTime() >= start,
  );
}

/** True when the task is already passed inside its current repeat window. */
export function isCompletedForPeriod(
  submissions: BenchmarkSubmission[],
  benchmark: Pick<Benchmark, "id" | "frequency">,
): boolean {
  return submissionsInPeriod(submissions, benchmark).some(
    (submission) => submission.status === "pass",
  );
}
