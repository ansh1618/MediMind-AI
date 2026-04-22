import { motion } from "framer-motion";
import { Heart, Clock, TrendingUp, ShieldCheck } from "lucide-react";

const metrics = [
  { icon: Heart, label: "Potential Lives Saved", value: "2,400+", sublabel: "annually via early detection", color: "text-critical" },
  { icon: Clock, label: "Admin Hours Reduced", value: "18,000", sublabel: "hours/year automated", color: "text-primary" },
  { icon: TrendingUp, label: "Early Detection Rate", value: "94.2%", sublabel: "for critical deterioration", color: "text-success" },
  { icon: ShieldCheck, label: "False Positive Rate", value: "<3.1%", sublabel: "precision-tuned AI models", color: "text-accent" },
];

export default function ImpactMetrics() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs font-medium text-primary mb-4">
            <TrendingUp className="w-3 h-3" />
            Impact Metrics
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Measurable clinical impact</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Projected outcomes based on pilot deployment across 12 partner hospitals.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border bg-card p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <m.icon className={`w-6 h-6 ${m.color}`} />
              </div>
              <p className="text-2xl font-bold tracking-tight mb-1">{m.value}</p>
              <p className="text-xs font-medium mb-0.5">{m.label}</p>
              <p className="text-[11px] text-muted-foreground">{m.sublabel}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
