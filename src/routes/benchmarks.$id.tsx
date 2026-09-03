import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, Target } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { BenchmarkUploader } from "@/components/benchmark/BenchmarkUploader";
import { getAuthenticatedPlayer } from "@/lib/benchmark/player";
import {
  getBenchmarkFromDb,
  listMySubmissions,
  saveSubmission,
} from "@/lib/benchmark/db";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/benchmarks/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Task Details — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Task requirements and screenshot verification for Team SNOVA ESP players.",
      },
      { property: "og:title", content: "Task Details — Team SNOVA ESP" },
      {
        property: "og:description",
        content: "Requirements and screenshot verification for this task.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BenchmarkDetailPage,
});

function BenchmarkDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useSession();

  const benchmark = useQuery({
    queryKey: ["benchmark-db", id],
    queryFn: () => getBenchmarkFromDb(id),
  });

  const player = useQuery({
    queryKey: ["authenticated-player", session?.user.id ?? null],
    queryFn: getAuthenticatedPlayer,
    enabled: !!session,
  });

  const submissions = useQuery({
    queryKey: ["my-submissions", player.data?.id],
    queryFn: () => listMySubmissions(player.data!.id),
    enabled: !!player.data?.id,
  });

  const completed = (submissions.data ?? []).some(
    (s) => s.benchmark_id === id && s.status === "pass",
  );

  if (benchmark.isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!benchmark.data) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <div className="font-semibold">Task not found</div>
          <Link to="/benchmarks" className="mt-3 inline-block text-xs text-neon">
            Back to tasks
          </Link>
        </div>
      </Layout>
    );
  }

  const data = benchmark.data;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/benchmarks" })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <section className="glass rounded-2xl p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neon-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
              {data.role === "all" ? "All Roles" : data.role}
            </span>

            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {data.source_type.replace("_", " ")}
            </span>

            {completed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
                <CheckCircle2 className="h-3 w-3" />
                Completed
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl md:text-4xl">{data.name}</h1>

          {data.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-5 md:p-7">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-neon" />
            <h2 className="font-bold">Requirements</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {data.requirements.map((requirement, index) => (
              <div
                key={requirement.id ?? `${data.id}-${index}`}
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
                    {(requirement.source_type ?? data.source_type).replace(
                      "_",
                      " ",
                    )}
                  </div>
                </div>

                <div className="text-sm font-black text-neon tabular-nums">
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

          {!player.data ? (
            <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-xs text-yellow-300">
              Link your Google account to a roster player to submit evidence.
              <Link
                to="/player-login"
                className="ml-2 font-semibold text-neon underline"
              >
                Player sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload the original screenshot. OCR runs on your device and the
                task is ticked automatically when every requirement passes.
              </p>

              <div className="mt-5">
                <BenchmarkUploader
                  benchmark={data}
                  onComplete={async (evaluation) => {
                    try {
                      await saveSubmission(player.data!.id, data, evaluation);
                      await qc.invalidateQueries({
                        queryKey: ["my-submissions", player.data!.id],
                      });
                    } catch (error: any) {
                      toast.error(
                        error?.message ?? "Could not save your submission",
                      );
                    }
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
