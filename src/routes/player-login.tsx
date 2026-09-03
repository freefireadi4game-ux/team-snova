import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LogOut, UserRound } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlayers } from "@/lib/data";
import { useSession } from "@/lib/auth";
import { claimPlayerAccount } from "@/lib/benchmark/claim";
import { getAuthenticatedPlayer } from "@/lib/benchmark/player";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PENDING_KEY = "snova:pending-player-claim";

export const Route = createFileRoute("/player-login")({
  head: () => ({
    meta: [
      { title: "Player Sign In — Team SNOVA ESP" },
      {
        name: "description",
        content:
          "Team SNOVA ESP players link their Google account to their roster profile to track benchmark tasks.",
      },
      { property: "og:title", content: "Player Sign In — Team SNOVA ESP" },
      {
        property: "og:description",
        content: "Link your Google account to your SNOVA roster profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerLoginPage,
});

function PlayerLoginPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const players = useQuery({ queryKey: ["players"], queryFn: listPlayers });

  const linked = useQuery({
    queryKey: ["authenticated-player", session?.user.id ?? null],
    queryFn: getAuthenticatedPlayer,
    enabled: !!session,
  });

  // Available = active roster players that no account owns yet.
  const available = (players.data ?? []).filter(
    (p) => p.status === "active" && !p.user_id,
  );

  // After Google returns, finish the claim for the player picked before sign-in.
  useEffect(() => {
    if (!session || linked.isLoading) return;
    if (linked.data) {
      window.localStorage.removeItem(PENDING_KEY);
      return;
    }
    const pending = window.localStorage.getItem(PENDING_KEY);
    if (!pending) return;

    window.localStorage.removeItem(PENDING_KEY);
    setBusy(true);
    claimPlayerAccount(pending)
      .then(async (player) => {
        toast.success(`Linked to ${player.ign}`);
        await qc.invalidateQueries();
      })
      .catch((error: any) =>
        toast.error(error?.message ?? "Could not link this player"),
      )
      .finally(() => setBusy(false));
  }, [session, linked.isLoading, linked.data, qc]);

  const connect = async () => {
    if (!selected) {
      toast.error("Select your player name first.");
      return;
    }

    setBusy(true);
    try {
      window.localStorage.setItem(PENDING_KEY, selected);

      if (session) {
        const player = await claimPlayerAccount(selected);
        toast.success(`Linked to ${player.ign}`);
        window.localStorage.removeItem(PENDING_KEY);
        await qc.invalidateQueries();
        return;
      }

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/player-login",
      });

      if (result.error) {
        window.localStorage.removeItem(PENDING_KEY);
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
    } catch (error: any) {
      window.localStorage.removeItem(PENDING_KEY);
      toast.error(error?.message ?? "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await qc.invalidateQueries();
  };

  const myPlayer = linked.data;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6">
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon">
            Player Access
          </div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl gradient-text">
            Player Sign In
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick your in-game name, sign in with Google, and your match history
            and benchmark tasks stay tied to that account.
          </p>
        </section>

        {myPlayer ? (
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <PlayerAvatar
                photoPath={myPlayer.photo_url}
                name={myPlayer.ign}
                size={56}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-lg font-bold">
                  {myPlayer.ign}
                  <CheckCircle2 className="h-4 w-4 text-neon" />
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {myPlayer.role}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="glow"
                onClick={() => navigate({ to: "/benchmarks" })}
              >
                Go to my tasks
              </Button>
              <Button variant="outline" onClick={() => void signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </section>
        ) : (
          <section className="glass rounded-2xl p-5 md:p-6">
            <div className="label-eyebrow mb-3">Select your player</div>

            {players.isLoading || loading ? (
              <div className="grid gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : available.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Every active roster player is already linked to an account.
              </div>
            ) : (
              <div className="grid gap-2">
                {available.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected === p.id
                        ? "border-neon/50 bg-neon-soft"
                        : "border-border bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <PlayerAvatar
                      photoPath={p.photo_url}
                      name={p.ign}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.ign}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {p.role}
                      </div>
                    </div>
                    {selected === p.id && (
                      <CheckCircle2 className="h-4 w-4 text-neon" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <Button
              className="glow mt-5 w-full"
              disabled={busy || !selected}
              onClick={() => void connect()}
            >
              <UserRound className="mr-2 h-4 w-4" />
              {busy
                ? "Connecting…"
                : session
                  ? "Link this player to my account"
                  : "Continue with Google"}
            </Button>

            {session && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-neon"
              >
                Use a different Google account
              </button>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}
