/**
 * AI gateway — Groq (Llama-3.3-70b) as primary, Gemini as fallback.
 * Calls APIs directly from the browser — no edge function needed.
 */

import { supabase } from "@/integrations/supabase/client";

const GROQ_API_KEY   = import.meta.env.VITE_GROK_API_KEY   as string; // stored as VITE_GROK_API_KEY
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type AIMode = "chat" | "diagnosis" | "report" | "recommendation" | "summary" | "general";

interface Message { role: "user" | "assistant" | "model"; content: string; }

const SYSTEM_PROMPTS: Record<AIMode, string> = {
  diagnosis: `You are a medical AI diagnosis assistant with multilingual clinical understanding. Given patient symptoms, provide:
1. A list of probable conditions with estimated probability percentages and severity (High/Moderate/Low)
2. Concrete risk factors extracted from the input — each with the measured value, qualitative level (Very High/High/Moderate/Low/Normal), and a one-line reason explaining WHY it raises risk. Include lab values (HbA1c, BP, BMI, SpO2, etc.), lifestyle, and family history when present.
3. Recommended diagnostic actions
4. A confidence score for your overall analysis (0-100)
Respond ONLY with valid JSON in this exact format:
{"diseases":[{"name":"string","probability":number,"severity":"High|Moderate|Low"}],"riskFactors":[{"factor":"string","value":"string","level":"Very High|High|Moderate|Low|Normal","reason":"string"}],"recommendations":["string"],"confidence":number}`,

  report: `You are a medical report analyzer. Given a medical report description, provide:
1. A title for the report
2. A brief clinical summary
3. Key findings with status (normal/abnormal/critical)
4. A plain-language explanation for the patient
Respond ONLY with valid JSON in this exact format:
{"title":"string","summary":"string","keyFindings":[{"finding":"string","status":"normal|abnormal|critical"}],"simplifiedExplanation":"string"}`,

  recommendation: `You are a clinical AI assistant. Based on the patient's risk profile and vitals, provide 3-5 prioritised, actionable recommendations for the clinician. Respond with plain text — no JSON.`,

  summary: `You are a clinical AI. Summarise the medical record in under 120 words. Highlight abnormal findings, key diagnoses, and urgent action items.`,

  chat: `You are MediMind AI, an advanced clinical assistant for doctors. Be concise, professional, and always note AI suggestions should be verified by clinical judgment. Use markdown formatting.`,

  general: `You are MediMind AI, a helpful and concise clinical assistant.`,
};

function extractJSON(raw: string): string {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

// ─── Groq (api.groq.com) — primary ─────────────────────────────────────────

async function callGroq(messages: Message[], mode: AIMode): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("VITE_GROK_API_KEY not configured");

  const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;
  const groqMessages = [
    { role: "system", content: system },
    ...messages.map((m) => ({
      role: m.role === "model" ? "assistant" : m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: groqMessages,
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Groq error (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Gemini direct call (fallback) ───────────────────────────────────────────

async function callGemini(messages: Message[], mode: AIMode): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY not configured");

  const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
  for (const model of models) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    }
    const status = resp.status;
    console.warn(`[gemini] ${model} → ${status}`);
    if (status !== 429 && status !== 503) break;
  }
  throw new Error("Gemini API unavailable");
}

// ─── Edge Function last-resort ───────────────────────────────────────────────

async function callEdgeFunction(messages: Message[], mode: AIMode): Promise<string> {
  const { data, error } = await supabase.functions.invoke("medimind-ai", {
    body: { messages, mode },
  });
  if (error) throw new Error(error.message ?? "Edge function unavailable");
  if (data?.error) throw new Error(data.error as string);
  return (data?.content as string) ?? "";
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function callAI(messages: Message[], mode: AIMode = "chat"): Promise<string> {
  const errors: string[] = [];

  // 1. Groq — primary (free, fast, reliable)
  try {
    const raw = await callGroq(messages, mode);
    return mode === "chat" ? raw : extractJSON(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Groq: ${msg}`);
    console.warn("[AI] Groq failed:", msg);
  }

  // 2. Gemini — fallback
  try {
    const raw = await callGemini(messages, mode);
    return mode === "chat" ? raw : extractJSON(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Gemini: ${msg}`);
    console.warn("[AI] Gemini failed:", msg);
  }

  // 3. Edge Function — last resort
  try {
    const raw = await callEdgeFunction(messages, mode);
    return mode === "chat" ? raw : extractJSON(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Edge: ${msg}`);
  }

  throw new Error("AI service unavailable. " + errors.join(" | "));
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

export async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Message[];
  onDelta: (t: string) => void;
  onDone: () => void;
}) {
  // Groq streaming (OpenAI-compatible SSE)
  if (GROQ_API_KEY) {
    try {
      const system = SYSTEM_PROMPTS.chat;
      const groqMessages = [
        { role: "system", content: system },
        ...messages.map((m) => ({
          role: m.role === "model" ? "assistant" : m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          stream: true,
          temperature: 0.4,
          max_tokens: 2048,
        }),
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).replace(/\r$/, "");
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const chunk = line.slice(5).trim();
            if (chunk === "[DONE]") { onDone(); return; }
            try {
              const p = JSON.parse(chunk);
              const t = p?.choices?.[0]?.delta?.content as string | undefined;
              if (t) onDelta(t);
            } catch { /* skip */ }
          }
        }
        onDone();
        return;
      }
    } catch (e) {
      console.warn("[AI] Groq streaming failed, falling back:", e);
    }
  }

  // Gemini streaming fallback
  if (GEMINI_API_KEY) {
    try {
      const system = SYSTEM_PROMPTS.chat;
      const contents = messages.map((m) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
          }),
        }
      );
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).replace(/\r$/, "");
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const chunk = line.slice(5).trim();
            if (!chunk || chunk === "[DONE]") continue;
            try {
              const parsed = JSON.parse(chunk);
              const text = parsed?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
              if (text) onDelta(text);
            } catch { /* skip */ }
          }
        }
        onDone();
        return;
      }
    } catch (e) {
      console.warn("[AI] Gemini streaming failed:", e);
    }
  }

  // Fallback: edge function then non-streaming
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/medimind-ai`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey":        SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ messages, mode: "chat" }),
    });
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data: ")) continue;
          const chunk = line.slice(6).trim();
          if (chunk === "[DONE]") { onDone(); return; }
          try {
            const p = JSON.parse(chunk);
            const t = p?.choices?.[0]?.delta?.content as string | undefined;
            if (t) onDelta(t);
          } catch { /* skip */ }
        }
      }
      onDone();
      return;
    }
  } catch { /* ignore */ }

  // Absolute last resort
  try {
    const text = await callAI(messages, "chat");
    onDelta(text);
  } catch {
    onDelta("⚠️ AI service unavailable. Please check your API keys.");
  }
  onDone();
}

// ─── Translation ─────────────────────────────────────────────────────────────

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: { text, target_language: targetLanguage },
  });
  if (error) throw new Error(error.message ?? "Translation service unavailable");
  if (data?.error) throw new Error(data.error as string);
  return extractJSON((data?.translated_text as string) ?? "");
}
