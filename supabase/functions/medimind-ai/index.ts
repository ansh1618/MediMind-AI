import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiGenerate, geminiStream } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  chat: `You are MediMind AI, an advanced clinical assistant for doctors. You have access to patient data and can help analyze conditions, recommend treatments, and explain medical concepts. Be concise, professional, and always note that AI suggestions should be verified by clinical judgment. Use markdown formatting for readability.`,
  diagnosis: `You are a medical AI diagnosis assistant with multilingual clinical understanding. Given patient symptoms, provide:\n1. A list of probable conditions with estimated probability percentages and severity (High/Moderate/Low)\n2. Concrete risk factors extracted from the input — each with the measured value, qualitative level (Very High/High/Moderate/Low/Normal), and a one-line reason explaining WHY it raises risk. Include lab values (HbA1c, BP, BMI, SpO2, etc.), lifestyle, and family history when present.\n3. Recommended diagnostic actions\n4. A confidence score for your overall analysis (0-100%)\nRespond ONLY with valid JSON in this exact format:\n{"diseases":[{"name":"string","probability":number,"severity":"High|Moderate|Low"}],"riskFactors":[{"factor":"string","value":"string","level":"Very High|High|Moderate|Low|Normal","reason":"string"}],"recommendations":["string"],"confidence":number}`,
  report: `You are a medical report analyzer. Given a medical report description, provide:\n1. A title for the report\n2. A brief clinical summary\n3. Key findings with status (normal/abnormal/critical)\n4. A plain-language explanation for the patient\nRespond ONLY with valid JSON in this exact format:\n{"title":"string","summary":"string","keyFindings":[{"finding":"string","status":"normal|abnormal|critical"}],"simplifiedExplanation":"string"}`,
  recommendation: `You are a clinical AI assistant. Based on the patient's risk profile and vitals, provide:\n1. A concise clinical summary (2-3 sentences)\n2. 3-5 prioritised, actionable recommendations for the clinician\nRespond with plain text — no JSON required.`,
  summary: `You are a clinical AI. Summarise the medical record in under 120 words. Highlight abnormal findings, key diagnoses, and urgent action items.`,
  general: `You are MediMind AI, a helpful and concise clinical assistant.`,
};

const VALID_MODES = new Set(Object.keys(systemPrompts));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, systemPrompt } = await req.json();

    // Validate mode
    const resolvedMode: string = typeof mode === "string" ? mode : "chat";
    if (!VALID_MODES.has(resolvedMode)) {
      return new Response(
        JSON.stringify({ error: `Unknown mode "${resolvedMode}". Valid modes: ${[...VALID_MODES].join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const system: string = systemPrompt || systemPrompts[resolvedMode];

    if (resolvedMode === "chat") {
      const stream = await geminiStream(messages, { systemInstruction: system });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const content = await geminiGenerate(messages, { systemInstruction: system });
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("medimind-ai error:", e);
    const err = e as { status?: number; retryAfterSeconds?: number };
    const status = err?.status === 429 || err?.status === 402 ? err.status : 500;
    const retryAfter = typeof err?.retryAfterSeconds === "number" ? err.retryAfterSeconds : undefined;
    const msg = status === 429
      ? `Google AI rate limit hit${retryAfter ? `. Retry in about ${retryAfter}s.` : ". Please wait a moment and try again."}`
      : status === 402
        ? "Google AI quota exhausted. Check your Gemini quota/billing."
        : (e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: msg, retryAfter }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
