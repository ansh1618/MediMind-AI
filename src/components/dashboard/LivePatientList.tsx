import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, RefreshCw, Loader2, MessageSquarePlus, Send, X, HeartPulse, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Vitals = {
  systolicBP?: number;
  diastolicBP?: number;
  glucose?: number;
  heartRate?: number;
  recorded_at?: string;
};

type RiskScore = {
  level?: "Low" | "Medium" | "High";
  score?: number;
  explanation?: string[];
};

type RecordRow = {
  id: string;
  patient_name: string;
  linked_patient_user_id: string | null;
  vitals: Vitals | null;
  risk_scores: RiskScore | null;
  updated_at: string;
};

type Note = {
  id: string;
  note: string;
  doctor_name: string | null;
  created_at: string;
};

const levelStyles: Record<string, string> = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function LivePatientList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<RecordRow | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const { start: micStart, stop: micStop, listening, transcript, interim, supported: micSupported, reset: micReset, error: micError } =
    useSpeechRecognition({ continuous: true });

  // Append finalized speech to the note text
  useEffect(() => {
    if (transcript) {
      setNoteText((prev) => (prev ? prev + " " : "") + transcript);
      micReset();
    }
  }, [transcript, micReset]);

  useEffect(() => {
    if (micError) toast({ title: "Voice input", description: micError, variant: "destructive" });
  }, [micError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_records")
      .select("id, patient_name, linked_patient_user_id, vitals, risk_scores, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Failed to load records", description: error.message, variant: "destructive" });
    } else {
      setRecords((data ?? []) as RecordRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const latestByPatient = useMemo(() => {
    const map = new Map<string, RecordRow>();
    for (const r of records) {
      const key = r.linked_patient_user_id ?? r.id;
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [records]);

  const openPatient = async (r: RecordRow) => {
    setActive(r);
    setNoteText("");
    if (!r.linked_patient_user_id) {
      setNotes([]);
      return;
    }
    const { data, error } = await supabase
      .from("clinical_notes")
      .select("id, note, doctor_name, created_at")
      .eq("patient_user_id", r.linked_patient_user_id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load notes", description: error.message, variant: "destructive" });
    } else {
      setNotes((data ?? []) as Note[]);
    }
  };

  const submitNote = async () => {
    if (!user || !active || !active.linked_patient_user_id || !noteText.trim()) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from("clinical_notes")
      .insert({
        patient_record_id: active.id,
        patient_user_id: active.linked_patient_user_id,
        doctor_user_id: user.id,
        doctor_name: user.email ?? "Doctor",
        note: noteText.trim(),
      })
      .select("id, note, doctor_name, created_at")
      .single();
    setSavingNote(false);
    if (error) {
      toast({ title: "Failed to add note", description: error.message, variant: "destructive" });
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
    setNoteText("");
    toast({ title: "Note added", description: "Patient will see this on their dashboard." });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Patient Records</h3>
          <span className="text-xs text-muted-foreground">({latestByPatient.length})</span>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {loading && records.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">Loading patient records…</div>
      ) : latestByPatient.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">No patient records yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Records will appear here when patients save vitals from their dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {latestByPatient.map((r) => {
            const level = r.risk_scores?.level ?? "Low";
            const score = r.risk_scores?.score ?? 0;
            const v = r.vitals ?? {};
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openPatient(r)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{r.patient_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${levelStyles[level] ?? levelStyles.Low}`}>
                      {level} · {score}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <HeartPulse className="w-3 h-3" />
                    BP {v.systolicBP ?? "–"}/{v.diastolicBP ?? "–"} · HR {v.heartRate ?? "–"} · Glu {v.glucose ?? "–"}
                    <span className="text-muted-foreground/60">· {new Date(r.updated_at).toLocaleString()}</span>
                  </p>
                </div>
                <MessageSquarePlus className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setActive(null)}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold">{active.patient_name}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Latest: {new Date(active.updated_at).toLocaleString()}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setActive(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                ["BP", `${active.vitals?.systolicBP ?? "–"}/${active.vitals?.diastolicBP ?? "–"}`],
                ["HR", `${active.vitals?.heartRate ?? "–"}`],
                ["Glu", `${active.vitals?.glucose ?? "–"}`],
                ["Risk", `${active.risk_scores?.score ?? 0}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground">{k}</p>
                  <p className="text-xs font-semibold">{v}</p>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Add clinical note</p>
                {micSupported && (
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? "default" : "outline"}
                    onClick={() => (listening ? micStop() : micStart())}
                    disabled={!active.linked_patient_user_id}
                    className={`h-7 text-[11px] ${listening ? "animate-pulse" : ""}`}
                    aria-label={listening ? "Stop dictation" : "Start voice dictation"}
                  >
                    {listening ? <MicOff className="w-3 h-3 mr-1" /> : <Mic className="w-3 h-3 mr-1" />}
                    {listening ? "Stop dictation" : "Dictate"}
                  </Button>
                )}
              </div>
              <Textarea
                value={noteText + (interim ? ` ${interim}` : "")}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={listening ? "Listening… speak your note" : "e.g. BP trending down. Continue current meds, recheck in 48h."}
                className={`text-sm min-h-[80px] ${listening ? "border-primary/60 ring-2 ring-primary/20" : ""}`}
                disabled={!active.linked_patient_user_id}
              />
              {!active.linked_patient_user_id && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  This record isn't linked to a patient account, so notes can't be sent.
                </p>
              )}
              <Button
                size="sm"
                onClick={submitNote}
                disabled={savingNote || !noteText.trim() || !active.linked_patient_user_id}
                className="mt-2 gradient-primary text-primary-foreground border-0"
              >
                {savingNote ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Send note
              </Button>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2">Previous notes ({notes.length})</p>
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md bg-muted/40 p-2.5">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{n.note}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {n.doctor_name ?? "Doctor"} · {new Date(n.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
