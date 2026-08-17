import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/data";

export async function claimPlayerAccount(
  playerId: string,
): Promise<Player> {
  const { data, error } = await supabase.rpc(
    "claim_player_account",
    {
      p_player_id: playerId,
    },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Player account could not be linked.");
  }

  return data as Player;
}
