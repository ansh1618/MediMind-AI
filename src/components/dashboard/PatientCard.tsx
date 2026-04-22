import { motion } from "framer-motion";
import { Patient, getRiskColor, getMEWSUrgency } from "@/data/mockPatients";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

const riskIcons = {
  critical: AlertTriangle,
  moderate: Activity,
  stable: CheckCircle,
};

const riskBadgeStyles = {
  critical: "bg-critical/10 text-critical border-critical/20",
  moderate: "bg-warning/10 text-warning border-warning/20",
  stable: "bg-success/10 text-success border-success/20",
};

interface Props {
  patient: Patient;
  index: number;
  onClick?: () => void;
}

export default function PatientCard({ patient, index, onClick }: Props) {
  const RiskIcon = riskIcons[patient.riskLevel];
  const urgency = getMEWSUrgency(patient.mews.total);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-5 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{patient.name}</h3>
          <p className="text-xs text-muted-foreground">{patient.id} · {patient.age}y · {patient.gender}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${riskBadgeStyles[patient.riskLevel]}`}>
          <RiskIcon className="w-3 h-3" />
          {patient.riskLevel}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{patient.condition}</p>

      {/* MEWS badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md bg-${urgency.color}/10 text-${urgency.color}`}>
          MEWS {patient.mews.total}
        </span>
        <span className="text-[10px] text-muted-foreground">{urgency.label}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-xs text-muted-foreground">HR</p>
          <p className="text-xs font-semibold">{patient.vitals.heartRate}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-xs text-muted-foreground">BP</p>
          <p className="text-xs font-semibold">{patient.vitals.bloodPressure}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Temp</p>
          <p className="text-xs font-semibold">{patient.vitals.temperature}°</p>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-xs text-muted-foreground">SpO₂</p>
          <p className={`text-xs font-semibold ${patient.vitals.oxygenSat < 92 ? "text-critical" : ""}`}>
            {patient.vitals.oxygenSat}%
          </p>
        </div>
      </div>

      {/* Top risk factor */}
      {patient.riskFactors.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Top factor:</span>
          <span className="font-medium text-critical">{patient.riskFactors[0].feature} (+{patient.riskFactors[0].contribution}%)</span>
        </div>
      )}

      {patient.aiPrediction && (
        <div className="mt-3 p-2.5 rounded-md bg-primary/5 border border-primary/10">
          <p className="text-xs text-primary font-medium">AI Insight</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{patient.aiPrediction}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1">
        <p className="text-xs text-muted-foreground mr-1">Risk trend</p>
        <div className="flex items-end gap-0.5 h-4">
          {patient.trends.map((v, i) => (
            <div
              key={i}
              className={`w-1 rounded-full ${
                patient.riskLevel === "critical" ? "bg-critical/60" :
                patient.riskLevel === "moderate" ? "bg-warning/60" : "bg-success/60"
              }`}
              style={{ height: `${(v / 100) * 16}px` }}
            />
          ))}
        </div>
        <span className="text-xs font-semibold ml-auto">{patient.riskScore}%</span>
      </div>
    </motion.div>
  );
}
