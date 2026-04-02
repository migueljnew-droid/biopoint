"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

type ScoreTier = "critical" | "low" | "good" | "elite";

interface TierConfig {
  label: string;
  gradientStart: string;
  gradientEnd: string;
  glowColor: string;
  glowIntensity: string;
  textColor: string;
}

const getTierConfig = (s: number): TierConfig => {
  if (s >= 90) return {
    label: "ELITE",
    gradientStart: "#FCD34D",
    gradientEnd: "#CA8A04",
    glowColor: "rgba(202, 138, 4, 0.5)",
    glowIntensity: "rgba(252, 211, 77, 0.15)",
    textColor: "#FCD34D",
  };
  if (s >= 70) return {
    label: "OPTIMAL",
    gradientStart: "#34D399",
    gradientEnd: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.5)",
    glowIntensity: "rgba(52, 211, 153, 0.12)",
    textColor: "#34D399",
  };
  if (s >= 40) return {
    label: "BUILDING",
    gradientStart: "#22D3EE",
    gradientEnd: "#0891B2",
    glowColor: "rgba(34, 211, 238, 0.5)",
    glowIntensity: "rgba(34, 211, 238, 0.12)",
    textColor: "#22D3EE",
  };
  return {
    label: "CRITICAL",
    gradientStart: "#F87171",
    gradientEnd: "#EF4444",
    glowColor: "rgba(239, 68, 68, 0.5)",
    glowIntensity: "rgba(248, 113, 113, 0.12)",
    textColor: "#F87171",
  };
};

export function ScoreRing({
  score,
  size = 220,
  strokeWidth = 10,
  showLabel = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const gradientId = useRef(`score-gradient-${Math.random().toString(36).slice(2)}`).current;
  const glowId = useRef(`score-glow-${Math.random().toString(36).slice(2)}`).current;
  const trackGlowId = useRef(`track-glow-${Math.random().toString(36).slice(2)}`).current;

  const tier = getTierConfig(score);

  // Counting animation
  const displayValue = useMotionValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const controls = animate(displayValue, score, {
      duration: 1.4,
      ease: [0.25, 1, 0.5, 1],
      delay: 0.3,
    });
    const unsubscribe = displayValue.on("change", (v) => {
      setDisplayScore(Math.round(v));
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [score, displayValue]);

  const progress = (score / 100) * circumference;

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ margin: "0 auto" }}
    >
      <div className="relative" style={{ width: size, height: size }}>
      {/* Outer ambient glow */}
      <div
        className="absolute rounded-full pointer-events-none animate-pulse-glow"
        style={{
          width: size + 40,
          height: size + 40,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse at center, ${tier.glowIntensity} 0%, transparent 70%)`,
        }}
      />

      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Gradient for the progress stroke */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={tier.gradientStart} stopOpacity="1" />
            <stop offset="50%" stopColor={tier.gradientEnd} stopOpacity="0.9" />
            <stop offset="100%" stopColor={tier.gradientStart} stopOpacity="0.7" />
          </linearGradient>

          {/* Drop shadow / glow filter for the stroke */}
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft filter for track */}
          <filter id={trackGlowId}>
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>

        {/* Outer decorative ring */}
        <circle
          cx={center}
          cy={center}
          r={radius + strokeWidth + 6}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />

        {/* Track background */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Track inner glow */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tier.gradientStart}
          strokeWidth={strokeWidth}
          strokeOpacity="0.04"
          filter={`url(#${trackGlowId})`}
        />

        {/* Progress arc — glow layer (wider, softer) */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tier.gradientStart}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1], delay: 0.3 }}
          strokeOpacity="0.15"
          filter={`url(#${glowId})`}
        />

        {/* Progress arc — main stroke */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1], delay: 0.3 }}
          style={{
            filter: `drop-shadow(0 0 6px ${tier.glowColor}) drop-shadow(0 0 12px ${tier.glowColor})`,
          }}
        />

        {/* Leading dot at arc end */}
        <motion.circle
          r={strokeWidth / 2 + 1}
          fill={tier.gradientStart}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            filter: `drop-shadow(0 0 4px ${tier.glowColor})`,
          }}
          // Position will be handled via CSS transform driven by animation
        />
      </svg>

      {/* Center content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ transform: "rotate(0deg)" }}
      >
        <motion.span
          className="text-5xl font-bold tracking-tight tabular-nums"
          style={{
            fontFamily: "'Satoshi', sans-serif",
            color: tier.textColor,
            textShadow: `0 0 20px ${tier.glowColor}, 0 0 40px ${tier.glowColor.replace('0.5', '0.2')}`,
            lineHeight: 1,
          }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 1, 0.5, 1] }}
        >
          {displayScore}
        </motion.span>

        <motion.span
          className="text-xs font-semibold tracking-[0.15em] uppercase mt-1.5"
          style={{ color: "var(--text-muted)", fontFamily: "'General Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          / 100
        </motion.span>
      </div>
      </div>

      {/* Label below */}
      {showLabel && (
        <motion.div
          className="mt-4 flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full"
            style={{
              color: tier.textColor,
              background: tier.glowIntensity.replace('0.12', '0.15'),
              border: `1px solid ${tier.gradientStart}30`,
              textShadow: `0 0 10px ${tier.glowColor}`,
            }}
          >
            {tier.label}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            BioPoint Score
          </span>
        </motion.div>
      )}
    </div>
  );
}
