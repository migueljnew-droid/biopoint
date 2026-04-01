"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, FlaskConical, Layers, Timer, Sparkles, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { MetricCard } from "@/components/MetricCard";
import { ScoreRing } from "@/components/ScoreRing";
import { api } from "@/lib/api";

interface DashboardData {
  score: { current: number; change: number };
  todayStack: { name: string; items: { name: string; dose: string; timing: string; taken: boolean }[] };
  stats: { biomarkers: number; inRange: number; streak: number; labs: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).catch(console.error);
  }, []);

  const score = data?.score?.current ?? 0;
  const change = data?.score?.change ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      >
        <h1
          className="text-4xl font-bold tracking-tight mb-1"
          style={{ fontFamily: "'Satoshi', sans-serif" }}
        >
          Dashboard
        </h1>
        <p className="text-[var(--text-muted)]">Your health intelligence at a glance</p>
      </motion.div>

      {/* Score + Stats Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Score Card */}
        <motion.div
          className="col-span-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <GlassCard className="p-8 flex flex-col items-center" glow>
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
              BioPoint Score
            </p>
            <ScoreRing score={score} size={180} />
            <div className="mt-4 flex items-center gap-2">
              <TrendingUp size={14} className={change >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"} />
              <span
                className="text-sm font-mono font-semibold"
                style={{ color: change >= 0 ? "var(--success)" : "var(--error)" }}
              >
                {change >= 0 ? "+" : ""}{change} this week
              </span>
            </div>
          </GlassCard>
        </motion.div>

        {/* Metric Cards */}
        <div className="col-span-8 grid grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <MetricCard label="Biomarkers Tracked" value={data?.stats?.biomarkers ?? 0} icon={FlaskConical} color="var(--accent)" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <MetricCard label="In Range" value={data?.stats?.inRange ?? 0} icon={Activity} color="var(--success)" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <MetricCard label="Day Streak" value={data?.stats?.streak ?? 0} unit="days" icon={Timer} color="var(--warning)" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <MetricCard label="Lab Reports" value={data?.stats?.labs ?? 0} icon={Layers} color="#A78BFA" />
          </motion.div>
        </div>
      </div>

      {/* Today's Stack + Oracle */}
      <div className="grid grid-cols-2 gap-6">
        {/* Today's Stack */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                Today&apos;s Stack
              </h2>
              <span className="text-xs font-mono px-2 py-1 rounded-md bg-[var(--accent-muted)] text-[var(--accent)]">
                {data?.todayStack?.items?.filter((i) => i.taken).length ?? 0}/{data?.todayStack?.items?.length ?? 0}
              </span>
            </div>
            <div className="space-y-3">
              {data?.todayStack?.items?.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)]"
                >
                  <div>
                    <p className={`text-sm font-medium ${item.taken ? "line-through text-[var(--text-muted)]" : ""}`}>
                      {item.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{item.dose} · {item.timing}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      item.taken ? "bg-[var(--success)]" : "border border-[var(--glass-border)]"
                    }`}
                  >
                    {item.taken && <span className="text-xs text-white">✓</span>}
                  </div>
                </div>
              )) ?? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No stack items today</p>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Oracle Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <GlassCard
            className="p-6 relative overflow-hidden cursor-pointer"
            onClick={() => (window.location.href = "/oracle")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow)] to-transparent opacity-30" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center">
                  <Sparkles size={20} className="text-[var(--accent)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                    The Oracle
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">AI Health Intelligence</p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Ask anything about your health data. The Oracle analyzes your biomarkers, stacks, and trends to give personalized insights.
              </p>
              <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-medium">
                <span>Start a conversation</span>
                <span>→</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
