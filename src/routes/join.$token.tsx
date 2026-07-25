import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, LogIn } from "lucide-react";

export const Route = createFileRoute("/join/$token")({
  component: JoinPlayer,
});

function JoinPlayer() {
  const { token } = Route.useParams();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [claiming, setClaiming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const claim = async () => {
      if (!session || claiming || done) return;
      setClaiming(true);
      const { data, error } = await supabase.rpc("claim_player_role", { _token: token });
      if (error) toast.error(error.message);
      else if (data) {
        setDone(true);
        toast.success("You're now a team player — voice and maps unlocked");
      } else {
        toast.error("Invalid invite link");
      }
      setClaiming(false);
    };
    claim();
  }, [session, token, claiming, done]);

  return (
    <Layout>
      <div className="max-w-md mx-auto glass rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-display mb-2">Join Team SNOVA</h1>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !session ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in or create an account first — then you'll unlock team voice and map planning.
            </p>
            <Button onClick={() => navigate({ to: "/auth", search: { next: `/join/${token}` } as any })}>
              <LogIn className="h-4 w-4 mr-1" /> Sign in / Sign up
            </Button>
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-neon mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-4">You're in.</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate({ to: "/voice" })}>Team Voice</Button>
              <Button variant="secondary" onClick={() => navigate({ to: "/maps" })}>Maps</Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Claiming access…</div>
        )}
      </div>
    </Layout>
  );
}
