"use client";

import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: { value: number; direction: "up" | "down" | "stable" };
  color?: string;
  glowVariant?: "accent" | "success" | "gold" | "none";
  subtitle?: string;
}

const trendConfig = {
  up: {
    Icon: TrendingUp,
    textColor: "var(--success)",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.2)",
    prefix: "+",
  },
  down: {
    Icon: TrendingDown,
    textColor: "var(--error)",
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.2)",
    prefix: "",
  },
  stable: {
    Icon: Minus,
    textColor: "var(--text-muted)",
    bg: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.08)",
    prefix: "",
  },
};

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  color = "var(--accent)",
  glowVariant = "none",
  subtitle,
}: MetricCardProps) {
  const t = trend ? trendConfig[trend.direction] : null;

  return (
    <GlassCard className="p-5 overflow-hidden" glow={glowVariant}>
      {/* Subtle top gradient accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: 0.4,
        }}
      />

      {/* Background ambient glow matching icon color */}
      <div
        className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${color.replace('var(', 'color-mix(in srgb, ').replace(')', ' 20%, transparent)')} 0%, transparent 70%)`,
          opacity: 0.3,
        }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        {/* Icon with colored background */}
        <motion.div
          className="relative"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: `color-mix(in srgb, ${color} 12%, rgba(255,255,255,0.03))`,
              border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
              boxShadow: `0 0 16px color-mix(in srgb, ${color} 15%, transparent)`,
            }}
          >
            <Icon
              size={20}
              style={{
                color,
                filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 60%, transparent))`,
              }}
            />
          </div>
        </motion.div>

        {/* Trend badge */}
        {t && trend && (
          <motion.div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{
              color: t.textColor,
              background: t.bg,
              border: `1px solid ${t.border}`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <t.Icon size={12} />
            <span>
              {t.prefix}{trend.value}%
            </span>
          </motion.div>
        )}
      </div>

      {/* Value */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
      >
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-3xl font-bold tracking-tight tabular-nums"
            style={{
              fontFamily: "'Satoshi', sans-serif",
              color,
              textShadow: `0 0 20px color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            {value}
          </span>
          {unit && (
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {unit}
            </span>
          )}
        </div>

        <p
          className="text-sm font-medium mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </p>

        {subtitle && (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </motion.div>

      {/* Bottom mini progress bar — visual accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            opacity: 0.5,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
        />
      </div>
    </GlassCard>
  );
}
