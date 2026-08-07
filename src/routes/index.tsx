import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, Users, Swords, Flame, Crown, ArrowRight, Zap, Target, Activity, Medal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PeriodToggle } from "@/components/PeriodControls";
import { Skeleton } from "@/components/ui/skeleton";
import snovaLogo from "@/assets/snova-logo.jpg.asset.json";
import { listPlayers, listTournaments, positionPoints } from "@/lib/data";
import {
  OVERALL,
  buildLeaderboard,
  currentMonthKey,
  filterByPeriod,
  listStatEntries,
  monthKeyOf,
  periodLabel,
  teamTotals,
  type Period,
} from "@/lib/stats-core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Team SNOVA ESP — Performance Dashboard" },
      {
        name: "description",
        content:
          "Live monthly and all-time performance dashboard for Team SNOVA ESP: kills, damage, points, leaderboards and achievements.",
      },
      { property: "og:title", content: "Team SNOVA ESP — Performance Dashboard" },
      {
        property: "og:description",
        content: "Monthly and all-time team stats, leaderboards and achievements for Team SNOVA ESP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const monthKey = currentMonthKey();
  const [period, setPeriod] = useState<Period>(monthKey);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const entries = useQuery({ queryKey: ["stat-entries"], queryFn: listStatEntries });

  const loading = players.isLoading || tournaments.isLoading || entries.isLoading;
  const activePlayers = players.data?.filter((p) => p.status === "active") ?? [];

  const scoped = useMemo(
    () => filterByPeriod(entries.data ?? [], period),
    [entries.data, period],
  );
  const totals = useMemo(() => teamTotals(scoped), [scoped]);
  const board = useMemo(
    () => buildLeaderboard(scoped, players.data ?? []),
    [scoped, players.data],
  );

  const scopedTournaments = useMemo(() => {
    const list = tournaments.data ?? [];
    if (period === OVERALL) return list;
    return list.filter((t) => String(t.date).slice(0, 7) === period);
  }, [tournaments.data, period]);

  const recent = useMemo(() => {
    const byMatch = new Map<
      string,
      { match_id: string; match_number: number; position: number | null; tournament_id: string; tournament_name: string; created_at: string; kills: number; damage: number }
    >();
    for (const e of scoped) {
      const cur =
        byMatch.get(e.match_id) ?? {
          match_id: e.match_id,
          match_number: e.match_number,
          position: e.position,
          tournament_id: e.tournament_id,
          tournament_name: e.tournament_name,
          created_at: e.match_created_at,
          kills: 0,
          damage: 0,
        };
      cur.kills += e.kills;
      cur.damage += e.damage;
      byMatch.set(e.match_id, cur);
    }
    return [...byMatch.values()]
      .filter((m) => m.kills > 0 || m.damage > 0)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 4)
      .map((m) => ({ ...m, points: positionPoints(m.position) + m.kills }));
  }, [scoped]);

  const latestCompleted = scopedTournaments.filter((t) => t.status === "completed")[0];
  const mvpPlayer = latestCompleted
    ? players.data?.find((p) => p.id === latestCompleted.mvp_player_id)
    : null;

  const monthsWithData = useMemo(
    () => new Set((entries.data ?? []).map(monthKeyOf)),
    [entries.data],
  );
  const monthEmpty = period !== OVERALL && !monthsWithData.has(period);

  return (
    <Layout>
      {/* ---------------- Hero band ---------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 animate-rise">
        <div className="absolute inset-0 grid-texture opacity-40" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />
        <div className="relative grid gap-8 p-6 md:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse-neon" /> Live dashboard
            </div>
            <h1 className="mt-4 font-display text-4xl leading-[0.95] md:text-6xl">
              Team <span className="gradient-text">Snova</span>
              <br className="hidden md:block" />
              <span className="text-muted-foreground"> Esports</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
              Every kill, every match, every tournament — tracked. The board resets each month, the
              all-time record never does.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/players"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                View Roster <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/achievements"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/[0.05]"
              >
                <Medal className="h-4 w-4" /> Achievements
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-2xl border border-border bg-background/40 p-5">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 md:h-24 md:w-24">
              <img src={snovaLogo.url} alt="Team Snova Esp logo" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 grid grid-cols-2 gap-4">
              <div>
                <div className="label-eyebrow">Roster</div>
                <div className="stat-num mt-1 text-2xl">{activePlayers.length}</div>
              </div>
              <div>
                <div className="label-eyebrow">Events</div>
                <div className="stat-num mt-1 text-2xl">{tournaments.data?.length ?? 0}</div>
              </div>
              <div className="col-span-2 min-w-0">
                <div className="label-eyebrow">Latest MVP</div>
                <div className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">
                  <Crown className="h-4 w-4 shrink-0 text-neon" />
                  <span className="truncate">{mvpPlayer?.ign ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Period switch ---------------- */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg md:text-xl">{periodLabel(period)}</h2>
          <div className="text-xs text-muted-foreground">
            {period === OVERALL ? "Career totals since day one" : "Resets at the start of each month"}
          </div>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} monthKey={monthKey} />
      </div>

      {/* ---------------- KPI grid ---------------- */}
      <section key={period} className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 stagger">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : (
            <>
              <StatCard label="Tournaments" value={scopedTournaments.length} icon={<Trophy className="h-4 w-4" />} />
              <StatCard label="Matches" value={totals.matches} icon={<Swords className="h-4 w-4" />} />
              <StatCard label="Team Kills" value={totals.kills} icon={<Flame className="h-4 w-4" />} />
              <StatCard label="Team Damage" value={totals.damage.toLocaleString()} icon={<Zap className="h-4 w-4" />} />
              <StatCard label="Total Points" value={totals.points} icon={<Medal className="h-4 w-4" />} accent />
              <StatCard label="Kills / Tournament" value={totals.killsPerTournament.toFixed(1)} icon={<Target className="h-4 w-4" />} />
              <StatCard label="Kills / Match" value={totals.killsPerMatch.toFixed(1)} icon={<Activity className="h-4 w-4" />} />
              <StatCard label="Active Players" value={activePlayers.length} icon={<Users className="h-4 w-4" />} />
            </>
          )}
      </section>

      {monthEmpty && !loading && (
        <div className="mt-4 rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted-foreground animate-soft-in">
          Nothing logged in {periodLabel(period)} yet — a fresh month, a fresh board. Switch to
          <button onClick={() => setPeriod(OVERALL)} className="mx-1 text-neon hover:underline">All Time</button>
          to see the full record.
        </div>
      )}

      {/* ---------------- Main split: leaderboard + side rail ---------------- */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Leaderboard */}
        <div className="rounded-2xl border border-border bg-surface/60">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-display text-xl">
                {period === OVERALL ? "All-Time Leaderboard" : "Monthly Leaderboard"}
              </h2>
              <div className="truncate text-xs text-muted-foreground">{periodLabel(period)}</div>
            </div>
            <Link to="/stats" className="text-xs font-semibold text-neon hover:underline">Full stats →</Link>
          </div>

          {board.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              No stats for {periodLabel(period)}.
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[2.5rem_1fr_3rem_3rem_4.5rem] gap-3 px-5 py-2.5 sm:grid label-eyebrow border-b border-border">
                <div>#</div><div>Player</div>
                <div className="text-right">K</div><div className="text-right">A</div>
                <div className="text-right">DMG</div>
              </div>
              <div key={period} className="divide-y divide-border stagger">
                {board.map((r, i) => (
                  <Link
                    key={r.player_id}
                    to="/players/$id"
                    params={{ id: r.player_id }}
                    className="grid grid-cols-[2.5rem_1fr_3rem_3rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.04] sm:grid-cols-[2.5rem_1fr_3rem_3rem_4.5rem]"
                  >
                    <div
                      className={`stat-num text-sm ${i === 0 ? "text-neon" : "text-muted-foreground"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <PlayerAvatar photoPath={r.player.photo_url} name={r.player.ign} size={34} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.player.ign}</div>
                        <div className="label-eyebrow truncate">{r.player.role} · {r.matches}m</div>
                      </div>
                    </div>
                    <div className="stat-num text-right text-base">{r.kills}</div>
                    <div className="stat-num text-right text-base text-muted-foreground">{r.assists}</div>
                    <div className="stat-num hidden text-right text-sm text-muted-foreground sm:block">
                      {r.damage.toLocaleString()}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side rail: latest matches */}
        <div className="rounded-2xl border border-border bg-surface/60">
          <div className="flex items-end justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-display text-xl">Latest Matches</h2>
              <div className="text-xs text-muted-foreground">{periodLabel(period)}</div>
            </div>
            <Link to="/tournaments" className="text-xs font-semibold text-neon hover:underline">All →</Link>
          </div>
          {entries.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : recent.length > 0 ? (
            <div key={period} className="divide-y divide-border stagger">
              {recent.map((m) => (
                <Link
                  key={m.match_id}
                  to="/tournaments/$id"
                  params={{ id: m.tournament_id }}
                  className="block px-5 py-4 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-eyebrow !text-neon">Match {m.match_number}</span>
                    {m.position && (
                      <span className="rounded-md bg-neon-soft px-2 py-0.5 stat-num text-[10px] text-neon">
                        #{m.position}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 truncate text-sm font-semibold">{m.tournament_name}</div>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      <span className="stat-num text-foreground">{m.kills}</span> kills
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="stat-num text-foreground">{(m.damage / 1000).toFixed(1)}k</span> dmg
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="stat-num text-neon">{m.points}</span> pts
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No match stats logged in {periodLabel(period)}.
            </div>
          )}
        </div>
      </section>

      {/* ---------------- Roster ---------------- */}
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between border-b border-border pb-3">
          <h2 className="font-display text-xl md:text-2xl">Active Roster</h2>
          <Link to="/players" className="text-xs font-semibold text-neon hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 stagger">
          {activePlayers.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              to="/players/$id"
              params={{ id: p.id }}
              className="rounded-xl border border-border bg-surface/60 p-5 lift"
            >
              <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={60} className="mx-auto" />
              <div className="mt-4 text-center">
                <div className="truncate text-sm font-semibold">{p.ign}</div>
                <div className="label-eyebrow mt-1 truncate">{p.role}</div>
              </div>
            </Link>
          ))}
          {!activePlayers.length && !loading && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No players yet. Admin can add players from the admin panel.
            </div>
          )}
        </div>
      </section>

      {/* ---------------- Tournaments ---------------- */}
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between border-b border-border pb-3">
          <h2 className="font-display text-xl md:text-2xl">Tournaments</h2>
          <Link to="/tournaments" className="text-xs font-semibold text-neon hover:underline">View all →</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 stagger">
          {scopedTournaments.slice(0, 6).map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="rounded-xl border border-border bg-surface/60 p-5 lift"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                    t.status === "completed"
                      ? "bg-neon-soft text-neon"
                      : "bg-white/[0.06] text-muted-foreground"
                  }`}
                >
                  {t.status}
                </span>
                <span className="stat-num text-[11px] text-muted-foreground">
                  {new Date(t.date).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 truncate font-display text-lg">{t.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {t.organizer ?? "—"} · {t.num_matches} matches
              </div>
            </Link>
          ))}
          {!scopedTournaments.length && !loading && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No tournaments in {periodLabel(period)}.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
