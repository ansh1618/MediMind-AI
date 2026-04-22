import { motion } from "framer-motion";
import { patients, getMEWSUrgency, sortByMEWS, Patient } from "@/data/mockPatients";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  onSelectPatient: (patient: Patient) => void;
}

export default function UrgencyMatrix({ onSelectPatient }: Props) {
  const sorted = sortByMEWS(patients);
  const urgencyGroups = [
    { label: "Immediate", min: 5, color: "critical" },
    { label: "Increased", min: 3, color: "warning" },
    { label: "Routine", min: 0, color: "success" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Urgency Matrix (MEWS)</h3>
          <p className="text-xs text-muted-foreground">Modified Early Warning Score triage queue</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Real-time
        </div>
      </div>

      <div className="space-y-3">
        {urgencyGroups.map((group) => {
          const groupPatients = sorted.filter((p) => {
            const u = getMEWSUrgency(p.mews.total);
            if (group.min >= 5) return p.mews.total >= 5;
            if (group.min >= 3) return p.mews.total >= 3 && p.mews.total < 5;
            return p.mews.total < 3;
          });

          if (groupPatients.length === 0) return null;

          return (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full bg-${group.color}`} />
                <span className="text-xs font-medium">{group.label}</span>
                <span className="text-xs text-muted-foreground">({groupPatients.length})</span>
              </div>
              <div className="space-y-1.5">
                {groupPatients.map((p, i) => (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onSelectPatient(p)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all hover:bg-muted/50 ${
                      p.mews.total >= 5 ? "bg-critical/5 border border-critical/10" : "bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {p.mews.total >= 5 && <AlertTriangle className="w-3.5 h-3.5 text-critical animate-pulse" />}
                      <div>
                        <p className="text-xs font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.condition}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${p.mews.total >= 5 ? "text-critical" : p.mews.total >= 3 ? "text-warning" : "text-success"}`}>
                        {p.mews.total}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
