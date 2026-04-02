"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, FlaskConical, Layers, Timer, Sparkles, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { MetricCard } from "@/components/MetricCard";
import { ScoreRing } from "@/components/ScoreRing";
import { api } from "@/lib/api";

interface DashboardData {
  bioPointScore: { score: number; breakdown: Record<string, number>; date: string } | null;
  todayLog: { sleepHours: number | null; energyLevel: number | null; focusLevel: number | null; moodLevel: number | null; weightKg: number | null } | null;
  weeklyTrend: number | null;
  activeStacks: number;
  weeklyComplianceEvents: number;
  scoreHistory: { date: string; score: number }[];
  activeFasting: { protocolName: string; startedAt: string; targetEndAt: string } | null;
  todayNutrition: { totalCalories: number; mealCount: number } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [todayItems, setTodayItems] = useState<{ id: string; name: string; dose: number; unit: string; route: string | null; stackName: string; taken: boolean }[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).catch(console.error);
    api.get("/stacks").then((res) => {
      const stacks = res.data;
      const today = new Date().getDay();
      const items: typeof todayItems = [];
      for (const stack of stacks) {
        if (!stack.isActive) continue;
        for (const item of stack.items ?? []) {
          if (item.isActive === false) continue;
          let show = false;
          if (item.scheduleDays?.length > 0) {
            show = item.scheduleDays.includes(today);
          } else {
            const f = item.frequency || "";
            if (["Daily","Morning","Evening","Twice Daily","3x Daily"].includes(f)) show = true;
            else if (f === "Weekly") show = today === 1;
            else if (f === "Twice a week") show = today === 2 || today === 5;
            else if (f === "Three times a week") show = today === 2 || today === 4 || today === 6;
          }
          if (show) items.push({ id: item.id, name: item.name, dose: item.dose, unit: item.unit, route: item.route || null, stackName: stack.name, taken: false });
        }
      }
      setTodayItems(items);
    }).catch(console.error);
  }, []);

  const score = data?.bioPointScore?.score ?? 0;
  const change = data?.weeklyTrend ?? 0;

  return (
    <div className="space-y-8 mesh-bg-dashboard">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      >
        <h1
          className="text-2xl sm:text-4xl font-bold tracking-tight mb-1 text-gradient-teal"
          style={{ fontFamily: "'Satoshi', sans-serif" }}
        >
          Dashboard
        </h1>
        <p className="text-[var(--text-muted)]">Your health intelligence at a glance</p>
      </motion.div>

      {/* Score Hero — Full Width, Biggest Tile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <GlassCard className="p-6 sm:p-10 flex flex-col items-center justify-center text-center" glow>
          <p className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-6">
            BioPoint Score
          </p>
          <div className="flex justify-center w-full">
            <ScoreRing score={score} size={220} />
          </div>
          <div className="mt-6 flex items-center gap-2">
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <MetricCard label="Active Stacks" value={data?.activeStacks ?? 0} icon={Layers} color="var(--accent)" glowVariant="accent" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <MetricCard label="Compliance Events" value={data?.weeklyComplianceEvents ?? 0} icon={Activity} color="var(--success)" glowVariant="success" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <MetricCard label="Sleep" value={data?.todayLog?.sleepHours ?? 0} unit="hrs" icon={Timer} color="var(--warning)" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <MetricCard label="Energy" value={data?.todayLog?.energyLevel ?? 0} unit="/10" icon={FlaskConical} color="#A78BFA" />
          </motion.div>
        </div>

      {/* Today's Stack + Oracle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Stack */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                Today&apos;s Stack
              </h2>
              <span className={`text-xs font-mono px-2 py-1 rounded-md ${takenIds.size === todayItems.length && todayItems.length > 0 ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--accent-muted)] text-[var(--accent)]"}`}>
                {takenIds.size}/{todayItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {todayItems.length > 0 ? (
                todayItems.map((item) => {
                  const taken = takenIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={async () => {
                        if (taken) return;
                        setTakenIds(prev => new Set([...prev, item.id]));
                        try { await api.post(`/stacks/compliance/${item.id}`, {}); } catch {}
                      }}
                      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] text-left transition-all hover:bg-[var(--glass-hover)] cursor-pointer"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${taken ? "bg-[var(--success)]" : "border-2 border-[var(--glass-border)] hover:border-[var(--accent)]"}`}>
                        {taken && <span className="text-xs text-white font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${taken ? "line-through text-[var(--text-muted)]" : ""}`}>{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.dose} {item.unit}{item.route ? ` · ${item.route}` : ""} — {item.stackName}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No items scheduled for today</p>
              )}
              {takenIds.size === todayItems.length && todayItems.length > 0 && (
                <div className="flex items-center justify-center gap-2 pt-2 text-[var(--success)]">
                  <span className="text-xs font-semibold">All done for today</span>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Oracle Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <GlassCard
            className="p-6 relative overflow-hidden cursor-pointer"
            onClick={() => router.push("/oracle")}
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
