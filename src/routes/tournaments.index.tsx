import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { listTournaments } from "@/lib/data";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Tournaments — Team SNOVA ESP" },
      { name: "description", content: "Full tournament history for Team SNOVA ESP." },
    ],
  }),
  component: Tournaments,
});

function Tournaments() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: listTournaments,
  });

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black gradient-text">Tournaments</h1>
        <p className="text-sm text-muted-foreground mt-1">Every event we've stepped into.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-transform group relative overflow-hidden"
            >
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-neon-soft blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${
                      t.status === "completed"
                        ? "bg-neon-soft text-neon"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {t.status}
                  </span>
                  <Trophy className="h-4 w-4 text-neon" />
                </div>
                <div className="font-bold text-lg truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate mt-1">
                  {t.organizer ?? "—"} · {new Date(t.date).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t.num_matches} matches</div>
              </div>
            </Link>
          ))}
          {!data?.length && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-16">
              No tournaments yet.
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
