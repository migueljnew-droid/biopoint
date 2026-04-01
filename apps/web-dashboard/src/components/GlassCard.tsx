"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", hover = true, glow = false, onClick }: GlassCardProps) {
  return (
    <motion.div
      className={`glass-card ${glow ? "accent-glow" : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
      whileHover={hover ? { scale: 1.01, borderColor: "rgba(255,255,255,0.14)" } : undefined}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

export function GlassElevated({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-elevated ${className}`}>{children}</div>;
}
