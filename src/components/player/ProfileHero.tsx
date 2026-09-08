import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Swords, Target, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Player, Tournament } from "@/lib/data";
import { didPlay } from "@/lib/data";
import type { StatEntry } from "@/lib/stats-core";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* COUNT-UP (Discord-style number roll)                                       */
/* -------------------------------------------------------------------------- */

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

function formatValue(value: number, decimals: number) {
  return decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toLocaleString();
}

/* -------------------------------------------------------------------------- */
/* STAT CARD                                                                  */
/* -------------------------------------------------------------------------- */

function HeroStat({
  label,
  value,
  decimals = 0,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  decimals?: number;
  icon: typeof Swords;
  delay: number;
}) {
  const animated = useCountUp(value);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-neon/40"
      style={{
        animation: `fade-in 0.5s ease-out ${delay}ms both`,
      }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-neon/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-40" />

      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-neon-soft text-neon transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-3.5 w-3.5" />
        </span>

        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="mt-2 font-display text-2xl tabular-nums gradient-text">
        {formatValue(animated, decimals)}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HERO                                                                       */
/* -------------------------------------------------------------------------- */

export function ProfileHero({
  player,
  entries,
  tournaments,
  badge,
  className,
}: {
  player: Player;
  entries: StatEntry[];
  tournaments: Tournament[];
  /** Optional right-aligned slot (e.g. task progress pill). */
  badge?: React.ReactNode;
  className?: string;
}) {
  const stats = useMemo(() => {
    const mine = entries.filter(
      (entry) => entry.player_id === player.id && didPlay(entry),
    );

    const kills = mine.reduce((sum, entry) => sum + entry.kills, 0);

    const tournamentIds = new Set(mine.map((entry) => entry.tournament_id));

    const mvps = tournaments.filter(
      (tournament) => tournament.mvp_player_id === player.id,
    ).length;

    return {
      kills,
      mvps,
      tournamentsPlayed: tournamentIds.size,
      killsPerTournament: tournamentIds.size
        ? kills / tournamentIds.size
        : 0,
    };
  }, [entries, tournaments, player.id]);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-surface/60 p-5",
        className,
      )}
    >
      {/* animated aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-neon/20 blur-3xl a-float" />
        <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl a-float-slow" />
      </div>

      <div className="relative flex flex-wrap items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-neon/30 blur-xl a-pulse-soft" />

          <PlayerAvatar
            photoPath={player.photo_url}
            name={player.ign}
            size={72}
            className="relative ring-2 ring-neon/40"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Player Profile
          </div>

          <h1 className="a-slide-blur truncate font-display text-3xl gradient-text">
            {player.ign}
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            <span className="rounded-full bg-neon-soft px-2 py-0.5 text-neon">
              {player.role}
            </span>

            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-muted-foreground">
              Since {player.join_date}
            </span>
          </div>
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeroStat
          label="Career Kills"
          value={stats.kills}
          icon={Swords}
          delay={60}
        />

        <HeroStat
          label="MVP Awards"
          value={stats.mvps}
          icon={Crown}
          delay={140}
        />

        <HeroStat
          label="Kills / Tournament"
          value={stats.killsPerTournament}
          decimals={1}
          icon={Target}
          delay={220}
        />

        <HeroStat
          label="Tournaments"
          value={stats.tournamentsPlayed}
          icon={Trophy}
          delay={300}
        />
      </div>
    </section>
  );
}
