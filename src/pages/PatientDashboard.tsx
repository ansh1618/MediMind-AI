import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HeartPulse, TrendingUp, Sparkles, Loader2, Upload, FileText, Save } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { predictRisk, type RiskLevel } from "@/lib/riskPrediction";
import { generateRecommendations } from "@/services/aiService";
import { supabase } from "@/integrations/supabase/client";
import VitalsHistoryChart from "@/components/dashboard/VitalsHistoryChart";
import DoctorNotesPanel from "@/components/dashboard/DoctorNotesPanel";

const levelStyles: Record<RiskLevel, { bg: string; text: string; ring: string }> = {
  Low: { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/30" },
  Medium: { bg: "bg-amber-500/10", text: "text-amber-500", ring: "ring-amber-500/30" },
  High: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/30" },
};

export default function PatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("80");
  const [glucose, setGlucose] = useState("95");
  const [hr, setHr] = useState("72");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const risk = useMemo(
    () =>
      predictRisk({
        systolicBP: Number(systolic) || 0,
        diastolicBP: Number(diastolic) || 0,
        glucose: Number(glucose) || 0,
        heartRate: Number(hr) || 0,
      }),
    [systolic, diastolic, glucose, hr],
  );

  const styles = levelStyles[risk.level];

  const saveVitals = async () => {
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in again.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const vitals = {
        systolicBP: Number(systolic),
        diastolicBP: Number(diastolic),
        glucose: Number(glucose),
        heartRate: Number(hr),
        recorded_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("patient_records").insert({
        created_by: user.id,
        linked_patient_user_id: user.id,
        patient_name: user.email ?? "Patient",
        vitals,
        risk_scores: {
          level: risk.level,
          score: risk.score,
          explanation: risk.explanation,
        },
      });
      if (error) throw error;
      toast({ title: "Saved", description: "Your vitals and risk score were shared with your care team." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const askGemini = async () => {
    setAiLoading(true);
    setAiText(null);
    try {
      const res = await generateRecommendations({
        riskLevel: risk.level,
        riskScore: risk.score,
        vitals: {
          systolicBP: Number(systolic),
          diastolicBP: Number(diastolic),
          glucose: Number(glucose),
          heartRate: Number(hr),
        },
      });
      setAiText(res.text);
    } catch (e) {
      toast({ title: "AI error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold tracking-tight">My Health Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back{user?.email ? `, ${user.email}` : ""} — your personal health dashboard
          </p>
        </motion.div>

        {/* Risk score hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`lg:col-span-1 rounded-2xl border bg-card p-6 flex flex-col items-center text-center ring-1 ${styles.ring}`}
          >
            <div className={`w-32 h-32 rounded-full ${styles.bg} flex flex-col items-center justify-center mb-3`}>
              <span className={`text-5xl font-bold ${styles.text}`}>{risk.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
            </div>
            <p className={`text-lg font-semibold ${styles.text}`}>{risk.level} Risk</p>
            <p className="text-xs text-muted-foreground mt-1">Based on your latest vitals</p>
          </motion.div>

          {/* Vital inputs */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Enter your vitals</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Systolic BP</Label>
                <Input value={systolic} onChange={(e) => setSystolic(e.target.value)} type="number" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Diastolic BP</Label>
                <Input value={diastolic} onChange={(e) => setDiastolic(e.target.value)} type="number" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Glucose (mg/dL)</Label>
                <Input value={glucose} onChange={(e) => setGlucose(e.target.value)} type="number" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Heart Rate (bpm)</Label>
                <Input value={hr} onChange={(e) => setHr(e.target.value)} type="number" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={saveVitals} disabled={saving} variant="outline" className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save & share with doctor
              </Button>
              <Button onClick={askGemini} disabled={aiLoading} className="w-full gradient-primary text-primary-foreground border-0">
                {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Get AI suggestions
              </Button>
            </div>
          </div>
        </div>

        {/* Risk explanation */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Why this score?</h3>
          </div>
          <ul className="space-y-2">
            {risk.explanation.map((r, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${styles.text.replace("text-", "bg-")} shrink-0`} />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* AI output */}
        {aiText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Gemini AI Suggestions</h3>
            </div>
            <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">{aiText}</p>
            <p className="text-[11px] text-muted-foreground mt-3 italic">
              This is AI-generated and not a substitute for medical advice.
            </p>
          </motion.div>
        )}

        {/* History chart + doctor notes */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VitalsHistoryChart userId={user.id} />
            <DoctorNotesPanel userId={user.id} />
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/records/upload" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Upload Medical Record</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add a lab report or prescription for AI analysis</p>
            </div>
          </Link>
          <Link to="/reports" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">My Reports</p>
              <p className="text-xs text-muted-foreground mt-0.5">View past AI analyses & risk history</p>
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
