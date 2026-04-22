import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { time: "00:00", critical: 2, moderate: 5, stable: 12 },
  { time: "04:00", critical: 3, moderate: 4, stable: 11 },
  { time: "08:00", critical: 2, moderate: 6, stable: 10 },
  { time: "12:00", critical: 4, moderate: 5, stable: 9 },
  { time: "16:00", critical: 3, moderate: 7, stable: 10 },
  { time: "20:00", critical: 2, moderate: 5, stable: 11 },
  { time: "Now", critical: 2, moderate: 4, stable: 12 },
];

export default function RiskChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Risk Distribution</h3>
          <p className="text-xs text-muted-foreground">Patient risk levels over 24h</p>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: "Critical", color: "bg-critical" },
            { label: "Moderate", color: "bg-warning" },
            { label: "Stable", color: "bg-success" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="warningGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(152, 55%, 45%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(152, 55%, 45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 92%)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0, 0%, 100%)",
              border: "1px solid hsl(214, 20%, 92%)",
              borderRadius: "8px",
              fontSize: "12px",
              boxShadow: "0 4px 12px -2px rgba(0,0,0,0.06)",
            }}
          />
          <Area type="monotone" dataKey="critical" stroke="hsl(0, 72%, 55%)" fill="url(#criticalGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="moderate" stroke="hsl(38, 92%, 55%)" fill="url(#warningGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="stable" stroke="hsl(152, 55%, 45%)" fill="url(#successGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
