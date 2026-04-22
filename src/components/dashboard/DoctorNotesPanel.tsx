import { useEffect, useState } from "react";
import { MessageSquare, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
}

type Note = {
  id: string;
  note: string;
  doctor_name: string | null;
  created_at: string;
};

export default function DoctorNotesPanel({ userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clinical_notes")
        .select("id, note, doctor_name, created_at")
        .eq("patient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setNotes((data ?? []) as Note[]);
        setLoading(false);
      }
    })();

    // Realtime subscription so new notes appear instantly
    const channel = supabase
      .channel(`notes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clinical_notes", filter: `patient_user_id=eq.${userId}` },
        (payload) => {
          setNotes((prev) => [payload.new as Note, ...prev]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Notes from your doctor</h3>
        <span className="text-xs text-muted-foreground">({notes.length})</span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center">
          <MessageSquare className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No notes from your care team yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{n.note}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {n.doctor_name ?? "Doctor"} · {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
