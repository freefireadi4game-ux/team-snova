import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/data";

export type PlayerAlias = {
  id: string;
  player_id: string;
  alias: string;
  created_at: string;
};

export async function listAliases() {
  const { data, error } = await supabase
    .from("player_aliases")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlayerAlias[];
}

export async function addAlias(player_id: string, alias: string) {
  const { error } = await supabase.from("player_aliases").insert({ player_id, alias: alias.trim() });
  if (error) throw error;
}

export async function deleteAlias(id: string) {
  const { error } = await supabase.from("player_aliases").delete().eq("id", id);
  if (error) throw error;
}

/** lowercase, alphanumeric only — makes "Snv.Krishna" and "snv krishna" equal. */
export function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Cheap similarity: shared-prefix + containment scoring, 0..1. */
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i / Math.max(a.length, b.length);
}

/**
 * Resolve an in-game name from a screenshot to a roster player.
 * Aliases win; otherwise fall back to a fuzzy match on the IGN.
 */
export function resolvePlayer(
  gameName: string,
  players: Player[],
  aliases: PlayerAlias[],
): { player: Player; exact: boolean } | null {
  const n = normalizeName(gameName);
  if (!n) return null;

  const alias = aliases.find((a) => normalizeName(a.alias) === n);
  if (alias) {
    const p = players.find((x) => x.id === alias.player_id);
    if (p) return { player: p, exact: true };
  }

  const direct = players.find((p) => normalizeName(p.ign) === n);
  if (direct) return { player: direct, exact: true };

  let best: { player: Player; score: number } | null = null;
  for (const p of players) {
    const score = Math.max(
      similarity(n, normalizeName(p.ign)),
      ...aliases
        .filter((a) => a.player_id === p.id)
        .map((a) => similarity(n, normalizeName(a.alias))),
    );
    if (!best || score > best.score) best = { player: p, score };
  }
  if (best && best.score >= 0.6) return { player: best.player, exact: false };
  return null;
}
