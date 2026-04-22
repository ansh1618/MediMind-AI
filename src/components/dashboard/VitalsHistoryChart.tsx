import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
}

type Point = {
  date: string;
  systolic?: number;
  diastolic?: number;
  hr?: number;
  glucose?: number;
  risk?: number;
};

export default function VitalsHistoryChart({ userId }: Props) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from("patient_records")
        .select("vitals, risk_scores, created_at")
        .eq("linked_patient_user_id", userId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled) return;
      const points: Point[] = (rows ?? []).map((r: { created_at: string; vitals?: Record<string, number | undefined> | null; risk_scores?: { score?: number } | null }) => ({
        date: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        systolic: r.vitals?.systolicBP,
        diastolic: r.vitals?.diastolicBP,
        hr: r.vitals?.heartRate,
        glucose: r.vitals?.glucose,
        risk: r.risk_scores?.score,
      }));
      setData(points);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Vitals History</h3>
        <span className="text-xs text-muted-foreground">({data.length} entries)</span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground py-10 text-center">Loading…</p>
      ) : data.length < 2 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">
          Save your vitals at least twice to see trends here.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="systolic" name="Systolic" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="hr" name="Heart Rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="glucose" name="Glucose" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="risk" name="Risk Score" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
