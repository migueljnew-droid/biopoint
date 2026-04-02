"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Moon, Zap, Brain, Heart, Weight, Save, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";

const METRICS = [
  { key: "sleep", label: "Sleep", icon: Moon, unit: "hrs", color: "var(--accent)", min: 0, max: 12, step: 0.5 },
  { key: "energy", label: "Energy", icon: Zap, unit: "/10", color: "var(--warning)", min: 0, max: 10, step: 1 },
  { key: "focus", label: "Focus", icon: Brain, unit: "/10", color: "#A78BFA", min: 0, max: 10, step: 1 },
  { key: "mood", label: "Mood", icon: Heart, unit: "/10", color: "var(--error)", min: 0, max: 10, step: 1 },
  { key: "weight", label: "Weight", icon: Weight, unit: "lbs", color: "var(--success)", min: 100, max: 400, step: 0.1 },
];

interface LogEntry {
  date: string;
  sleepHours: number | null;
  energyLevel: number | null;
  focusLevel: number | null;
  moodLevel: number | null;
  weightKg: number | null;
}

export default function DailyLogPage() {
  const [values, setValues] = useState<Record<string, number>>({
    sleep: 7, energy: 7, focus: 7, mood: 7, weight: 180,
  });
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get("/dashboard").then((res) => {
      const logs = res.data.recentLogs || [];
      setHistory(logs);
      // Pre-fill with today's log if exists
      const today = res.data.todayLog;
      if (today) {
        setValues({
          sleep: today.sleepHours ?? 7,
          energy: today.energyLevel ?? 7,
          focus: today.focusLevel ?? 7,
          mood: today.moodLevel ?? 7,
          weight: today.weightKg ? Math.round(today.weightKg * 2.205) : 180,
        });
      }
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await api.post("/logs", {
        date: today.toISOString(),
        sleepHours: values.sleep,
        energyLevel: values.energy,
        focusLevel: values.focus,
        moodLevel: values.mood,
        weightKg: Math.round(values.weight / 2.205 * 10) / 10,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Refresh history
      api.get("/dashboard").then((res) => setHistory(res.data.recentLogs || [])).catch(() => {});
    } catch (e) {
      console.error("Failed to save log:", e);
    }
  };

  return (
    <div className="space-y-8 mesh-bg-dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight text-gradient-teal" style={{ fontFamily: "'Satoshi', sans-serif" }}>Daily Log</h1>
        <p className="text-[var(--text-muted)] mt-1">Rate your day — feeds into your BioPoint Score</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard className="p-6" glow="accent">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--glass-border)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center">
              <CalendarDays size={16} className="text-[var(--accent)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <div className="space-y-6">
            {METRICS.map((m) => (
              <div key={m.key} className="group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                      style={{
                        background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${m.color} 25%, transparent)`,
                      }}
                    >
                      <m.icon size={15} style={{ color: m.color }} />
                    </div>
                    <span className="text-sm font-semibold">{m.label}</span>
                  </div>
                  <span
                    className="text-xl font-bold font-mono tabular-nums"
                    style={{
                      color: m.color,
                      textShadow: `0 0 12px color-mix(in srgb, ${m.color} 40%, transparent)`,
                    }}
                  >
                    {values[m.key]}<span className="text-sm font-medium text-[var(--text-muted)] ml-0.5">{m.unit}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={m.min}
                  max={m.max}
                  step={m.step}
                  value={values[m.key]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: parseFloat(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${m.color} ${((values[m.key] - m.min) / (m.max - m.min)) * 100}%, var(--glass-border) ${((values[m.key] - m.min) / (m.max - m.min)) * 100}%)`,
                  }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="w-full mt-8 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            {saved ? "Saved!" : <><Save size={16} /> Save Daily Log</>}
          </button>
        </GlassCard>
      </motion.div>

      {/* Weekly Trends */}
      {history.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[rgba(16,185,129,0.1)] flex items-center justify-center" style={{ border: "1px solid rgba(16,185,129,0.25)" }}>
                <TrendingUp size={16} className="text-[var(--success)]" />
              </div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>7-Day Trends</h2>
            </div>

            {[
              { key: "sleepHours", label: "Sleep", color: "var(--accent)", max: 12, unit: "hrs" },
              { key: "energyLevel", label: "Energy", color: "var(--warning)", max: 10, unit: "" },
              { key: "focusLevel", label: "Focus", color: "#A78BFA", max: 10, unit: "" },
              { key: "moodLevel", label: "Mood", color: "var(--error)", max: 10, unit: "" },
            ].map((metric) => {
              const points = history.slice().reverse().map((log) => (log as unknown as Record<string, number | null>)[metric.key]).filter((v): v is number => v !== null);
              if (points.length < 2) return null;
              const maxVal = metric.max;
              const avg = points.reduce((a, b) => a + b, 0) / points.length;
              const latest = points[points.length - 1];
              const prev = points[points.length - 2];
              const trend = latest - prev;

              return (
                <div key={metric.key} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold" style={{ color: metric.color }}>{latest}{metric.unit}</span>
                      <span className={`text-xs font-mono ${trend >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                        {trend >= 0 ? "+" : ""}{trend.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  {/* Mini sparkline bar chart */}
                  <div className="flex items-end gap-1 h-10">
                    {points.map((val, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(4, (val / maxVal) * 100)}%`,
                          background: i === points.length - 1 ? metric.color : `color-mix(in srgb, ${metric.color} 40%, transparent)`,
                          opacity: 0.5 + (i / points.length) * 0.5,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">7 days ago</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Avg: {avg.toFixed(1)}{metric.unit}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Today</span>
                  </div>
                </div>
              );
            })}
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
