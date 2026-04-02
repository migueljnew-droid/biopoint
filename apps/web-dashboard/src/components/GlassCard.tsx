"use client";

import { motion } from "framer-motion";
import { ReactNode, CSSProperties } from "react";

type GlowVariant = "accent" | "success" | "gold" | "none";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean | GlowVariant;
  onClick?: () => void;
  style?: CSSProperties;
  tilt?: boolean;
}

const glowClass: Record<GlowVariant, string> = {
  accent: "card-glow-accent",
  success: "card-glow-success",
  gold: "card-glow-gold",
  none: "",
};

export function GlassCard({
  children,
  className = "",
  hover = true,
  glow = false,
  onClick,
  style,
  tilt = false,
}: GlassCardProps) {
  const glowVariant: GlowVariant =
    glow === true ? "accent" : glow === false ? "none" : glow;

  return (
    <motion.div
      className={`glass-card ${glowClass[glowVariant]} ${tilt ? "card-tilt" : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
      whileHover={
        hover
          ? {
              y: -3,
              transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] },
            }
          : undefined
      }
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      onClick={onClick}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function GlassElevated({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`glass-elevated ${className}`} style={style}>
      {children}
    </div>
  );
}
