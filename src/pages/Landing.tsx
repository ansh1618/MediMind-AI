import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Activity, Shield, FileText, ArrowRight, Zap, Heart, Stethoscope, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImpactMetrics from "@/components/dashboard/ImpactMetrics";

const features = [
  { icon: Brain, title: "AI Diagnosis", description: "Symptom analysis powered by Gemini with confidence scoring and severity assessment." },
  { icon: Activity, title: "Risk Prediction", description: "MEWS-based triage with explainable AI showing which factors drive each risk score." },
  { icon: FileText, title: "Report Analyzer", description: "Transform complex medical reports into clear, actionable patient summaries." },
  { icon: Shield, title: "Secure & Compliant", description: "FHIR-aligned data structures with role-based access for healthcare environments." },
];

const roles = [
  { icon: Stethoscope, label: "Doctor", desc: "Full clinical access — diagnose, predict, and monitor", color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950 dark:border-blue-900" },
  { icon: User, label: "Patient", desc: "View your own records, risk score and AI suggestions", color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950 dark:border-emerald-900" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 inset-x-0 z-50 glass-strong">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">MediMind AI</span>
          </div>
          <Link to="/login">
            <Button size="sm" className="gradient-primary text-primary-foreground border-0 shadow-glow text-xs px-4">
              Sign In
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 gradient-hero opacity-[0.03]" />
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs font-medium text-primary mb-6">
              <Zap className="w-3 h-3" />
              Predictive Clinical Intelligence · Google Solution Challenge 2026
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Save lives with
              <span className="text-gradient"> AI-powered </span>
              clinical insights
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
              MediMind analyzes patient data in real-time using MEWS scoring and explainable AI to predict critical health events before they happen.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/login">
                <Button className="gradient-primary text-primary-foreground border-0 shadow-glow px-6">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="px-6">
                  Try Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-12 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold tracking-tight mb-2">Built for every stakeholder</h2>
            <p className="text-sm text-muted-foreground">Role-based access ensures the right people see the right data</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div key={r.label} className={`rounded-xl border p-5 ${r.color}`}>
                <r.icon className="w-6 h-6 mb-3" />
                <h3 className="text-sm font-semibold mb-1">{r.label}</h3>
                <p className="text-xs opacity-70 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Intelligent healthcare, simplified</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Four core capabilities designed to support clinical decision-making and improve patient outcomes.</p>
          </div>
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 gap-4">
            {features.map((f) => (
              <motion.div key={f.title} variants={item} className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-md">
                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <ImpactMetrics />

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/5 border border-success/10 text-xs font-medium text-success mb-4">
            <Heart className="w-3 h-3" />
            SDG 3: Good Health & Well-being
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3">Aligned with global health goals</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            MediMind contributes to UN SDG 3.8 — achieving universal health coverage by enabling early disease detection and reducing preventable deaths through predictive AI and MEWS-based triage.
          </p>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">MediMind AI — Google Solution Challenge 2026</span>
          </div>
          <Link to="/login">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
              Sign In →
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
