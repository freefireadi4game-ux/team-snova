import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignedUrl } from "@/lib/storage";
import { listPoiImages, type Poi } from "@/lib/tactical";
import type { Player } from "@/lib/data";
import { TacticalBoard } from "./TacticalBoard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PoiPanel({
  poi,
  players,
  onClose,
}: {
  poi: Poi;
  players: Player[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const images = useQuery({ queryKey: ["poi-images", poi.id], queryFn: () => listPoiImages(poi.id) });
  const list = images.data ?? [];
  const current = list[index] ?? null;
  const url = useSignedUrl("tournament-media", current?.image_url);
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => setIndex(0), [poi.id]);

  useEffect(() => {
    if (!url.data) return;
    const img = new Image();
    img.onload = () => setAspect(img.naturalWidth / Math.max(1, img.naturalHeight));
    img.src = url.data;
  }, [url.data]);

  const go = (d: number) => setIndex((i) => Math.min(list.length - 1, Math.max(0, i + d)));

  const touch = { x: 0 };
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      touch.x = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touch.x;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl p-3 pb-24">
        <div
          className="glass rounded-2xl p-3 mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
          {...swipe}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon">{poi.category}</div>
            <h2 className="truncate font-display text-xl">{poi.name}</h2>
            {poi.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{poi.description}</p>
            )}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {list.length > 0 && (
          <div className="glass rounded-2xl p-2 mb-2 flex items-center gap-2" {...swipe}>
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => go(-1)} aria-label="Previous view">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0 text-center">
              <div className="truncate text-sm font-bold">{current?.title || `View ${index + 1}`}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                View {index + 1} / {list.length}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              disabled={index >= list.length - 1}
              onClick={() => go(1)}
              aria-label="Next view"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {current ? (
          <>
            <TacticalBoard
              key={current.id}
              scope={{ scope: "poi_image", poiImageId: current.id }}
              imageUrl={url.data ?? null}
              aspect={aspect}
              players={players}
              compact
            />
            {list.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                {list.map((im, i) => (
                  <button
                    key={im.id}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-semibold",
                      i === index ? "border-neon text-neon" : "border-white/10 text-muted-foreground",
                    )}
                  >
                    {im.title || `View ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            {images.isLoading ? "Loading views…" : "No drone views uploaded for this location yet."}
          </div>
        )}
      </div>
    </div>
  );
}
