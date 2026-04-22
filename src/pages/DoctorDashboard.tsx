import { useState } from "react";
import { motion } from "framer-motion";
import { Users, AlertTriangle, Activity, BarChart3, Bell, Sparkles, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import PatientCard from "@/components/dashboard/PatientCard";
import RiskChart from "@/components/dashboard/RiskChart";
import UrgencyMatrix from "@/components/dashboard/UrgencyMatrix";
import PatientDetailModal from "@/components/dashboard/PatientDetailModal";
import { Button } from "@/components/ui/button";
import { patients, type RiskLevel, type Patient } from "@/data/mockPatients";
import { useAuth } from "@/hooks/useAuth";
import { generateRecommendations } from "@/services/aiService";
import { useToast } from "@/hooks/use-toast";
import LivePatientList from "@/components/dashboard/LivePatientList";

export default function DoctorDashboard() {
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const filtered = filter === "all" ? patients : patients.filter((p) => p.riskLevel === filter);
  const criticalCount = patients.filter((p) => p.riskLevel === "critical").length;
  const moderateCount = patients.filter((p) => p.riskLevel === "moderate").length;
  const avgMEWS = Math.round((patients.reduce((s, p) => s + p.mews.total, 0) / patients.length) * 10) / 10;
  const criticalPatients = patients.filter((p) => p.riskLevel === "critical");

  const filters: { label: string; value: RiskLevel | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Critical", value: "critical" },
    { label: "Moderate", value: "moderate" },
    { label: "Stable", value: "stable" },
  ];

  const generateCohortRecommendations = async () => {
    setAiLoading(true);
    setAiText(null);
    try {
      const res = await generateRecommendations({
        riskLevel: criticalCount > 0 ? "High" : moderateCount > 2 ? "Medium" : "Low",
        riskScore: Math.min(100, criticalCount * 20 + moderateCount * 8),
        vitals: {
          avg_mews: avgMEWS,
          critical_count: criticalCount,
          moderate_count: moderateCount,
          total_patients: patients.length,
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
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Doctor Portal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.email} · {patients.length} active patients
            </p>
          </div>
          <Button onClick={generateCohortRecommendations} disabled={aiLoading} className="gradient-primary text-primary-foreground border-0">
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Cohort Recommendations
          </Button>
        </motion.div>

        {/* High-risk alert banner */}
        {criticalCount > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <Bell className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                {criticalCount} high-risk patient{criticalCount > 1 ? "s" : ""} need immediate attention
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {criticalPatients.map((p) => p.name).join(", ")}
              </p>
            </div>
          </motion.div>
        )}

        {/* AI output card */}
        {aiText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Gemini Recommendations</h3>
            </div>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{aiText}</p>
          </motion.div>
        )}

        {/* Real patient records from Supabase */}
        <LivePatientList />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Patients" value={patients.length} icon={Users} />
          <StatCard title="Critical" value={criticalCount} icon={AlertTriangle} variant="critical" />
          <StatCard title="Moderate Risk" value={moderateCount} icon={Activity} variant="warning" />
          <StatCard title="Avg MEWS" value={avgMEWS} icon={BarChart3} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskChart />
          <UrgencyMatrix onSelectPatient={(p) => { setSelectedPatient(p); setModalOpen(true); }} />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Patient grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <PatientCard key={p.id} patient={p} index={i} onClick={() => { setSelectedPatient(p); setModalOpen(true); }} />
          ))}
        </div>

        <PatientDetailModal patient={selectedPatient} open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </DashboardLayout>
  );
}
