import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const [signingIn, setSigningIn] = useState(false);

  const players = useQuery({
    queryKey: ["players"],
    queryFn: listPlayers,
  });

  const linked = useQuery({
    queryKey: ["authenticated-player", session?.user.id ?? null],
    queryFn: getAuthenticatedPlayer,
    enabled: !!session,
    staleTime: 0,
  });

  const available = useMemo(
    () =>
      (players.data ?? []).filter(
        (p) => p.status === "active" && !p.user_id,
      ),
    [players.data],
  );

  // After Google returns:
  // 1) returning player -> restore linked roster player automatically
  // 2) first-time player -> finish the selected player claim
  useEffect(() => {
    if (!session || linked.isLoading) return;

    const pending = window.localStorage.getItem(PENDING_KEY);

    // Returning player:
    // the Google account already has players.user_id linked to it.
    if (linked.data) {
      window.localStorage.removeItem(PENDING_KEY);
      setSelected(null);
      setSigningIn(false);
      return;
    }

    // No linked player and no pending selection:
    // this can happen when a user signs into Google before selecting a player.
    if (!pending) {
      setSigningIn(false);
      return;
    }

    window.localStorage.removeItem(PENDING_KEY);
    setBusy(true);

    void claimPlayerAccount(pending)
      .then(async (player) => {
        toast.success(`Linked to ${player.ign}`);
        await qc.invalidateQueries();
      })
      .catch((error: any) => {
        toast.error(error?.message ?? "Could not link this player");
      })
      .finally(() => setBusy(false));
  }, [session, linked.isLoading, linked.data, qc]);

  // First-time flow:
  // Select roster player -> Continue with Google -> claim selected player.
  const connectSelectedPlayer = async () => {
    if (!selected) {
      toast.error("Select your player name first.");
      return;
    }

    if (session) {
      if (linked.data) {
        toast.error(
          `This Google account is already linked to ${linked.data.ign}. Sign out first to use a different account.`,
        );
        return;
      }

      setBusy(true);

      try {
        const player = await claimPlayerAccount(selected);

        toast.success(`Linked to ${player.ign}`);
        setSelected(null);

        await qc.invalidateQueries();
      } catch (error: any) {
        toast.error(error?.message ?? "Could not link this player");
      } finally {
        setBusy(false);
      }

      return;
    }

    setBusy(true);

    try {
      // Remember the player chosen before Google OAuth.
      window.localStorage.setItem(PENDING_KEY, selected);

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/player-login",
      });

      if (result.error) {
        window.localStorage.removeItem(PENDING_KEY);
        toast.error(result.error.message ?? "Google sign-in failed");
      }
    } catch (error: any) {
      window.localStorage.removeItem(PENDING_KEY);
      toast.error(error?.message ?? "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  // Returning-player flow:
  // Google account itself identifies the roster player.
  // No player selection is required.
  const signInWithGoogle = async () => {
    if (session) {
      if (linked.data) {
        toast.success(`Signed in as ${linked.data.ign}`);
        return;
      }

      toast.error(
        "This Google account is not linked to a roster player yet.",
      );
      return;
    }

    setSigningIn(true);

    try {
      // Very important: returning login must NOT have a pending player claim.
      window.localStorage.removeItem(PENDING_KEY);

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/player-login",
      });

      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setSigningIn(false);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Could not sign in");
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    window.localStorage.removeItem(PENDING_KEY);
    setSelected(null);
    setSigningIn(false);

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
            First time? Select your in-game name and connect it to Google.
            Already linked? Just sign in with the same Google account and your
            player profile will open automatically.
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

              <Button
                variant="outline"
                onClick={() => void signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </section>
        ) : (
          <section className="glass rounded-2xl p-5 md:p-6">
            <div className="label-eyebrow mb-3">
              Returning player
            </div>

            <Button
              className="glow w-full"
              disabled={loading || busy || signingIn}
              onClick={() => void signInWithGoogle()}
            >
              <UserRound className="mr-2 h-4 w-4" />
              {signingIn
                ? "Opening Google…"
                : "Sign in with Google"}
            </Button>

            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>First time player?</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="label-eyebrow mb-3">
              Select your player
            </div>

            {players.isLoading || loading ? (
              <div className="grid gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 rounded-xl"
                  />
                ))}
              </div>
            ) : available.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                All active roster players are already linked.
                Use the Google sign-in button above.
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
                      <div className="truncate font-semibold">
                        {p.ign}
                      </div>

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
              disabled={
                busy ||
                signingIn ||
                loading ||
                !selected
              }
              onClick={() => void connectSelectedPlayer()}
            >
              <UserRound className="mr-2 h-4 w-4" />
              {busy
                ? "Connecting…"
                : "Continue with Google"}
            </Button>
          </section>
        )}
      </div>
    </Layout>
  );
}
