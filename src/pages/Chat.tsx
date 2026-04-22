import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Brain, User, Loader2, Stethoscope, HeartPulse, ChevronDown, ChevronUp } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { streamChat } from "@/lib/ai";
import { patients } from "@/data/mockPatients";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const doctorQuestions = [
  "Show all high-risk patients",
  "Summarise Rajesh Sharma's condition",
  "ICU admission criteria for current patients",
  "Interpret troponin levels for cardiac patients",
  "Which patients need immediate attention?",
  "Compare MEWS scores across departments",
  "Explain the PE patient's treatment plan",
  "Recommend discharge criteria for stable patients",
];

const patientQuestions = [
  "What is my current risk score?",
  "Tips for managing diabetes at home",
  "When should I visit the hospital urgently?",
  "Explain my latest lab results simply",
  "What diet should I follow?",
  "How can I lower my blood pressure?",
  "What are side effects of my medications?",
  "When is my next recommended check-up?",
];

function getPatientContext(): string {
  return patients
    .map(
      (p) =>
        `${p.id} ${p.name} (${p.age}y ${p.gender}) — ${p.condition} | Risk: ${p.riskLevel} ${p.riskScore}% | MEWS: ${p.mews.total} | Dept: ${p.department} | Vitals: HR ${p.vitals.heartRate}, BP ${p.vitals.bloodPressure}, SpO₂ ${p.vitals.oxygenSat}%, RR ${p.vitals.respiratoryRate}, Temp ${p.vitals.temperature}°C | AI: ${p.aiPrediction || "N/A"}`
    )
    .join("\n");
}

export default function Chat() {
  const { roles } = useAuth();
  const isDoctor = roles.includes("doctor") || roles.includes("admin");
  const questions = isDoctor ? doctorQuestions : patientQuestions;
  const RoleIcon = isDoctor ? Stethoscope : HeartPulse;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: isDoctor
        ? "Hello, Doctor. I'm your AI clinical assistant powered by Gemini. I have access to all current patient data including MEWS scores and risk factors.\n\nTap a question below or type your own."
        : "Hello! I'm your personal health assistant powered by AI. I can help you understand your health data, risk scores, and provide wellness tips.\n\nTap a question below or type your own.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAllPills, setShowAllPills] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visiblePills = showAllPills ? questions : questions.slice(0, 4);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: Message = { role: "user", content: msg };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length === updatedMessages.length + 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const contextMsg: Message = {
        role: "user",
        content: `[CONTEXT - Current patient data in the system]\n${getPatientContext()}\n\n[USER QUESTION]\n${msg}`,
      };
      const historyForAI = [
        ...messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-10),
        contextMsg,
      ];
      await streamChat({ messages: historyForAI, onDelta: upsertAssistant, onDone: () => setIsLoading(false) });
    } catch (e) {
      console.error("Chat error:", e);
      setIsLoading(false);
      toast({ title: "AI Error", description: e instanceof Error ? e.message : "Failed to get response", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-5rem)] max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <RoleIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI {isDoctor ? "Clinical" : "Health"} Assistant</h1>
              <p className="text-sm text-muted-foreground">
                {isDoctor ? "Clinical intelligence — powered by Gemini" : "Your personal health companion — powered by AI"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick-tap pills */}
        {messages.length <= 1 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {visiblePills.map((q, i) => (
                  <motion.button
                    key={q}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => send(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {q}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            {questions.length > 4 && (
              <button
                onClick={() => setShowAllPills(!showAllPills)}
                className="mt-2 text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {showAllPills ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-4">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "gradient-primary text-primary-foreground" : "bg-muted/50"}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={isDoctor ? "Ask about patients, conditions, or treatments..." : "Ask about your health, medications, or wellness..."}
            className="flex-1 h-10 rounded-lg border border-border bg-card px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <Button onClick={() => send()} disabled={!input.trim() || isLoading} size="sm" className="gradient-primary text-primary-foreground border-0 h-10 px-4">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
