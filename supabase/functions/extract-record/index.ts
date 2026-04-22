import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiGenerate } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are a medical NLP engine. Extract structured data from the following patient record and generate risk scores.

Return ONLY valid JSON with this exact schema:
{
  "patient_name": "string",
  "age": number,
  "gender": "string (M/F)",
  "chief_complaint": "string",
  "vitals": { "BP": "string", "HR": "string", "Weight": "string", "Height": "string", "BMI": "string" },
  "lab_values": {
    "LabName": { "value": "string with units", "status": "Normal|High|Low|Critical" }
  },
  "medications": ["string"],
  "diagnoses": ["string - inferred diagnoses based on data"],
  "family_history": "string",
  "lifestyle": "string",
  "risk_scores": {
    "diabetes": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" },
    "cardiac": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" },
    "renal": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" }
  }
}

Rules:
- Infer diagnoses from lab values and symptoms (e.g., HbA1c > 6.5% → Type 2 Diabetes)
- Risk levels: CRITICAL (>80%), HIGH (60-80%), MODERATE (40-60%), LOW (<40%)
- If information is missing, use "Unknown" and adjust risk accordingly`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { raw_text } = await req.json();
    if (!raw_text || typeof raw_text !== "string") {
      return new Response(JSON.stringify({ error: "raw_text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await geminiGenerate(
      [{ role: "user", content: `Patient Record:\n\n${raw_text}` }],
      { systemInstruction: EXTRACTION_PROMPT },
    );
    const jsonStr = content.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    const clean = start !== -1 && end > start ? jsonStr.slice(start, end + 1) : jsonStr;
    const result = JSON.parse(clean);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-record error:", e);
    const err = e as { status?: number };
    const status = err?.status === 429 || err?.status === 402 ? err.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Extraction failed" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
