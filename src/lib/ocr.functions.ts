import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  /** data URL: data:image/jpeg;base64,.... */
  imageDataUrl: z.string().min(32),
});

export type OcrRow = { name: string; kills: number; assists: number; damage: number };
export type OcrResult = { position: number | null; rows: OcrRow[] };

const SYSTEM = `You read Free Fire / BGMI style match result screenshots and extract the scoreboard.
Return STRICT JSON only, no prose, shaped exactly:
{"position": <number|null>, "rows": [{"name": "<exact in-game name>", "kills": <int>, "assists": <int>, "damage": <int>}]}
Rules:
- "position" is the team's finishing rank, usually shown like "#2/11" or "#2" near the top. Take only the rank number (2), never the lobby size.
- The scoreboard columns are typically NAME, K (kills), A (assists), DMG (damage), REVIVAL, SURVIVAL TIME. Ignore REVIVAL and SURVIVAL TIME.
- "name" must be the primary in-game nickname line (not the guild/clan subtitle underneath).
- Numbers must be plain integers with no commas.
- Include every player row visible. If a value is unreadable use 0.`;

export const parseMatchScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<OcrResult> => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      throw new Error("Admin only");
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the scoreboard from this match screenshot." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue");
    if (!res.ok) throw new Error(`AI request failed (${res.status}): ${await res.text()}`);

    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Could not read the screenshot — try a clearer image");
      parsed = JSON.parse(m[0]);
    }

    const toInt = (v: unknown) => {
      const n = parseInt(String(v ?? "0").replace(/[^0-9-]/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const pos = toInt(parsed?.position);
    return {
      position: pos >= 1 && pos <= 12 ? pos : null,
      rows: (Array.isArray(parsed?.rows) ? parsed.rows : [])
        .map((r: any) => ({
          name: String(r?.name ?? "").trim(),
          kills: toInt(r?.kills),
          assists: toInt(r?.assists),
          damage: toInt(r?.damage),
        }))
        .filter((r: OcrRow) => r.name.length > 0),
    };
  });
