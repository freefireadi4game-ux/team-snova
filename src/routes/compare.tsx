import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Layout } from "@/components/Layout";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listPlayers,
  listStatsForPlayer,
  listTournaments,
  didPlay,
  sum,
  avg,
} from "@/lib/data";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Players — Team SNOVA ESP" },
      { name: "description", content: "Compare two Team SNOVA ESP players side-by-side." },
    ],
  }),
  component: Compare,
});

function usePlayerAgg(id: string | undefined) {
  const stats = useQuery({
    queryKey: ["player-stats", id],
    queryFn: () => listStatsForPlayer(id!),
    enabled: !!id,
  });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: listTournaments });
  const raw = (stats.data ?? []) as Array<{ kills: number; damage: number; assists: number }>;
  const rows = raw.filter((r) => didPlay(r));
  const mvps = id ? tournaments.data?.filter((t) => t.mvp_player_id === id).length ?? 0 : 0;
  return {
    matches: rows.length,
    totalKills: sum(rows.map((r) => r.kills)),
    totalDamage: sum(rows.map((r) => r.damage)),
    totalAssists: sum(rows.map((r) => r.assists ?? 0)),
    avgKills: avg(rows.map((r) => r.kills)),
    avgDamage: avg(rows.map((r) => r.damage)),
    mvps,
  };
}

function Compare() {
  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });
  const [a, setA] = useState<string | undefined>();
  const [b, setB] = useState<string | undefined>();

  const pA = players.data?.find((p) => p.id === a);
  const pB = players.data?.find((p) => p.id === b);
  const aggA = usePlayerAgg(a);
  const aggB = usePlayerAgg(b);

  const chart = [
    { metric: "Kills", A: aggA.totalKills, B: aggB.totalKills },
    { metric: "Assists", A: aggA.totalAssists, B: aggB.totalAssists },
    { metric: "Avg K", A: +aggA.avgKills.toFixed(1), B: +aggB.avgKills.toFixed(1) },
    { metric: "Matches", A: aggA.matches, B: aggB.matches },
    { metric: "MVPs", A: aggA.mvps, B: aggB.mvps },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="a-slide-blur font-display text-3xl md:text-4xl gradient-text">Player Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Head-to-head across every match played.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          { label: "Player A", value: a, set: setA, other: b },
          { label: "Player B", value: b, set: setB, other: a },
        ].map((s) => (
          <div key={s.label} className="glass i-lift rounded-2xl p-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {s.label}
            </label>
            <Select value={s.value} onValueChange={s.set}>
              <SelectTrigger className="mt-2 bg-transparent border-white/10">
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                {players.data
                  ?.filter((p) => p.id !== s.other)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ign} — {p.role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {pA && pB && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3">
            {[
              { p: pA, agg: aggA },
              { p: pB, agg: aggB },
            ].map(({ p, agg }) => (
              <div key={p.id} className="glass i-lift rounded-2xl p-4 md:p-6 text-center">
                <PlayerAvatar photoPath={p.photo_url} name={p.ign} size={72} className="mx-auto glow" />
                <div className="mt-3 font-bold text-lg truncate">{p.ign}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {p.role}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                  {[
                    ["Matches", agg.matches],
                    ["Kills", agg.totalKills],
                    ["Assists", agg.totalAssists],
                    ["Damage", agg.totalDamage.toLocaleString()],
                    ["Avg K", agg.avgKills.toFixed(1)],
                    ["Avg D", Math.round(agg.avgDamage).toLocaleString()],
                    ["MVPs", agg.mvps],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg bg-white/5 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                        {k}
                      </div>
                      <div className="font-bold text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6 glass rounded-3xl p-4 md:p-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Head to Head
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="metric" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,15,25,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="A" name={pA.ign} fill="oklch(0.78 0.22 230)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="B" name={pB.ign} fill="oklch(0.75 0.18 300)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
