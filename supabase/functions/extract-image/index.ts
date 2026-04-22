// Gemini Vision: extracts structured medical data from an image (prescription, lab, etc).
// Uses Google Gemini API directly (free tier) via shared helper.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiGenerate, VISION_MODEL } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISION_PROMPT = `You are a medical Vision-NLP engine. The user uploaded a photo of a medical document.
1. Read ALL legible text (OCR).
2. Extract structured data and generate risk scores.

Return ONLY valid JSON with this exact schema:
{
  "patient_name": "string",
  "age": number,
  "gender": "string (M/F)",
  "chief_complaint": "string",
  "vitals": { "BP": "string", "HR": "string", "Weight": "string", "Height": "string", "BMI": "string" },
  "lab_values": { "LabName": { "value": "string with units", "status": "Normal|High|Low|Critical" } },
  "medications": ["string"],
  "diagnoses": ["string"],
  "family_history": "string",
  "lifestyle": "string",
  "raw_ocr_text": "string (full text you read from the image)",
  "risk_scores": {
    "diabetes": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "cardiac":  { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "renal":    { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" }
  }
}

Rules:
- If a field is not visible, use "Unknown" or empty array.
- Risk levels: CRITICAL >80, HIGH 60-80, MODERATE 40-60, LOW <40.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, mime_type } = await req.json();
    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mt = mime_type || "image/jpeg";

    const content = await geminiGenerate(
      [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract structured data from this medical document image:" },
            { type: "image_url", image_url: { url: `data:${mt};base64,${image_base64}` } },
          ],
        },
      ],
      { systemInstruction: VISION_PROMPT, model: VISION_MODEL },
    );

    const jsonStr = content.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const jStart = jsonStr.indexOf("{");
    const jEnd = jsonStr.lastIndexOf("}");
    const clean = jStart !== -1 && jEnd > jStart ? jsonStr.slice(jStart, jEnd + 1) : jsonStr;
    const result = JSON.parse(clean);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-image error:", e);
    const err = e as { status?: number };
    const status = err?.status === 429 || err?.status === 402 ? err.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Vision extraction failed" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
