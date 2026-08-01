import { Lock, Sparkles } from "lucide-react";
import {
  RARITY_STYLE,
  type EarnedAchievement,
  type Prestige,
} from "@/lib/achievements";
import { cn } from "@/lib/utils";

export function AchievementBadge({
  a,
  index = 0,
}: {
  a: EarnedAchievement;
  index?: number;
}) {
  const style = RARITY_STYLE[a.rarity];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-3 animate-rise",
        a.unlocked ? style.badge : "border-white/5 bg-white/[0.015] text-muted-foreground",
        a.unlocked && (a.rarity === "mythic" || a.rarity === "legendary") && "shimmer",
      )}
      style={{ animationDelay: `${Math.min(index, 24) * 28}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[9px] uppercase tracking-[0.22em] opacity-80">{style.label}</div>
        {a.unlocked ? (
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Lock className="h-3 w-3 shrink-0 opacity-50" />
        )}
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-tight text-foreground/95">{a.name}</div>
      <div className="mt-0.5 text-[10px] leading-snug opacity-70">{a.description}</div>
      {!a.unlocked && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-neon/60 transition-[width] duration-700"
            style={{ width: `${Math.round(a.progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

const PRESTIGE_AURA: Record<Prestige, string> = {
  none: "",
  bronze: "aura aura-bronze",
  silver: "aura aura-silver",
  gold: "aura aura-gold",
  elite: "aura aura-elite",
};

export function prestigeAuraClass(p: Prestige) {
  return PRESTIGE_AURA[p];
}
