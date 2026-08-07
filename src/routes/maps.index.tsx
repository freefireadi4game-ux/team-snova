import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { TournamentImage } from "@/components/PlayerAvatar";
import { Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/maps/")({
  head: () => ({ meta: [{ title: "Maps — SNOVA ESP" }] }),
  component: MapsList,
});

function MapsList() {
  const maps = useQuery({
    queryKey: ["maps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maps").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl gradient-text">Maps</h1>
        <p className="text-sm text-muted-foreground mt-1">Rotation planning boards. Draw paths, discuss with the team.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {maps.data?.map((m: any) => (
          <Link
            key={m.id}
            to="/maps/$id"
            params={{ id: m.id }}
            className="glass rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform"
          >
            <TournamentImage path={m.image_url} alt={m.name} className="w-full h-40 object-cover" />
            <div className="p-3">
              <div className="font-bold truncate">{m.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 mt-1">
                <MapIcon className="h-3 w-3" /> Rotation board
              </div>
            </div>
          </Link>
        ))}
        {!maps.data?.length && !maps.isLoading && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-16">
            No maps yet. Admin can upload maps from the admin panel.
          </div>
        )}
      </div>
    </Layout>
  );
}
