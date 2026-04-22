import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// 1. Input validation
// ──────────────────────────────────────────────
interface PatientInput {
  age: number;
  gender: string;
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  glucose_level: number;
  heart_rate: number;
  symptoms: string;
  // Optional enrichment fields
  hba1c?: number;
  creatinine?: number;
  ldl_cholesterol?: number;
  egfr?: number;
  bmi?: number;
  family_history?: string;
  medications?: string[];
}

function validate(body: unknown): { ok: true; data: PatientInput } | { ok: false; error: string } {
  const b = body as Record<string, unknown>;
  const required = ["age", "gender", "blood_pressure_systolic", "blood_pressure_diastolic", "glucose_level", "heart_rate", "symptoms"];
  for (const f of required) {
    if (b[f] === undefined || b[f] === null) return { ok: false, error: `Missing required field: ${f}` };
  }
  if (typeof b.age !== "number" || b.age < 0 || b.age > 150) return { ok: false, error: "age must be 0-150" };
  if (typeof b.blood_pressure_systolic !== "number") return { ok: false, error: "blood_pressure_systolic must be a number" };
  if (typeof b.blood_pressure_diastolic !== "number") return { ok: false, error: "blood_pressure_diastolic must be a number" };
  if (typeof b.glucose_level !== "number") return { ok: false, error: "glucose_level must be a number" };
  if (typeof b.heart_rate !== "number") return { ok: false, error: "heart_rate must be a number" };
  if (typeof b.symptoms !== "string" || b.symptoms.trim().length === 0) return { ok: false, error: "symptoms must be a non-empty string" };
  return { ok: true, data: b as unknown as PatientInput };
}

// ──────────────────────────────────────────────
// 2. Rule-based risk prediction engine
// ──────────────────────────────────────────────
interface RiskResult {
  risk_level: "Low" | "Medium" | "High";
  risk_score: number; // 0-100
  explanation: string[];
  risk_breakdown: {
    diabetes: { score: number; level: string };
    cardiac: { score: number; level: string };
    renal: { score: number; level: string };
  };
}

function predictRisk(p: PatientInput): RiskResult {
  const reasons: string[] = [];
  let totalScore = 0;


  // --- Diabetes risk ---
  let diabetesScore = 0;
  if (p.glucose_level > 200) { diabetesScore += 40; reasons.push("Critically high glucose level (>200 mg/dL)"); }
  else if (p.glucose_level > 140) { diabetesScore += 25; reasons.push("Elevated fasting glucose (>140 mg/dL)"); }
  else if (p.glucose_level > 100) { diabetesScore += 10; reasons.push("Borderline glucose level (>100 mg/dL)"); }

  if (p.hba1c !== undefined) {
    if (p.hba1c > 8) { diabetesScore += 35; reasons.push(`Very high HbA1c (${p.hba1c}%)`); }
    else if (p.hba1c > 6.5) { diabetesScore += 20; reasons.push(`Elevated HbA1c (${p.hba1c}%)`); }
  }

  if (p.bmi !== undefined && p.bmi > 30) { diabetesScore += 10; reasons.push("Obesity (BMI > 30)"); }
  if (p.age > 45) { diabetesScore += 5; }
  diabetesScore = Math.min(diabetesScore, 100);

  // --- Cardiac risk ---
  let cardiacScore = 0;
  if (p.blood_pressure_systolic > 160) { cardiacScore += 35; reasons.push("Severely elevated systolic BP (>160)"); }
  else if (p.blood_pressure_systolic > 140) { cardiacScore += 20; reasons.push("High systolic blood pressure (>140)"); }
  else if (p.blood_pressure_systolic > 130) { cardiacScore += 10; reasons.push("Elevated systolic BP (>130)"); }

  if (p.blood_pressure_diastolic > 100) { cardiacScore += 15; reasons.push("High diastolic BP (>100)"); }
  else if (p.blood_pressure_diastolic > 90) { cardiacScore += 8; }

  if (p.heart_rate > 100) { cardiacScore += 15; reasons.push("Elevated heart rate (tachycardia)"); }
  else if (p.heart_rate < 50) { cardiacScore += 10; reasons.push("Low heart rate (bradycardia)"); }

  if (p.ldl_cholesterol !== undefined && p.ldl_cholesterol > 130) { cardiacScore += 15; reasons.push(`High LDL cholesterol (${p.ldl_cholesterol} mg/dL)`); }
  if (p.age > 55) { cardiacScore += 5; }
  cardiacScore = Math.min(cardiacScore, 100);

  // --- Renal risk ---
  let renalScore = 0;
  if (p.creatinine !== undefined) {
    if (p.creatinine > 2.0) { renalScore += 40; reasons.push(`High creatinine (${p.creatinine} mg/dL)`); }
    else if (p.creatinine > 1.3) { renalScore += 20; reasons.push(`Borderline creatinine (${p.creatinine} mg/dL)`); }
  }
  if (p.egfr !== undefined) {
    if (p.egfr < 30) { renalScore += 40; reasons.push(`Severely reduced eGFR (${p.egfr})`); }
    else if (p.egfr < 60) { renalScore += 20; reasons.push(`Reduced eGFR (${p.egfr}) — Stage 2-3 CKD`); }
  }
  // Hypertension contributes to renal risk
  if (p.blood_pressure_systolic > 140) renalScore += 10;
  renalScore = Math.min(renalScore, 100);

  // Composite score (weighted average)
  totalScore = Math.round(diabetesScore * 0.4 + cardiacScore * 0.35 + renalScore * 0.25);

  const level = (s: number) => s >= 70 ? "CRITICAL" : s >= 50 ? "HIGH" : s >= 30 ? "MODERATE" : "LOW";

  const risk_level: RiskResult["risk_level"] =
    totalScore >= 60 ? "High" : totalScore >= 30 ? "Medium" : "Low";

  if (reasons.length === 0) reasons.push("All vitals and lab values within normal range");

  return {
    risk_level,
    risk_score: totalScore,
    explanation: reasons,
    risk_breakdown: {
      diabetes: { score: diabetesScore, level: level(diabetesScore) },
      cardiac: { score: cardiacScore, level: level(cardiacScore) },
      renal: { score: renalScore, level: level(renalScore) },
    },
  };
}

// ──────────────────────────────────────────────
// 3. Gemini-powered summary & recommendations
// ──────────────────────────────────────────────
async function geminiInsights(patient: PatientInput, risk: RiskResult): Promise<{ summary: string; recommendations: string[] }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { summary: "AI summary unavailable (GEMINI_API_KEY not configured)", recommendations: [] };

  const prompt = `You are a medical AI assistant. Given the patient data and risk assessment below, provide:
1. A concise 2-3 sentence clinical summary of the patient's condition.
2. A list of 3-5 actionable, doctor-friendly recommendations (not medical advice, support only).

Patient Data:
- Age: ${patient.age}, Gender: ${patient.gender}
- BP: ${patient.blood_pressure_systolic}/${patient.blood_pressure_diastolic} mmHg
- Glucose: ${patient.glucose_level} mg/dL, Heart Rate: ${patient.heart_rate} bpm
${patient.hba1c ? `- HbA1c: ${patient.hba1c}%` : ""}
${patient.creatinine ? `- Creatinine: ${patient.creatinine} mg/dL` : ""}
${patient.ldl_cholesterol ? `- LDL: ${patient.ldl_cholesterol} mg/dL` : ""}
${patient.egfr ? `- eGFR: ${patient.egfr} mL/min` : ""}
${patient.bmi ? `- BMI: ${patient.bmi}` : ""}
- Symptoms: ${patient.symptoms}
${patient.family_history ? `- Family History: ${patient.family_history}` : ""}
${patient.medications?.length ? `- Medications: ${patient.medications.join(", ")}` : ""}

Risk Assessment:
- Overall: ${risk.risk_level} (${risk.risk_score}/100)
- Diabetes: ${risk.risk_breakdown.diabetes.level} (${risk.risk_breakdown.diabetes.score})
- Cardiac: ${risk.risk_breakdown.cardiac.level} (${risk.risk_breakdown.cardiac.score})
- Renal: ${risk.risk_breakdown.renal.level} (${risk.risk_breakdown.renal.score})

Respond ONLY with valid JSON: {"summary":"...","recommendations":["..."]}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are a clinical decision-support AI. Return valid JSON only." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!resp.ok) {
      console.error("Gemini error:", resp.status, await resp.text());
      return { summary: "AI summary temporarily unavailable", recommendations: [] };
    }

    const data = await resp.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
    const jsonStr = content.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    const clean = start !== -1 && end > start ? jsonStr.slice(start, end + 1) : jsonStr;
    return JSON.parse(clean);
  } catch (e) {
    console.error("Gemini parse error:", e);
    return { summary: "Could not generate AI summary", recommendations: [] };
  }
}

// ──────────────────────────────────────────────
// 4. HTTP handler
// ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const validation = validate(body);
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient = validation.data;

    // Rule-based prediction
    const risk = predictRisk(patient);

    // AI-powered insights (runs in parallel conceptually but awaited)
    const insights = await geminiInsights(patient, risk);

    const response = {
      risk_level: risk.risk_level,
      risk_score: risk.risk_score,
      explanation: risk.explanation,
      risk_breakdown: risk.risk_breakdown,
      ai_summary: insights.summary,
      recommendations: insights.recommendations,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Prediction failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
