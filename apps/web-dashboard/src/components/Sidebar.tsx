"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Layers,
  FlaskConical,
  Timer,
  Sparkles,
  CalendarDays,
  Camera,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/stacks", icon: Layers, label: "Stacks" },
  { href: "/labs", icon: FlaskConical, label: "Labs" },
  { href: "/fasting", icon: Timer, label: "Fasting" },
  { href: "/oracle", icon: Sparkles, label: "The Oracle" },
  { href: "/log", icon: CalendarDays, label: "Daily Log" },
  { href: "/progress", icon: Camera, label: "Progress" },
  { href: "/community", icon: Users, label: "Community" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <motion.aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden"
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      style={{
        background:
          "linear-gradient(180deg, rgba(13,13,21,0.98) 0%, rgba(10,10,16,0.99) 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "4px 0 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Subtle left-edge glow */}
      <div
        className="absolute inset-y-0 left-0 w-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.3) 40%, rgba(16,185,129,0.2) 60%, transparent 100%)",
        }}
      />

      {/* Top ambient glow behind logo */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(34,211,238,0.06) 0%, transparent 70%)",
        }}
      />

      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 h-16 flex-shrink-0 relative"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <motion.div
          className="relative flex-shrink-0 animate-logo-pulse"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="w-8 h-8 rounded-xl overflow-hidden"
            style={{
              boxShadow: "0 0 16px rgba(34,211,238,0.25)",
              border: "1px solid rgba(34,211,238,0.2)",
            }}
          >
            <img
              src="/icon.png"
              alt="BioPoint"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Ping dot — "live" indicator */}
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse-ring"
            style={{
              background: "var(--success)",
              boxShadow: "0 0 6px var(--success-glow)",
            }}
          />
        </motion.div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="flex flex-col leading-none"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <span
                className="text-base font-bold tracking-tight text-gradient-teal"
                style={{ fontFamily: "'Satoshi', sans-serif" }}
              >
                BioPoint
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Command Center
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            >
              <Link
                href={item.href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden"
                style={{
                  background: isActive
                    ? "rgba(34, 211, 238, 0.08)"
                    : "transparent",
                  color: isActive
                    ? "var(--accent)"
                    : "var(--text-muted)",
                }}
              >
                {/* Hover fill background */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />

                {/* Active glow indicator bar */}
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                    layoutId="activeIndicator"
                    style={{
                      width: "3px",
                      height: "20px",
                      background: "var(--accent)",
                      boxShadow:
                        "0 0 8px var(--accent-glow), 0 0 20px rgba(34,211,238,0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Active background shimmer */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(34,211,238,0.06) 0%, transparent 80%)",
                    }}
                  />
                )}

                <item.icon
                  size={18}
                  className="flex-shrink-0 relative z-10 transition-colors duration-200"
                  style={{
                    color: isActive ? "var(--accent)" : undefined,
                    filter: isActive
                      ? "drop-shadow(0 0 6px rgba(34,211,238,0.5))"
                      : undefined,
                  }}
                />

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      className="text-sm font-medium whitespace-nowrap relative z-10 transition-colors duration-200 group-hover:text-[var(--text-primary)]"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        color: isActive ? "var(--accent)" : undefined,
                        fontFamily: "'General Sans', sans-serif",
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip on collapsed */}
                {collapsed && (
                  <div
                    className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* ── Premium Banner ── */}
      {!collapsed && (
        <div className="px-3 py-2">
          <Link
            href="/premium"
            className="block p-3 rounded-xl transition-all hover:brightness-110 cursor-pointer"
            style={{ background: "linear-gradient(135deg, rgba(202,138,4,0.15), rgba(252,211,77,0.08))", border: "1px solid rgba(202,138,4,0.2)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-[var(--gold-light)]" />
              <span className="text-xs font-bold text-[var(--gold-light)]">BioPoint+</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Unlock unlimited AI analysis</p>
          </Link>
        </div>
      )}

      {/* ── Divider ── */}
      <div
        className="mx-3 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        }}
      />

      {/* ── Bottom section ── */}
      <div className="px-2 py-3 space-y-0.5">
        <Link
          href="/settings"
          className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-200 group overflow-hidden"
        >
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[rgba(255,255,255,0.04)]" />
          <Settings
            size={18}
            className="flex-shrink-0 relative z-10 transition-transform duration-200 group-hover:rotate-45"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className="text-sm font-medium whitespace-nowrap relative z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* User block */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent-muted), rgba(16,185,129,0.15))",
                  border: "1px solid rgba(34,211,238,0.2)",
                  color: "var(--accent)",
                }}
              >
                {user.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span
                className="text-xs text-[var(--text-muted)] truncate flex-1"
                style={{ maxWidth: "120px" }}
              >
                {user.email}
              </span>
              <button
                onClick={logout}
                className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors duration-200 flex-shrink-0"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 w-full group"
        >
          <motion.div
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
          >
            <ChevronRight size={18} />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className="text-sm font-medium whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
