"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/authStore";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        {/* Premium loading state */}
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            {/* Outer ring */}
            <div
              className="w-14 h-14 rounded-full"
              style={{
                border: "2px solid rgba(34, 211, 238, 0.1)",
              }}
            />
            {/* Spinning accent */}
            <div
              className="absolute inset-0 w-14 h-14 rounded-full animate-spin"
              style={{
                border: "2px solid transparent",
                borderTopColor: "var(--accent)",
                borderRightColor: "rgba(34, 211, 238, 0.3)",
                filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.4))",
              }}
            />
            {/* Inner logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src="/icon.png"
                alt="BioPoint"
                className="w-7 h-7 rounded-lg opacity-80 animate-logo-pulse"
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span
              className="text-sm font-semibold text-gradient-teal"
              style={{ fontFamily: "'Satoshi', sans-serif" }}
            >
              BioPoint
            </span>
            <span className="text-xs text-[var(--text-muted)] tracking-wider uppercase">
              Loading your data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Top accent bar */}
      <div className="top-accent-bar" />

      {/* Sidebar — receives collapsed state from layout */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Main content — offset by sidebar width */}
      <motion.main
        className="flex-1 overflow-y-auto relative"
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      >
        {/* Page-level ambient gradient — subtle atmospheric layer */}
        <div
          className="fixed pointer-events-none"
          style={{
            top: 0,
            left: sidebarWidth,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse 60% 40% at 70% 0%, rgba(34, 211, 238, 0.03) 0%, transparent 60%)",
            zIndex: 0,
          }}
        />

        <div className="relative z-10 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </motion.main>
    </div>
  );
}
