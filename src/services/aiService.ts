/**
 * AI service — routes ALL requests through the `medimind-ai` Supabase Edge Function.
 * No direct browser calls to Gemini/Grok; avoids CORS issues and key exposure.
 *
 * Supported modes (must match the server-side VALID_MODES in medimind-ai/index.ts):
 *   "chat" | "diagnosis" | "report" | "recommendation" | "summary" | "general"
 */
import { supabase } from "@/integrations/supabase/client";

export type AITask =
  | "symptoms"      // maps → "diagnosis"
  | "diagnosis"     // maps → "diagnosis"
  | "summary"       // maps → "summary"
  | "recommendation"// maps → "recommendation"
  | "report"        // maps → "report"
  | "general";      // maps → "general"

export interface AIRequest {
  task: AITask;
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
}

/** Map frontend task names to medimind-ai server-side modes */
const TASK_TO_MODE: Record<AITask, string> = {
  symptoms:       "diagnosis",
  diagnosis:      "diagnosis",
  summary:        "summary",
  recommendation: "recommendation",
  report:         "report",
  general:        "general",
};

export async function askGemini(req: AIRequest): Promise<AIResponse> {
  const mode = TASK_TO_MODE[req.task] ?? "general";

  const userContent =
    req.context && Object.keys(req.context).length > 0
      ? `${req.prompt}\n\nContext:\n${JSON.stringify(req.context, null, 2)}`
      : req.prompt;

  const { data, error } = await supabase.functions.invoke("medimind-ai", {
    body: {
      messages: [{ role: "user", content: userContent }],
      mode,
    },
  });

  if (error) throw new Error(error.message ?? "AI service unavailable");
  if (data?.error) throw new Error(data.error as string);
  return { text: (data?.content as string) ?? "" };
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const analyzeSymptoms = (
  symptoms: string,
  vitals?: Record<string, number>,
) => askGemini({ task: "symptoms", prompt: symptoms, context: vitals ? { vitals } : undefined });

export const generateMedicalSummary = (record: Record<string, unknown>) =>
  askGemini({
    task: "summary",
    prompt: "Summarize the following medical record for a clinician.",
    context: record,
  });

export const generateRecommendations = (input: {
  riskLevel: "Low" | "Medium" | "High";
  riskScore: number;
  vitals: Record<string, number>;
  symptoms?: string;
}) =>
  askGemini({
    task: "recommendation",
    prompt: "Provide clinical recommendations based on this patient risk profile.",
    context: input,
  });
