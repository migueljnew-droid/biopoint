"use client";

import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: { value: number; direction: "up" | "down" | "stable" };
  color?: string;
}

export function MetricCard({ label, value, unit, icon: Icon, trend, color = "var(--accent)" }: MetricCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {trend && (
          <span
            className="text-xs font-mono font-semibold px-2 py-1 rounded-md"
            style={{
              color: trend.direction === "up" ? "var(--success)" : trend.direction === "down" ? "var(--error)" : "var(--text-muted)",
              background: trend.direction === "up" ? "rgba(16,185,129,0.1)" : trend.direction === "down" ? "rgba(239,68,68,0.1)" : "var(--glass)",
            }}
          >
            {trend.direction === "up" ? "+" : trend.direction === "down" ? "" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      <motion.div
        className="font-mono text-3xl font-bold tracking-tight"
        style={{ fontFamily: "'Satoshi', sans-serif", color }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      >
        {value}
        {unit && <span className="text-base font-normal text-[var(--text-muted)] ml-1">{unit}</span>}
      </motion.div>
      <p className="text-sm text-[var(--text-muted)] mt-1">{label}</p>
    </GlassCard>
  );
}
