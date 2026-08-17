import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/data";

export async function getAuthenticatedPlayer(): Promise<Player | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[getAuthenticatedPlayer] auth error:", authError);
    throw authError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getAuthenticatedPlayer] player lookup:", error);
    throw error;
  }

  return (data ?? null) as Player | null;
}
