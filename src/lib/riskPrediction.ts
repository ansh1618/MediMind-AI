/**
 * Risk prediction engine — pure, deterministic, client-side.
 * Inputs: blood pressure, glucose, heart rate (+ optional age).
 * Output: 0-100 score, Low/Medium/High level, human explanation.
 */

export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskInput {
  systolicBP: number;        // mmHg
  diastolicBP: number;       // mmHg
  glucose: number;           // mg/dL (fasting)
  heartRate: number;         // bpm
  age?: number;
}

export interface RiskResult {
  score: number;             // 0-100
  level: RiskLevel;
  explanation: string[];     // bullet points
}

export function predictRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;

  // ---- Blood pressure ----
  if (input.systolicBP >= 180 || input.diastolicBP >= 120) {
    score += 35; reasons.push(`Hypertensive crisis (${input.systolicBP}/${input.diastolicBP} mmHg)`);
  } else if (input.systolicBP >= 140 || input.diastolicBP >= 90) {
    score += 20; reasons.push(`Stage 2 hypertension (${input.systolicBP}/${input.diastolicBP} mmHg)`);
  } else if (input.systolicBP >= 130 || input.diastolicBP >= 80) {
    score += 10; reasons.push(`Stage 1 hypertension (${input.systolicBP}/${input.diastolicBP} mmHg)`);
  } else if (input.systolicBP < 90 || input.diastolicBP < 60) {
    score += 15; reasons.push(`Hypotension (${input.systolicBP}/${input.diastolicBP} mmHg)`);
  } else {
    reasons.push(`Blood pressure within normal range (${input.systolicBP}/${input.diastolicBP} mmHg)`);
  }

  // ---- Glucose ----
  if (input.glucose >= 200) {
    score += 30; reasons.push(`Critically high fasting glucose (${input.glucose} mg/dL)`);
  } else if (input.glucose >= 126) {
    score += 20; reasons.push(`Diabetic range glucose (${input.glucose} mg/dL)`);
  } else if (input.glucose >= 100) {
    score += 10; reasons.push(`Pre-diabetic glucose (${input.glucose} mg/dL)`);
  } else if (input.glucose < 70) {
    score += 15; reasons.push(`Hypoglycemia (${input.glucose} mg/dL)`);
  } else {
    reasons.push(`Glucose within normal range (${input.glucose} mg/dL)`);
  }

  // ---- Heart rate ----
  if (input.heartRate >= 120) {
    score += 20; reasons.push(`Severe tachycardia (${input.heartRate} bpm)`);
  } else if (input.heartRate >= 100) {
    score += 10; reasons.push(`Tachycardia (${input.heartRate} bpm)`);
  } else if (input.heartRate < 50) {
    score += 15; reasons.push(`Bradycardia (${input.heartRate} bpm)`);
  } else {
    reasons.push(`Heart rate within normal range (${input.heartRate} bpm)`);
  }

  // ---- Age modifier ----
  if (input.age && input.age >= 65) {
    score += 5; reasons.push(`Age ${input.age} — elevated baseline risk`);
  }

  const finalScore = Math.min(100, Math.max(0, score));
  let level: RiskLevel = "Low";
  if (finalScore >= 60) level = "High";
  else if (finalScore >= 30) level = "Medium";

  return { score: finalScore, level, explanation: reasons };
}
