/**
 * Shared Gemini API helper for Supabase Edge Functions.
 * Imported by: extract-image, extract-record
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = "gemini-2.0-flash";
export const VISION_MODEL  = "gemini-2.0-flash";   // supports inline images
export const FALLBACK_MODEL = "gemini-1.5-flash";

// ---- Types ----------------------------------------------------------------

interface TextPart        { type: "text";      text: string }
interface ImageUrlPart    { type: "image_url"; image_url: { url: string } }
type ContentPart = TextPart | ImageUrlPart;

export interface GeminiMessage {
  role: "user" | "model" | "assistant";
  /** Either a plain string or an OpenAI-style content array */
  content: string | ContentPart[];
}

export interface GeminiOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// ---- Converters -----------------------------------------------------------

/** Convert an OpenAI-style content item to a Gemini Part */
function toPart(item: ContentPart): Record<string, unknown> {
  if (item.type === "text") {
    return { text: item.text };
  }
  // image_url — expect "data:<mime>;base64,<data>"
  const url = item.image_url.url;
  const match = url.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { inline_data: { mime_type: match[1], data: match[2] } };
  }
  // External URL — pass as text (Gemini can't fetch external URLs in this API)
  return { text: `[Image URL: ${url}]` };
}

/** Convert our message array to the Gemini `contents` format */
function toContents(messages: GeminiMessage[]) {
  return messages
    .filter((m) => m.role !== "model" || true)   // keep all
    .map((m) => {
      const role: "user" | "model" =
        m.role === "assistant" || m.role === "model" ? "model" : "user";

      if (typeof m.content === "string") {
        return { role, parts: [{ text: m.content }] };
      }
      return { role, parts: m.content.map(toPart) };
    });
}

// ---- Core fetch -----------------------------------------------------------

async function fetchGemini(
  model: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY env var is not set");

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---- Public API -----------------------------------------------------------

/**
 * Call Gemini and return the generated text.
 * Automatically falls back to FALLBACK_MODEL on 404 / 429 / 503.
 */
export async function geminiGenerate(
  messages: GeminiMessage[],
  opts: GeminiOptions = {},
): Promise<string> {
  const contents = toContents(messages);
  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature:     opts.temperature     ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  };

  if (opts.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  const models = [opts.model ?? DEFAULT_MODEL, FALLBACK_MODEL];

  for (const model of models) {
    const resp = await fetchGemini(model, requestBody);

    if (resp.ok) {
      const data = await resp.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      return text;
    }

    const errText = await resp.text().catch(() => "");
    console.error(`[gemini] ${model} → ${resp.status}:`, errText.slice(0, 300));

    // Only retry on quota / not-found errors
    if (resp.status !== 429 && resp.status !== 503 && resp.status !== 404) {
      throw Object.assign(
        new Error(`Gemini error (${resp.status}): ${errText.slice(0, 200)}`),
        { status: resp.status },
      );
    }
  }

  throw Object.assign(new Error("All Gemini models failed"), { status: 500 });
}

// ---- Streaming API --------------------------------------------------------

/**
 * Call Gemini's streamGenerateContent endpoint and return a ReadableStream
 * that emits OpenAI-compatible SSE: `data: {"choices":[{"delta":{"content":"…"}}]}\n\n`
 * so the existing frontend SSE reader works without changes.
 *
 * Falls back to a non-streaming geminiGenerate call if streaming fails.
 */
export async function geminiStream(
  messages: GeminiMessage[],
  opts: GeminiOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY env var is not set");

  const contents = toContents(messages);
  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature:     opts.temperature     ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  };
  if (opts.systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    console.error("[gemini stream] Network error, falling back to non-stream:", networkErr);
    // Fallback: call non-streaming and return as a single-chunk stream
    const text = await geminiGenerate(messages, opts);
    const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode(chunk));
        ctrl.close();
      },
    });
  }

  if (!resp.ok || !resp.body) {
    console.error(`[gemini stream] ${model} → ${resp.status}, falling back to non-stream`);
    const text = await geminiGenerate(messages, opts);
    const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode(chunk));
        ctrl.close();
      },
    });
  }

  // Re-wrap Gemini SSE → OpenAI-compatible SSE on the fly
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader  = resp.body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const text: string =
              parsed?.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text ?? "")
                .join("") ?? "";
            if (text) {
              const openai = JSON.stringify({ choices: [{ delta: { content: text } }] });
              controller.enqueue(encoder.encode(`data: ${openai}\n\n`));
            }
          } catch {
            // Non-JSON SSE line — skip safely
          }
        }
      } catch (err) {
        console.error("[gemini stream] pull error:", err);
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
