import { useSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  photoPath,
  name,
  size = 48,
  className,
}: {
  photoPath: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const { data: url } = useSignedUrl("player-photos", photoPath);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full grid place-items-center glass",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold gradient-text">{initials}</span>
      )}
    </div>
  );
}

export function TournamentImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const { data: url } = useSignedUrl("tournament-media", path);
  if (!url) return <div className={cn("bg-white/5 animate-pulse rounded-lg", className)} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
