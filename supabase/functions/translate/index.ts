// Gemini-powered translator (direct Google API).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiGenerate } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, target_language } = await req.json();
    if (!text || !target_language) {
      return new Response(JSON.stringify({ error: "text and target_language are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translated_text = await geminiGenerate(
      [{ role: "user", content: text }],
      {
        systemInstruction: `You are a professional medical translator. Translate the user's text into ${target_language}. Keep medical terms accurate. Preserve any JSON structure if present (translate values, not keys). Return ONLY the translated text, no explanations.`,
      },
    );

    return new Response(JSON.stringify({ translated_text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    const err = e as { status?: number };
    const status = err?.status === 429 || err?.status === 402 ? err.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Translation failed" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
