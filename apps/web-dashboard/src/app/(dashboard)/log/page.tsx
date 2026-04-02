"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Moon, Zap, Brain, Heart, Weight, Save } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const METRICS = [
  { key: "sleep", label: "Sleep", icon: Moon, unit: "hrs", color: "var(--accent)", min: 0, max: 12, step: 0.5 },
  { key: "energy", label: "Energy", icon: Zap, unit: "/10", color: "var(--warning)", min: 0, max: 10, step: 1 },
  { key: "focus", label: "Focus", icon: Brain, unit: "/10", color: "#A78BFA", min: 0, max: 10, step: 1 },
  { key: "mood", label: "Mood", icon: Heart, unit: "/10", color: "var(--error)", min: 0, max: 10, step: 1 },
  { key: "weight", label: "Weight", icon: Weight, unit: "lbs", color: "var(--success)", min: 100, max: 400, step: 0.1 },
];

export default function DailyLogPage() {
  const [values, setValues] = useState<Record<string, number>>({
    sleep: 7, energy: 7, focus: 7, mood: 7, weight: 180,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    </div>
  );
}
