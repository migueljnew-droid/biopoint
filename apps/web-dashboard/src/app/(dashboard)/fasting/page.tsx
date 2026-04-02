"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Timer, Play, Pause, RotateCcw, Flame, Zap, Brain, Heart } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const PROTOCOLS = [
  { name: "16:8", fast: 16, eat: 8, description: "Most popular — 16h fast, 8h eating window" },
  { name: "18:6", fast: 18, eat: 6, description: "Extended — deeper autophagy activation" },
  { name: "20:4", fast: 20, eat: 4, description: "Warrior — one main meal window" },
  { name: "OMAD", fast: 23, eat: 1, description: "One Meal A Day — maximum autophagy" },
];

const ZONES = [
  { hours: 0, label: "Anabolic", color: "var(--text-muted)", icon: Flame, desc: "Blood sugar rising, insulin active" },
  { hours: 4, label: "Catabolic", color: "var(--warning)", icon: Zap, desc: "Blood sugar normalizing, fat burning begins" },
  { hours: 12, label: "Fat Burning", color: "var(--accent)", icon: Flame, desc: "Ketosis starting, growth hormone rising" },
  { hours: 16, label: "Autophagy", color: "var(--success)", icon: Brain, desc: "Cellular cleanup activated" },
  { hours: 24, label: "Deep Autophagy", color: "#A78BFA", icon: Heart, desc: "Stem cell regeneration, deep repair" },
];

export default function FastingPage() {
  const [selectedProtocol, setSelectedProtocol] = useState(PROTOCOLS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, startTime]);

  const totalSeconds = selectedProtocol.fast * 3600;
  const progress = Math.min(elapsed / totalSeconds, 1);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const remaining = Math.max(totalSeconds - elapsed, 0);
  const remH = Math.floor(remaining / 3600);
  const remM = Math.floor((remaining % 3600) / 60);

  const currentZone = ZONES.reduce((zone, z) => (elapsed >= z.hours * 3600 ? z : zone), ZONES[0]);

  const handleStart = () => { setStartTime(Date.now()); setIsRunning(true); };
  const handlePause = () => { setIsRunning(false); };
  const handleReset = () => { setIsRunning(false); setElapsed(0); setStartTime(null); };

  const circumference = 2 * Math.PI * 120;

  return (
    <div className="space-y-8 mesh-bg-fasting">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight text-gradient-success" style={{ fontFamily: "'Satoshi', sans-serif" }}>Fasting</h1>
        <p className="text-[var(--text-muted)] mt-1">Track your intermittent fasting protocols</p>
      </motion.div>

      {/* Protocol Selector */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PROTOCOLS.map((p) => (
          <button
            key={p.name}
            onClick={() => { if (!isRunning) setSelectedProtocol(p); }}
            className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
              selectedProtocol.name === p.name
                ? "bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--glass)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--glass-border-hover)]"
            }`}
          >
            <p className="text-lg font-bold font-mono">{p.name}</p>
            <p className="text-xs mt-1 text-[var(--text-muted)]">{p.fast}h fast</p>
          </button>
        ))}
      </motion.div>

      {/* Timer */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard className="p-8 flex flex-col items-center" glow="success">
          <div className="relative w-[280px] h-[280px] flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 280 280">
              <defs>
                <filter id="ring-glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle cx="140" cy="140" r="120" fill="none" stroke="var(--glass-border)" strokeWidth="8" />
              <circle
                cx="140" cy="140" r="120" fill="none"
                stroke={currentZone.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="transition-all duration-1000"
                filter="url(#ring-glow)"
              />
            </svg>
            <div className="text-center z-10">
              <p className="text-5xl font-bold font-mono tracking-tight">
                {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                {elapsed > 0 ? `${remH}h ${remM}m remaining` : `${selectedProtocol.fast}h fast`}
              </p>
            </div>
          </div>

          {/* Current Zone */}
          <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: `color-mix(in srgb, ${currentZone.color} 10%, transparent)` }}>
            <currentZone.icon size={16} style={{ color: currentZone.color }} />
            <span className="text-sm font-semibold" style={{ color: currentZone.color }}>{currentZone.label}</span>
            <span className="text-xs text-[var(--text-muted)]">— {currentZone.desc}</span>
          </div>

          {/* Controls */}
          <div className="flex gap-4 mt-8">
            {!isRunning ? (
              <button onClick={handleStart} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">
                <Play size={18} /> {elapsed > 0 ? "Resume" : "Start Fast"}
              </button>
            ) : (
              <button onClick={handlePause} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--warning)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">
                <Pause size={18} /> Pause
              </button>
            )}
            {elapsed > 0 && (
              <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--glass-hover)] transition-all cursor-pointer">
                <RotateCcw size={16} /> Reset
              </button>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Fasting Zones Timeline */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Satoshi', sans-serif" }}>Fasting Zones</h2>
        <div className="space-y-3">
          {ZONES.map((zone, i) => {
            const isActive = elapsed >= zone.hours * 3600;
            return (
              <div
                key={zone.label}
                className={`glass-card p-4 flex items-center gap-4 transition-all duration-500 ${isActive ? "border-l-[3px]" : "opacity-60"}`}
                style={isActive ? {
                  borderLeftColor: zone.color,
                  boxShadow: `0 0 16px color-mix(in srgb, ${zone.color} 15%, transparent)`,
                } : {}}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${zone.color} 15%, transparent)`,
                    boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${zone.color} 30%, transparent)` : "none",
                  }}
                >
                  <zone.icon size={20} style={{ color: zone.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: isActive ? zone.color : "var(--text-secondary)" }}>{zone.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{zone.desc}</p>
                </div>
                <span className={`text-xs font-mono ${isActive ? "font-bold" : "text-[var(--text-muted)]"}`} style={isActive ? { color: zone.color } : {}}>{zone.hours}h+</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
