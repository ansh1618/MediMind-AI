import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, CheckCircle, AlertTriangle, FileUp, X, Beaker, Languages, Volume2, Square } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callAI, translateText } from "@/lib/ai";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

const LANGUAGES = [
  { code: "English", label: "🇬🇧 English" },
  { code: "Hindi", label: "🇮🇳 हिन्दी" },
  { code: "Spanish", label: "🇪🇸 Español" },
  { code: "French", label: "🇫🇷 Français" },
  { code: "Mandarin Chinese", label: "🇨🇳 中文" },
  { code: "Arabic", label: "🇸🇦 العربية" },
  { code: "Bengali", label: "🇧🇩 বাংলা" },
  { code: "Tamil", label: "🇮🇳 தமிழ்" },
];

interface ReportAnalysis {
  title: string;
  summary: string;
  keyFindings: { finding: string; status: "normal" | "abnormal" | "critical" }[];
  simplifiedExplanation: string;
}

const statusConfig = {
  normal:   { icon: CheckCircle,   color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  abnormal: { icon: AlertTriangle, color: "text-orange-500",  badge: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  critical: { icon: AlertTriangle, color: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
};

const demoReports = [
  {
    label: "Diabetic — Sunita Devi",
    text: `Patient: Sunita Devi, 58F
Fasting Blood Sugar: 186 mg/dL (H), HbA1c: 9.4% (H)
Serum Creatinine: 1.6 mg/dL (H), eGFR: 48 mL/min (L)
Total Cholesterol: 242 mg/dL (H), LDL: 162 mg/dL (H), HDL: 38 mg/dL (L)
Urine Albumin: 180 mg/L (H) — microalbuminuria
BP: 148/92 mmHg. BMI: 31.5
Fundoscopy: Early diabetic retinopathy noted.
Currently on Metformin 1g BD, Glimepiride 2mg OD.`,
  },
  {
    label: "Cardiac — Rajesh Sharma",
    text: `Patient: Rajesh Sharma, 62M
Troponin I: 0.85 ng/mL (H), CK-MB: 42 U/L (H)
BNP: 820 pg/mL (H), D-Dimer: 0.8 µg/mL (borderline)
ECG: ST elevation in leads II, III, aVF — inferior STEMI pattern
Echocardiogram: EF 38% (reduced), inferior wall hypokinesia
Total Cholesterol: 268 mg/dL (H), LDL: 178 mg/dL (H)
BP: 165/98 mmHg, HR: 108 bpm
History: Hypertension 15 yrs, smoker 30 pack-years.`,
  },
  {
    label: "Respiratory — Mohan Patel",
    text: `Patient: Mohan Patel, 71M
ABG: pH 7.31 (L), pCO2 58 mmHg (H), pO2 55 mmHg (L), HCO3 28 (H)
SpO2: 86% on room air
WBC: 14,200/µL (H), Neutrophils: 82% (H)
CRP: 86 mg/L (H), Procalcitonin: 2.4 ng/mL (H)
Chest X-ray: Bilateral lower lobe infiltrates with air bronchograms
Sputum Culture: Gram-negative rods, pending sensitivity
FEV1: 42% predicted (severe obstruction)
Currently on COPD triple therapy, started IV Piperacillin-Tazobactam.`,
  },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<ReportAnalysis | null>(null);
  const [originalReport, setOriginalReport] = useState<ReportAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [language, setLanguage] = useState("English");
  const [reportText, setReportText] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { speak, stop, speaking, supported: ttsSupported } = useSpeechSynthesis();

  const readAloud = () => {
    if (!selectedReport) return;
    if (speaking) return stop();
    const text = `${selectedReport.title}. ${selectedReport.summary}. Key findings: ${selectedReport.keyFindings
      .map((f) => `${f.finding}, status ${f.status}`)
      .join(". ")}. Plain language explanation: ${selectedReport.simplifiedExplanation}`;
    speak(text, language);
  };

  const translateReport = async (target: string) => {
    setLanguage(target);
    if (!originalReport) return;
    if (target === "English") {
      setSelectedReport(originalReport);
      return;
    }
    setTranslating(true);
    try {
      const cleaned = await translateText(JSON.stringify(originalReport), target);
      setSelectedReport(JSON.parse(cleaned) as ReportAnalysis);
      toast({ title: `Translated to ${target}` });
    } catch (e) {
      toast({ title: "Translation failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      setLanguage("English");
    } finally {
      setTranslating(false);
    }
  };

  const analyzeText = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setSelectedReport(null);
    setOriginalReport(null);
    setLanguage("English");
    try {
      const response = await callAI(
        [{ role: "user", content: `Analyze this medical report and provide findings:\n\n${text}` }],
        "report"
      );
      // callAI already runs extractJSON — parse directly
      let parsed: ReportAnalysis;
      try {
        parsed = JSON.parse(response) as ReportAnalysis;
      } catch {
        const m = response.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI did not return valid JSON. Response: " + response.slice(0, 200));
        parsed = JSON.parse(m[0]) as ReportAnalysis;
      }
      parsed.keyFindings ??= [];
      setSelectedReport(parsed);
      setOriginalReport(parsed);
    } catch (e) {
      console.error("Report analysis error:", e);
      toast({ title: "Analysis Failed", description: e instanceof Error ? e.message : "Unable to analyze report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSelectedReport(null);
    setOriginalReport(null);

    // Plain text files — read directly
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".csv")) {
      const text = await file.text();
      setReportText(text);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // PDF or image — extract text via AI Vision then auto-analyze
    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
      setLoading(true);
      setReportText("");
      try {
        const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
        const GROQ_KEY = import.meta.env.VITE_GROK_API_KEY as string;
        const dataUrl = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1];

        const EXTRACT_PROMPT = "You are a medical document OCR engine. Extract ALL text from this document exactly as written — preserve lab values, numbers, units, doctor notes, dates, and patient info. Return only the extracted plain text, no markdown, no commentary.";

        let extractedText = "";

        // ── For IMAGES: Try Groq vision FIRST (most reliable) ──
        if (file.type.startsWith("image/") && GROQ_KEY && !extractedText) {
          try {
            const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
              body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [{ role: "user", content: [
                  { type: "text", text: EXTRACT_PROMPT },
                  { type: "image_url", image_url: { url: dataUrl } },
                ]}],
                temperature: 0.0, max_tokens: 8192,
              }),
            });
            const data = await resp.json();
            if (resp.ok) {
              extractedText = data?.choices?.[0]?.message?.content ?? "";
              if (extractedText.trim()) console.log("[reports] Groq vision success");
            } else {
              console.warn("[reports] Groq vision error:", data?.error?.message);
            }
          } catch (e) { console.warn("[reports] Groq vision threw:", e); }
        }

        // ── Gemini fallback (PDF + images) ──
        if (!extractedText && GEMINI_KEY) {
          for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
            try {
              const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts: [
                      { text: EXTRACT_PROMPT },
                      { inline_data: { mime_type: file.type, data: base64 } },
                    ]}],
                    generationConfig: { temperature: 0.0, maxOutputTokens: 8192 },
                  }),
                }
              );
              const data = await resp.json();
              if (resp.ok) {
                extractedText = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
                if (extractedText.trim()) { console.log(`[reports] ${model} success`); break; }
              } else {
                console.warn(`[reports] ${model} error:`, data?.error?.message);
              }
            } catch (e) { console.warn(`[reports] ${model} threw:`, e); }
          }
        }

        if (!extractedText.trim()) {
          throw new Error("Could not extract text from the file. Please paste the report text manually.");
        }

        setReportText(extractedText);
        toast({ title: "✅ File extracted!", description: `Text extracted from ${file.name}. Running AI analysis...` });

        // Auto-analyze the extracted text
        await analyzeText(extractedText);

      } catch (err) {
        toast({ title: "Extraction failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    toast({ title: "Unsupported file", description: "Please upload a TXT, PDF, or image file.", variant: "destructive" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const clearAll = () => {
    setReportText("");
    setFileName("");
    setSelectedReport(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Medical Report Analyzer</h1>
              <p className="text-sm text-muted-foreground">Upload or paste reports — AI simplifies into plain language</p>
            </div>
          </div>
        </motion.div>

        {/* Demo report pills */}
        <div className="flex flex-wrap gap-2">
          {demoReports.map((d) => (
            <button
              key={d.label}
              onClick={() => { setReportText(d.text); setSelectedReport(null); setFileName(""); }}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Beaker className="w-3 h-3" />
              {d.label}
            </button>
          ))}
        </div>

        {/* Upload & Paste */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="rounded-lg border border-dashed border-border p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.pdf,image/*" className="hidden" onChange={handleFileUpload} />
            <FileUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">{fileName || "Click to upload a report file"}</p>
            <p className="text-xs text-muted-foreground mt-1">TXT, PDF, or image — or paste text below</p>
          </div>
          <Textarea
            placeholder="Or paste the medical report content here..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            className="min-h-[120px] resize-none border-0 bg-muted/20 rounded-lg p-3 text-sm focus-visible:ring-0 placeholder:text-muted-foreground/50 font-mono"
          />
          <div className="flex items-center justify-between">
            {(reportText || selectedReport) && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button onClick={() => analyzeText(reportText)} disabled={!reportText.trim() || loading} className="gradient-primary text-primary-foreground border-0 text-xs px-4" size="sm">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                Analyze Report
              </Button>
            </div>
          </div>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-border bg-card p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
              <p className="text-sm font-medium">Analyzing report with AI...</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting findings and generating plain-language explanation</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {selectedReport && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Language selector — Gemini-powered translation */}
              <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <Languages className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium">Read in:</span>
                <Select value={language} onValueChange={translateReport} disabled={translating}>
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {translating && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                {ttsSupported && (
                  <Button
                    size="sm"
                    variant={speaking ? "default" : "outline"}
                    onClick={readAloud}
                    className="h-8 text-xs ml-auto"
                    aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
                  >
                    {speaking ? <Square className="w-3.5 h-3.5 mr-1.5" /> : <Volume2 className="w-3.5 h-3.5 mr-1.5" />}
                    {speaking ? "Stop" : "Read aloud"}
                  </Button>
                )}
                <span className={`text-[10px] text-muted-foreground ${ttsSupported ? "" : "ml-auto"}`}>via Gemini</span>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-1">{selectedReport.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedReport.summary}</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Key Findings</h3>
                <div className="space-y-2">
                  {selectedReport.keyFindings.map((f, i) => {
                    const key = (f.status?.toString().toLowerCase() as keyof typeof statusConfig);
                    const cfg = statusConfig[key] ?? statusConfig.normal;
                    const Icon = cfg.icon;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                        <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                        <span className="text-sm flex-1">{f.finding}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium capitalize ${cfg.badge}`}>{f.status}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-primary/10 bg-primary/5 p-5">
                <h3 className="text-sm font-semibold text-primary mb-2">Plain Language Explanation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedReport.simplifiedExplanation}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
