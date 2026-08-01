import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { AchievementBadge, prestigeAuraClass } from "@/components/AchievementBadge";
import { MonthFilter, PeriodToggle } from "@/components/PeriodControls";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlayers, listTournaments } from "@/lib/data";
import {
  OVERALL,
  aggregateByPlayer,
  availableMonths,
  currentMonthKey,
  filterByPeriod,
  listStatEntries,
  periodLabel,
  type Period,
} from "@/lib/stats-core";
import {
  ACHIEVEMENT_COUNT,
  PRESTIGE_LABEL,
  achievementScore,
  evaluateAchievements,
  prestigeOf,
  toMetrics,
} from "@/lib/achievements";
import { Medal, Sparkles } from "lucide-react";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Over 100 unlockable achievements for Team SNOVA ESP players, awarded automatically from every logged match.",
      },
      { property: "og:title", content: "Achievements — Team SNOVA ESP" },
      {
        property: "og:description",
        content: "100+ achievements earned from real match data by Team SNOVA ESP players.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const monthKey = currentMonthKey();
  const [period, setPeriod] = useState<Period>(OVERALL);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const entries = useQuery({ queryKey: ["stat-entries"], queryFn: listStatEntries });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });

  const months = useMemo(() => availableMonths(entries.data ?? []), [entries.data]);
  const scoped = useMemo(() => filterByPeriod(entries.data ?? [], period), [entries.data, period]);
  const aggs = useMemo(() => aggregateByPlayer(scoped), [scoped]);

  const holders = useMemo(() => {
    const list = (players.data ?? []).map((p) => {
      const mvps = (tournaments.data ?? []).filter(
        (t) =>
          t.mvp_player_id === p.id &&
          (period === OVERALL || String(t.date).slice(0, 7) === period),
      ).length;
      const evaluated = evaluateAchievements(toMetrics(aggs.get(p.id), mvps));
      const unlocked = evaluated.filter((a) => a.unlocked);
      return {
        player: p,
        unlockedCount: unlocked.length,
        score: achievementScore(evaluated),
        top: [...unlocked].reverse().slice(0, 3),
      };
    });
    return list.sort((a, b) => b.score - a.score || b.unlockedCount - a.unlockedCount);
  }, [players.data, tournaments.data, aggs, period]);

  const loading = players.isLoading || entries.isLoading;

  return (
    <Layout>
      <div className="mb-6 animate-rise">
        <h1 className="text-3xl md:text-4xl font-black gradient-text">Achievements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ACHIEVEMENT_COUNT} unlockable achievements, awarded automatically from every match ever
          logged — including all past data.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodToggle value={period} onChange={setPeriod} monthKey={monthKey} />
        <MonthFilter value={period} onChange={setPeriod} months={months} />
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <section key={period} className="grid gap-3 md:grid-cols-2 stagger">
          {holders.map((h, i) => {
            const prestige = prestigeOf(h.unlockedCount);
            return (
              <Link
                key={h.player.id}
                to="/players/$id"
                params={{ id: h.player.id }}
                className={`glass rounded-2xl p-4 flex items-center gap-4 lift ${prestigeAuraClass(prestige)}`}
              >
                <div className="font-mono text-neon w-5 text-center text-sm">{i + 1}</div>
                <PlayerAvatar photoPath={h.player.photo_url} name={h.player.ign} size={56} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{h.player.ign}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {PRESTIGE_LABEL[prestige]}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {h.top.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]"
                      >
                        {a.name}
                      </span>
                    ))}
                    {!h.top.length && (
                      <span className="text-[10px] text-muted-foreground">No achievements yet</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl text-neon">{h.unlockedCount}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    of {ACHIEVEMENT_COUNT}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> {h.score} pts
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
          <Medal className="h-4 w-4 text-neon" /> Full Catalog
        </h2>
        <CatalogGrid />
      </section>
    </Layout>
  );
}

function CatalogGrid() {
  const all = useMemo(
    () =>
      evaluateAchievements(
        toMetrics(undefined, 0),
      ),
    [],
  );
  const groups = useMemo(() => {
    const map = new Map<string, typeof all>();
    for (const a of all) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return [...map.entries()];
  }, [all]);

  return (
    <div className="space-y-6">
      {groups.map(([group, list]) => (
        <div key={group}>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-neon">{group}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {list.map((a, i) => (
              <AchievementBadge key={a.id} a={{ ...a, unlocked: false, progress: 0 }} index={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
