import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

export function useMyRoles() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["my-roles", session?.user.id],
    queryFn: async () => {
      if (!session) return [] as string[];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      return (data ?? []).map((r: any) => r.role as string);
    },
    enabled: !!session,
  });
}

export function useIsAdmin() {
  const q = useMyRoles();
  return { ...q, data: q.data?.includes("admin") ?? false };
}

export function useCanVoice() {
  const q = useMyRoles();
  const roles = q.data ?? [];
  return { ...q, data: roles.includes("admin") || roles.includes("player") };
}
