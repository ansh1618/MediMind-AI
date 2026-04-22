import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  symptoms: `
You are a medical AI assistant.

Return ONLY valid JSON (no extra text, no markdown).

Format:
{
  "diseases": [
    { "name": "", "probability": 0, "severity": "High | Moderate | Low" }
  ],
  "riskFactors": [
    { "factor": "", "value": "", "level": "High | Moderate | Low", "reason": "" }
  ],
  "recommendations": [],
  "confidence": 0
}

Rules:
- Give top 3 diseases
- Probability must be realistic (0–100)
- Confidence overall accuracy (0–100)
- No explanation outside JSON
`,
diagnosis: `
You are an expert clinical AI doctor.

Analyze symptoms deeply like a physician.

Return ONLY valid JSON.

Format:
{
  "diseases": [
    { "name": "", "probability": 0, "severity": "High | Moderate | Low" }
  ],
  "riskFactors": [
    { "factor": "", "value": "", "level": "High | Moderate | Low", "reason": "" }
  ],
  "recommendations": [],
  "confidence": 0
}

Rules:
- Use clinical reasoning
- Consider history, severity, complications
- Add risk factors explanation
- Prioritize life-threatening conditions
- Output must be structured JSON only
`,
  summary:
    "Summarize medical record in <120 words. Highlight abnormal findings.",
  recommendation:
    "Give 3 prioritized recommendations: immediate, tests, lifestyle.",
  general:
    "You are MediMind AI, a helpful medical assistant.",
};

interface ReqBody {
  task?: string;
  prompt?: string;
  context?: Record<string, unknown>;
}

// ---------------- GEMINI ----------------
async function callGemini(prompt: string, system: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err);
  }

  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
// ---------------- GROK ----------------
async function callGrok(prompt: string, system: string) {
  const apiKey = Deno.env.get("GROK_API_KEY");

  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) throw new Error("Grok failed");

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ---------------- MAIN ----------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: ReqBody = await req.json().catch(() => ({}));

    const task = body.task || "general";
    const prompt = (body.prompt || "").trim();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = SYSTEM_PROMPTS[task] || SYSTEM_PROMPTS.general;

    const finalPrompt = body.context
      ? `${prompt}\n\nContext:\n${JSON.stringify(body.context, null, 2)}`
      : prompt;

  let text = "";
  let parsed;

  try {
    console.log("Using Gemini...");
    text = await callGemini(finalPrompt, system);
  } catch (e) {
    console.warn("Gemini failed → switching to Grok");

    try {
      text = await callGrok(finalPrompt, system);
    } catch (err) {
      console.warn("Grok failed → retry Gemini");
      text = await callGemini(finalPrompt, system);
    }
  }

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      diseases: [{ name: "Unknown", probability: 50, severity: "Low" }],
      recommendations: [text],
      confidence: 50
    };
  }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});