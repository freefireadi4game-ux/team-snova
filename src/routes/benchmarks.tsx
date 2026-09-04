import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ImageUp,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { BenchmarkCard } from "@/components/benchmark/BenchmarkCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthenticatedPlayer } from "@/lib/benchmark/player";
import {
  listBenchmarksFromDb,
  listMySubmissions,
} from "@/lib/benchmark/db";
import type { PlayerRole } from "@/lib/benchmark";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/benchmarks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Benchmark Tasks — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Role-specific training tasks for Team SNOVA ESP players, verified from screenshots with on-device OCR.",
      },
      {
        property: "og:title",
        content: "Benchmark Tasks — Team SNOVA ESP",
      },
      {
        property: "og:description",
        content: "Complete drills and verify them with screenshot OCR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BenchmarksPage,
});

function BenchmarksPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  const player = useQuery({
    queryKey: ["authenticated-player", session?.user.id ?? null],
    queryFn: getAuthenticatedPlayer,
    enabled: !!session,
  });

  const benchmarks = useQuery({
    queryKey: ["benchmarks-db"],
    queryFn: listBenchmarksFromDb,
  });

  const submissions = useQuery({
    queryKey: ["my-submissions", player.data?.id],
    queryFn: () => listMySubmissions(player.data!.id),
    enabled: !!player.data?.id,
  });

  const passedIds = new Set(
    (submissions.data ?? [])
      .filter((s) => s.status === "pass")
      .map((s) => s.benchmark_id),
  );

  const role = (player.data?.role ?? "Other") as PlayerRole;

  const visible = (benchmarks.data ?? []).filter(
    (b) =>
      b.status === "active" &&
      (b.role === "all" || b.role === role),
  );

  const busy =
    loading ||
    benchmarks.isLoading ||
    player.isLoading;

  const openTask = (id: string) => {
    navigate({
      to: "/benchmarks/$id",
      params: { id },
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Player Development
          </div>

          <h1 className="mt-2 font-display text-4xl md:text-5xl gradient-text">
            My Tasks
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Complete your role drills and upload the screenshot — the checker
            reads the numbers and ticks the task automatically.
          </p>

          {player.data && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-neon-soft px-3 py-1.5 text-xs font-semibold text-neon">
              {player.data.ign} · {player.data.role} ·{" "}
              {passedIds.size}/{visible.length} done
            </div>
          )}
        </section>

        {busy ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-40 rounded-2xl"
              />
            ))}
          </div>
        ) : !session || !player.data ? (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
            <div className="flex items-start gap-2 text-sm text-yellow-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />

              <div>
                {!session
                  ? "Sign in as a player to see the tasks assigned to you."
                  : "This Google account is not linked to a roster player yet."}
              </div>
            </div>

            <Link
              to="/player-login"
              className="mt-4 inline-flex rounded-xl bg-neon-soft px-4 py-2 text-xs font-semibold text-neon"
            >
              Player sign in
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <div className="font-semibold">
              No active tasks
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Nothing is assigned to your role right now.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((benchmark) => {
              const completed = passedIds.has(benchmark.id);

              return (
                <div
                  key={benchmark.id}
                  className="space-y-2"
                >
                  <BenchmarkCard
                    benchmark={benchmark}
                    completed={completed}
                    onClick={() => openTask(benchmark.id)}
                  />

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openTask(benchmark.id);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-neon/30 bg-neon-soft/60 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-neon transition-all hover:bg-neon-soft hover:border-neon/50"
                  >
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <ImageUp className="h-4 w-4" />
                    )}

                    {completed
                      ? "View Completed Task"
                      : "Upload Screenshot"}
                  </button>

                  {!completed && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                      <Upload className="h-3 w-3" />
                      Opens OCR verification
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
