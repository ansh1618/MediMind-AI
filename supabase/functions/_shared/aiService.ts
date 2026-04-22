/**
 * @deprecated This file is no longer used.
 *
 * All shared AI logic for Supabase Edge Functions is in `_shared/gemini.ts`.
 *
 * - `geminiGenerate()` — non-streaming Gemini calls
 * - `geminiStream()`   — SSE streaming Gemini calls with OpenAI-compatible format
 *
 * Consumers:
 *   - medimind-ai/index.ts
 *   - extract-record/index.ts
 *   - extract-image/index.ts
 */
export {};