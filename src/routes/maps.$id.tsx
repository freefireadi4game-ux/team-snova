import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useSignedUrl } from "@/lib/storage";
import { listPlayers } from "@/lib/data";
import { listPois, type Poi, type Pt } from "@/lib/tactical";
import { TacticalBoard } from "@/components/tactical/TacticalBoard";
import { PoiPanel } from "@/components/tactical/PoiPanel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/maps/$id")({
  head: () => ({
    meta: [
      { title: "Tactical Board — SNOVA ESP" },
      { name: "description", content: "Interactive tactical map: player rotations, zones and drone views." },
    ],
  }),
  component: MapBoard,
});

function MapBoard() {
  const { id } = Route.useParams();
  const [openPoi, setOpenPoi] = useState<Poi | null>(null);

  const map = useQuery({
    queryKey: ["map", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("maps").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const url = useSignedUrl("tournament-media", map.data?.image_url ?? null);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const active = (players.data ?? []).filter((p) => p.status === "active").slice(0, 5);

  const pois = useQuery({ queryKey: ["pois", id], queryFn: () => listPois(id) });

  const legacy = useQuery({
    queryKey: ["map-paths", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("map_paths")
        .select("*")
        .eq("map_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; color: string; points: Pt[] }[];
    },
  });

  return (
    <Layout>
      <Link to="/maps" className="text-xs text-muted-foreground hover:text-neon inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to maps
      </Link>
      <div className="mt-2 mb-3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-neon">Tactical workspace</div>
        <h1 className="font-display text-2xl md:text-3xl">{map.data?.name ?? "Map"}</h1>
      </div>

      <TacticalBoard
        scope={{ scope: "map", mapId: id }}
        imageUrl={url.data ?? null}
        aspect={1}
        players={active}
        pois={pois.data ?? []}
        onPoiTap={setOpenPoi}
        legacyPaths={legacy.data ?? []}
      />

      {!!pois.data?.length && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
            Important locations
          </div>
          <div className="flex flex-wrap gap-2">
            {pois.data.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenPoi(p)}
                className="glass rounded-xl px-3 py-1.5 text-xs font-semibold hover:text-neon"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {openPoi && <PoiPanel poi={openPoi} players={active} onClose={() => setOpenPoi(null)} />}
    </Layout>
  );
}
