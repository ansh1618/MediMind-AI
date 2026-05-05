import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, Brain, Sparkles, User as UserIcon, Camera, X, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { callAI } from "@/lib/ai";

const GROQ_API_KEY = import.meta.env.VITE_GROK_API_KEY as string;

const TEXT_SCHEMA = `{
  "patient_name":string,"age":number,"gender":string,"chief_complaint":string,
  "vitals":{"BP":string,"HR":string,"SpO2":string,"Temp":string,"RR":string,"BMI":string},
  "lab_values":{"<TestName>":{"value":string,"status":"Normal"|"High"|"Low"|"Critical"}},
  "medications":string[],"diagnoses":string[],"family_history":string,"lifestyle":string,
  "risk_scores":{"diabetes":{"score":number,"level":string,"reasoning":string},"cardiac":{"score":number,"level":string,"reasoning":string},"renal":{"score":number,"level":string,"reasoning":string}}
}`;

const EXTRACTION_PROMPT = `You are a medical NLP engine. Extract structured data from the following patient record and generate risk scores.

Return ONLY valid JSON with this exact schema:
{
  "patient_name": "string",
  "age": number,
  "gender": "string (M/F)",
  "chief_complaint": "string",
  "vitals": { "BP": "string", "HR": "string", "Weight": "string", "Height": "string", "BMI": "string", "SpO2": "string" },
  "lab_values": { "LabName": { "value": "string with units", "status": "Normal|High|Low|Critical" } },
  "medications": ["string"],
  "diagnoses": ["string"],
  "family_history": "string",
  "lifestyle": "string",
  "risk_scores": {
    "diabetes": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "cardiac": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "renal": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" }
  }
}
Risk levels: CRITICAL (>80%), HIGH (60-80%), MODERATE (40-60%), LOW (<40%). Return ONLY JSON, no extra text.`;

function extractJSONFromText(raw: string): string {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

/** Extract structured data from raw text using Groq directly */
async function geminiExtractText(rawText: string, _supabaseClient: unknown): Promise<NLPResult> {
  // Try Groq directly first
  if (GROQ_API_KEY) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: `Patient Record:\n\n${rawText}` },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content ?? "";
        return JSON.parse(extractJSONFromText(content)) as NLPResult;
      }
    } catch (e) {
      console.warn("[extract] Groq failed, falling back to callAI:", e);
    }
  }
  // Fallback: use callAI which tries Groq → Gemini → edge
  const raw = await callAI(
    [{ role: "user", content: `${EXTRACTION_PROMPT}\n\nPatient Record:\n\n${rawText}` }],
    "general"
  );
  return JSON.parse(extractJSONFromText(raw)) as NLPResult;
}

/** Extract structured data from an image — tries Gemini Vision → Groq Vision → error */
async function geminiExtractImage(base64: string, mimeType: string, _supabaseClient: unknown): Promise<NLPResult & { raw_ocr_text?: string }> {
  const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
  const GROQ_KEY = import.meta.env.VITE_GROK_API_KEY as string;

  // ── 1. Try Gemini Vision models ─────────────────────────────────────────
  const buildGeminiBody = (model: string) => JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        { text: EXTRACTION_PROMPT + "\n\nExtract all medical data from this document image and return ONLY valid JSON:" },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  });

  if (GEMINI_KEY) {
    for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: buildGeminiBody(model) }
        );
        const data = await resp.json();
        if (!resp.ok) { console.warn(`[vision] ${model} API error:`, data?.error?.message); continue; }
        const content = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
        if (!content) { console.warn(`[vision] ${model} empty response`); continue; }
        const result = JSON.parse(extractJSONFromText(content)) as NLPResult;
        return { ...result, raw_ocr_text: content };
      } catch (e) { console.warn(`[vision] ${model} threw:`, e); }
    }
  }

  // ── 2. Try Groq Vision (llama-4-scout supports vision) ──────────────────
  if (GROQ_KEY) {
    try {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT + "\n\nExtract all medical data from this document image and return ONLY valid JSON:" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          }],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        const content = data?.choices?.[0]?.message?.content ?? "";
        if (content) {
          const result = JSON.parse(extractJSONFromText(content)) as NLPResult;
          return { ...result, raw_ocr_text: content };
        }
      } else {
        console.warn("[vision] Groq vision error:", data?.error?.message);
      }
    } catch (e) { console.warn("[vision] Groq vision threw:", e); }
  }

  throw new Error("Vision extraction failed. Please paste the record text manually in the box below.");
}



const DEMO_RECORD = `Patient: Arun Nair, 61M, P-1007
Hospital: Apollo Hospitals, Bangalore
Chief Complaint: Progressive fatigue, bilateral pedal edema, reduced urine output for 2 weeks
Vitals: BP 158/98 mmHg, HR 94 bpm, Weight 78kg, Height 170cm, BMI 27.0, SpO₂ 94%, Temp 37.2°C, RR 20/min
Lab Values:
  - Serum Creatinine: 1.6 mg/dL (High)
  - eGFR: 48 mL/min/1.73m² (Low — CKD Stage 3a)
  - BUN: 28 mg/dL (High)
  - HbA1c: 6.4% (Pre-diabetic)
  - Fasting Glucose: 118 mg/dL (Borderline)
  - Albumin:Creatinine Ratio: 320 mg/g (High — A3 albuminuria)
  - Serum Potassium: 5.1 mEq/L (Borderline high)
  - Hemoglobin: 11.2 g/dL (Low)
  - LDL Cholesterol: 148 mg/dL (High)
  - Uric Acid: 8.2 mg/dL (High)
Medications: Losartan 50mg OD, Metformin 500mg BD, Amlodipine 5mg OD
Diagnoses: Chronic Kidney Disease Stage 3a, Pre-diabetes, Hypertension Stage 2, Mild Proteinuria
Family History: Mother — CKD Stage 5 (dialysis), Father — Type 2 Diabetes & Hypertension
Lifestyle: Sedentary desk job, non-vegetarian diet high in salt, occasional alcohol, non-smoker
Clinical Impression: Progressive CKD with declining eGFR trend. Risk of Stage 3b within 6 months without aggressive BP and glycemic control. Nephrology follow-up in 4 weeks.`;

interface NLPResult {
  patient_name: string;
  age: number;
  gender: string;
  chief_complaint: string;
  vitals: Record<string, string>;
  lab_values: Record<string, { value: string; status: string }>;
  medications: string[];
  diagnoses: string[];
  family_history: string;
  lifestyle: string;
  risk_scores: {
    diabetes: { score: number; level: string; reasoning: string };
    cardiac: { score: number; level: string; reasoning: string };
    renal: { score: number; level: string; reasoning: string };
  };
}

interface PredictResult {
  risk_level: string;
  risk_score: number;
  explanation: string[];
  risk_breakdown: {
    diabetes: { score: number; level: string };
    cardiac: { score: number; level: string };
    renal: { score: number; level: string };
  };
  ai_summary: string;
  recommendations: string[];
}

type PipelineStep = "idle" | "extracting" | "predicting" | "done";

export default function RecordUpload() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<PipelineStep>("idle");
  const [result, setResult] = useState<NLPResult | null>(null);
  const [prediction, setPrediction] = useState<PredictResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const progressValue = step === "extracting" ? 40 : step === "predicting" ? 75 : step === "done" ? 100 : 0;
  const progressLabel = step === "extracting" ? "Step 1/2 — Extracting medical data with Gemini AI..." : step === "predicting" ? "Step 2/2 — Running risk prediction & AI recommendations..." : "";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image (JPG, PNG, HEIC, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setLoading(true);
      setResult(null);
      setPrediction(null);
      setSaved(false);
      setStep("extracting");
      try {
        const parsed = await geminiExtractImage(base64, file.type, supabase);
        if (!parsed) throw new Error("No extraction result returned");
        setResult(parsed);
        setRawText(parsed.raw_ocr_text || "");
        setStep("done");
        toast({ title: "Image processed!", description: "Gemini Vision extracted the document." });
      } catch (err) {
        console.error("Vision extract error:", err);
        toast({ title: "Vision failed", description: err instanceof Error ? err.message : "Could not process image", variant: "destructive" });
        setStep("idle");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExtract = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setResult(null);
    setPrediction(null);
    setSaved(false);
    setStep("extracting");

    try {
      const parsed = await geminiExtractText(rawText, supabase);
      if (!parsed) throw new Error("No extraction result returned");
      setResult(parsed);
      setStep("done");
    } catch (e) {
      console.error("NLP extraction error:", e);
      toast({ title: "Extraction Failed", description: e instanceof Error ? e.message : "Unable to process the record", variant: "destructive" });
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !user) return;
    if (!patientEmail.trim()) {
      toast({ title: "Patient email required", description: "Enter the patient's registered email to link this record.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("patient_records").insert({
        created_by: user.id,
        patient_name: result.patient_name,
        patient_email: patientEmail.trim().toLowerCase(),
        age: result.age,
        gender: result.gender,
        chief_complaint: result.chief_complaint,
        vitals: result.vitals,
        lab_values: result.lab_values,
        medications: result.medications,
        diagnoses: result.diagnoses,
        family_history: result.family_history,
        lifestyle: result.lifestyle,
        raw_text: rawText,
        nlp_extracted_data: result as Record<string, unknown>,
        risk_scores: result.risk_scores as Record<string, unknown>,
      });
      if (error) throw error;
      setSaved(true);
      toast({ title: "Record saved!", description: `${result.patient_name}'s record linked to ${patientEmail} successfully.` });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const riskColor = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "text-destructive";
    if (level === "MODERATE") return "text-orange-500";
    return "text-emerald-500";
  };

  const riskBg = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "bg-destructive/10 border-destructive/20";
    if (level === "MODERATE") return "bg-orange-500/10 border-orange-500/20";
    return "bg-emerald-500/10 border-emerald-500/20";
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Patient Record Upload</h1>
                <p className="text-sm text-muted-foreground">Upload or paste medical records for AI extraction & risk scoring</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => { setRawText(DEMO_RECORD); setResult(null); setPrediction(null); setSaved(false); setStep("idle"); }}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Load Demo (Arun Nair)
            </Button>
          </div>
        </motion.div>

        {/* Gemini Vision: image upload */}
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Upload prescription / lab report photo</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Powered by <span className="font-medium text-primary">Gemini Vision</span> — auto-extracts text & data from images.
              </p>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Uploaded document" className="max-h-32 rounded-lg border border-border" />
                  <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Button onClick={() => fileInputRef.current?.click()} disabled={loading} variant="outline" size="sm" className="text-xs">
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  Choose image
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Textarea
            placeholder="Paste patient record text here — vitals, lab values, medications, history..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[180px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground/50 font-mono"
          />
          <div className="flex items-center justify-end mt-4 pt-3 border-t border-border">
            <Button onClick={handleExtract} disabled={!rawText.trim() || loading} className="gradient-primary text-primary-foreground border-0 text-xs px-4" size="sm">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Brain className="w-3.5 h-3.5 mr-1.5" />}
              Extract & Analyze
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{progressLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === "extracting" ? "Parsing vitals, labs, medications & generating risk scores" : "Calculating composite risk and generating clinical insights"}
                  </p>
                </div>
              </div>
              <Progress value={progressValue} className="h-2" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className={step === "extracting" ? "text-primary font-medium" : ""}>Extracting</span>
                <span className={step === "predicting" ? "text-primary font-medium" : ""}>Predicting</span>
                <span className={step === "done" ? "text-primary font-medium" : ""}>Complete</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Patient Avatar Header */}
              <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{result.patient_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {result.age}y · {result.gender} · {result.chief_complaint}
                  </p>
                  {result.diagnoses && result.diagnoses.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {result.diagnoses.map((d, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Scores */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">AI Risk Assessment</h3>
                <div className="grid grid-cols-3 gap-3">
                  {result.risk_scores && Object.entries(result.risk_scores).map(([key, risk]) => (
                    <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-lg border p-4 text-center ${riskBg(risk.level)}`}>
                      <p className="text-xs font-medium capitalize mb-1">{key} Risk</p>
                      <p className={`text-2xl font-bold ${riskColor(risk.level)}`}>{risk.score}%</p>
                      <p className={`text-xs font-semibold mt-1 ${riskColor(risk.level)}`}>{risk.level}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{risk.reasoning}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Lab Values */}
              {result.lab_values && Object.keys(result.lab_values).length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-3">Extracted Lab Values</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.lab_values).map(([name, lab]) => (
                      <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                        <span className="text-xs text-muted-foreground">{name}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          lab.status === "High" || lab.status === "Critical" ? "bg-destructive/10 text-destructive" :
                          lab.status === "Low" ? "bg-orange-500/10 text-orange-500" :
                          "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          {lab.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vitals */}
              {result.vitals && Object.keys(result.vitals).length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-3">Vitals</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(result.vitals).map(([name, value]) => (
                      <div key={name} className="rounded-lg bg-muted/30 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">{name}</p>
                        <p className="text-xs font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {prediction && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">AI Clinical Insights</h3>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      prediction.risk_level === "High" ? "bg-destructive/10 text-destructive" :
                      prediction.risk_level === "Medium" ? "bg-orange-500/10 text-orange-500" :
                      "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {prediction.risk_level} Risk · {prediction.risk_score}/100
                    </span>
                  </div>
                  {prediction.ai_summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{prediction.ai_summary}</p>
                  )}
                  {prediction.explanation.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Risk Factors</p>
                      <ul className="space-y-1">
                        {prediction.explanation.map((e, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {prediction.recommendations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Recommendations</p>
                      <ul className="space-y-1">
                        {prediction.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Patient email linkage */}
              {!saved && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Link to Patient Account</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter the patient's registered email so they can view this record in their portal.</p>
                  <Input
                    type="email"
                    placeholder="patient@email.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                {saved ? (
                  <div className="flex items-center gap-2 text-emerald-500 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Saved &amp; linked to {patientEmail}
                  </div>
                ) : (
                  <Button onClick={handleSave} className="gradient-primary text-primary-foreground border-0" size="sm">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Save &amp; Link to Patient
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
