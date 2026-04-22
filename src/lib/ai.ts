/**
 * AI gateway — routes ALL requests through Supabase Edge Functions (medimind-ai / translate).
 * No direct browser calls to Gemini or Grok — avoids CORS issues, rate limits, and key exposure.
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL       = import.meta.env.VITE_SUPABASE_URL       as string;
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY  as string;

export type AIMode = "chat" | "diagnosis" | "report";
interface Message { role: "user" | "assistant"; content: string; }

function extractJSON(raw: string): string {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

// ─── Non-streaming (Diagnosis / Reports) ────────────────────────────────────

export async function callAI(messages: Message[], mode: AIMode = "chat"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("medimind-ai", {
    body: { messages, mode },
  });
  if (error) throw new Error(error.message ?? "AI service unavailable");
  if (data?.error) throw new Error(data.error as string);
  const raw = (data?.content as string) ?? "";
  return mode === "chat" ? raw : extractJSON(raw);
}

// ─── Streaming (AI Assistant / Chat) ────────────────────────────────────────

export async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Message[];
  onDelta: (t: string) => void;
  onDone: () => void;
}) {
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
      const dec    = new TextDecoder();
      let   buf    = "";

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
          } catch { /* skip non-JSON SSE */ }
        }
      }
      onDone();
      return;
    }

    // Streaming response not OK — fall through to non-streaming fallback
    console.warn("[AI] Streaming response not OK, trying non-streaming fallback");
  } catch (streamErr) {
    console.warn("[AI] Streaming fetch failed, trying non-streaming fallback:", streamErr);
  }

  // Non-streaming fallback via supabase.functions.invoke
  const text = await callAI(messages, "chat");
  onDelta(text);
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
