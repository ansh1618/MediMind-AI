import { motion } from "framer-motion";
import { X, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Pill, FlaskConical } from "lucide-react";
import { Patient, getMEWSUrgency } from "@/data/mockPatients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
}

const flagStyles = {
  normal: "text-success bg-success/10",
  high: "text-warning bg-warning/10",
  low: "text-info bg-info/10",
  critical: "text-critical bg-critical/10",
};

export default function PatientDetailModal({ patient, open, onClose }: Props) {
  if (!patient) return null;
  const urgency = getMEWSUrgency(patient.mews.total);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">{patient.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">{patient.id} · {patient.age}y · {patient.gender} · {patient.department}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold border bg-${urgency.color}/10 text-${urgency.color} border-${urgency.color}/20`}>
              MEWS {patient.mews.total} — {urgency.label}
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Explainable AI Risk Factors */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Explainable AI — Risk Attribution
            </h3>
            <div className="space-y-2">
              {patient.riskFactors.map((rf, i) => (
                <motion.div
                  key={rf.feature}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-1.5 shrink-0 w-5">
                    {rf.direction === "positive" ? (
                      <TrendingUp className="w-4 h-4 text-critical" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{rf.feature}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{rf.value}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rf.contribution}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        className={`h-full rounded-full ${rf.direction === "positive" ? "bg-critical" : "bg-success"}`}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 w-10 text-right ${rf.direction === "positive" ? "text-critical" : "text-success"}`}>
                    +{rf.contribution}%
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* MEWS Breakdown */}
          <div>
            <h3 className="text-sm font-semibold mb-3">MEWS Breakdown</h3>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(patient.mews.breakdown).map(([key, val]) => (
                <div key={key} className={`rounded-lg p-2.5 text-center ${val >= 2 ? "bg-critical/10 border border-critical/20" : val >= 1 ? "bg-warning/10 border border-warning/20" : "bg-muted/50"}`}>
                  <p className="text-[10px] text-muted-foreground mb-1 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                  <p className={`text-lg font-bold ${val >= 2 ? "text-critical" : val >= 1 ? "text-warning" : "text-foreground"}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Results */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              Lab Results
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {patient.labResults.map((lab) => (
                <div key={lab.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <span className="text-xs text-muted-foreground">{lab.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${flagStyles[lab.flag]}`}>{lab.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Medications & Comorbidities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                Medications
              </h3>
              <div className="space-y-1">
                {patient.medications.map((med) => (
                  <p key={med} className="text-xs text-muted-foreground">• {med}</p>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Comorbidities</h3>
              <div className="space-y-1">
                {patient.comorbidities.length > 0 ? patient.comorbidities.map((c) => (
                  <p key={c} className="text-xs text-muted-foreground">• {c}</p>
                )) : <p className="text-xs text-muted-foreground">None</p>}
              </div>
            </div>
          </div>

          {/* AI Prediction */}
          {patient.aiPrediction && (
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary mb-1">AI Clinical Insight</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{patient.aiPrediction}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
