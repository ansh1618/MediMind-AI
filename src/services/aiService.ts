/**
 * AI service — calls Gemini API directly from browser.
 * Falls back to medimind-ai edge function if direct call fails.
 */
import { callAI } from "@/lib/ai";

export type AITask =
  | "symptoms"
  | "diagnosis"
  | "summary"
  | "recommendation"
  | "report"
  | "general";

export interface AIRequest {
  task: AITask;
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
}

const TASK_TO_MODE: Record<AITask, "diagnosis" | "summary" | "recommendation" | "report" | "general" | "chat"> = {
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

  const text = await callAI([{ role: "user", content: userContent }], mode);
  return { text };
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
