import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, LockKeyhole, UserRound } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPlayers } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { claimPlayerAccount } from "@/lib/benchmark/claim";
import { toast } from "sonner";

export const Route = createFileRoute("/player-login")({
  component: PlayerLoginPage,
});

function PlayerLoginPage() {
  const players = useQuery({
    queryKey: ["players"],
    queryFn: listPlayers,
    staleTime: 60_000,
  });

  const [playerId, setPlayerId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const availablePlayers = (players.data ?? []).filter(
    (player) => player.status === "active",
  );

  const selectedPlayer = availablePlayers.find(
    (player) => player.id === playerId,
  );

  const submit = async () => {
    if (!playerId) {
      toast.error("Select your player name.");
      return;
    }

    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (!selectedPlayer) {
      toast.error("Player not found.");
      return;
    }

    if (selectedPlayer.user_id) {
      toast.error("This player account is already claimed.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Account could not be created.");
      }

      /*
       * Supabase may require email confirmation.
       * The database claim is only possible after there is
       * an authenticated session.
       */
      if (!data.session) {
        toast.success(
          "Account created. Check your email to confirm it, then log in again.",
        );
        return;
      }

      const linkedPlayer = await claimPlayerAccount(playerId);

      toast.success(
        `${linkedPlayer.ign} account linked successfully.`,
      );

      window.location.href = "/benchmarks";
    } catch (error: any) {
      console.error("[player signup]", error);

      const message = String(error?.message ?? "");

      if (message.toLowerCase().includes("already registered")) {
        toast.error(
          "This email is already registered. Use the Login option instead.",
        );
      } else if (
        message.toLowerCase().includes("already linked") ||
        message.toLowerCase().includes("already claimed")
      ) {
        toast.error(
          "This player is already linked to another account.",
        );
      } else {
        toast.error(
          message || "Could not create player account.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <section className="glass rounded-2xl p-5 md:p-7">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-neon-soft text-neon">
            <UserRound className="h-6 w-6" />
          </div>

          <h1 className="mt-4 font-display text-4xl">
            Login as Player
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Select your existing team player profile and create your
            personal account. Once claimed, nobody else can claim that
            player.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <Label>Player name</Label>

              {players.isLoading ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Loading players…
                </div>
              ) : (
                <Select
                  value={playerId}
                  onValueChange={setPlayerId}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select your player" />
                  </SelectTrigger>

                  <SelectContent>
                    {availablePlayers.map((player) => (
                      <SelectItem
                        key={player.id}
                        value={player.id}
                        disabled={Boolean(player.user_id)}
                      >
                        {player.ign}
                        {player.user_id ? " — already claimed" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Minimum 6 characters"
              />
            </div>

            <Button
              type="button"
              className="w-full glow"
              disabled={
                loading ||
                players.isLoading ||
                !selectedPlayer
              }
              onClick={submit}
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              {loading
                ? "Creating account…"
                : "Create Player Account"}
            </Button>
          </div>

          <div className="mt-5 rounded-xl bg-white/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground">
            Your selected player profile can only be linked once.
            After successful linking, the same roster player cannot be
            claimed by another account.
          </div>
        </section>
      </div>
    </Layout>
  );
}
