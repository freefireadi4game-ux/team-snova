import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVoiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { room: string; name: string }) => data)
  .handler(async ({ data, context }) => {
    const { AccessToken } = await import("livekit-server-sdk");
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;
    const url = process.env.LIVEKIT_URL!;

    // Verify caller is admin or player
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const rs = (roles ?? []).map((r: any) => r.role);
    if (!rs.includes("admin") && !rs.includes("player")) {
      throw new Error("Voice access is limited to admin and invited players.");
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: context.userId,
      name: data.name,
      ttl: 60 * 60,
    });
    at.addGrant({
      room: data.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return { token, url };
  });
