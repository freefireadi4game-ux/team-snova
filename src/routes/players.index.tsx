import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlayers } from "@/lib/data";

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "Roster — Team SNOVA ESP" },
      { name: "description", content: "Meet the Team SNOVA ESP roster." },
    ],
  }),
  component: Players,
});

function Players() {
  const { data, isLoading } = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const active = data?.filter((p) => p.status === "active") ?? [];
  const inactive = data?.filter((p) => p.status === "inactive") ?? [];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black gradient-text">Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">The squad that plays for the badge.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <h2 className="text-xs uppercase tracking-[0.2em] text-neon mb-3">Active</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {active.map((p) => (
              <Link
                key={p.id}
                to="/players/$id"
                params={{ id: p.id }}
                className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-transform group"
              >
                <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={80} className="mx-auto glow" />
                <div className="mt-4 text-center">
                  <div className="font-bold text-lg truncate">{p.ign}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {p.role}
                  </div>
                  {p.uid && (
                    <div className="mt-2 text-[10px] text-muted-foreground truncate">UID: {p.uid}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-10 mb-3">
                Inactive
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-60">
                {inactive.map((p) => (
                  <Link
                    key={p.id}
                    to="/players/$id"
                    params={{ id: p.id }}
                    className="glass rounded-2xl p-5"
                  >
                    <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={64} className="mx-auto" />
                    <div className="mt-3 text-center">
                      <div className="font-bold truncate">{p.ign}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {p.role}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {!data?.length && (
            <div className="text-center text-sm text-muted-foreground py-16">
              No players yet.
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
