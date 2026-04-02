"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { LayoutDashboard, Layers, FlaskConical, Timer, Sparkles, CalendarDays, Camera, Users, Settings, Menu, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/authStore";

const mobileNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/stacks", icon: Layers, label: "Stacks" },
  { href: "/labs", icon: FlaskConical, label: "Labs" },
  { href: "/oracle", icon: Sparkles, label: "Oracle" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-14 h-14 rounded-full" style={{ border: "2px solid rgba(34, 211, 238, 0.1)" }} />
            <div className="absolute inset-0 w-14 h-14 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "var(--accent)", borderRightColor: "rgba(34, 211, 238, 0.3)", filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.4))" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/icon.png" alt="BioPoint" className="w-7 h-7 rounded-lg opacity-80 animate-logo-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-gradient-teal" style={{ fontFamily: "'Satoshi', sans-serif" }}>BioPoint</span>
            <span className="text-xs text-[var(--text-muted)] tracking-wider uppercase">Loading your data...</span>
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

      {/* Desktop Sidebar — hidden on mobile */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      )}

      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14" style={{ background: "rgba(5,5,10,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden" style={{ boxShadow: "0 0 12px rgba(34,211,238,0.2)", border: "1px solid rgba(34,211,238,0.2)" }}>
              <img src="/icon.png" alt="BioPoint" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-bold text-gradient-teal" style={{ fontFamily: "'Satoshi', sans-serif" }}>BioPoint</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {mobileMenuOpen ? <X size={20} className="text-[var(--text-primary)]" /> : <Menu size={20} className="text-[var(--text-primary)]" />}
          </button>
        </div>
      )}

      {/* Mobile Slide-Down Menu */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 pt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              className="relative mx-3 mt-2 rounded-2xl overflow-hidden"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              style={{ background: "rgba(13,13,21,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <nav className="p-3 space-y-1">
                {[
                  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
                  { href: "/stacks", icon: Layers, label: "Stacks" },
                  { href: "/labs", icon: FlaskConical, label: "Labs" },
                  { href: "/fasting", icon: Timer, label: "Fasting" },
                  { href: "/oracle", icon: Sparkles, label: "The Oracle" },
                  { href: "/log", icon: CalendarDays, label: "Daily Log" },
                  { href: "/progress", icon: Camera, label: "Progress" },
                  { href: "/community", icon: Users, label: "Community" },
                  { href: "/settings", icon: Settings, label: "Settings" },
                ].map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all" style={{ background: isActive ? "rgba(34,211,238,0.08)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>
                      <item.icon size={18} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.main
        className="flex-1 overflow-y-auto relative"
        animate={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      >
        <div
          className="fixed pointer-events-none"
          style={{
            top: 0,
            left: isMobile ? 0 : sidebarWidth,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse 60% 40% at 70% 0%, rgba(34, 211, 238, 0.03) 0%, transparent 60%)",
            zIndex: 0,
          }}
        />

        <div className={`relative z-10 ${isMobile ? "pt-16 pb-20 px-4" : "p-8"}`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </motion.main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 px-2" style={{ background: "rgba(5,5,10,0.95)", borderTop: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-1 px-3 transition-colors">
                <item.icon size={20} style={{ color: isActive ? "var(--accent)" : "var(--text-muted)", filter: isActive ? "drop-shadow(0 0 6px rgba(34,211,238,0.4))" : "none" }} />
                <span className="text-[10px] font-medium" style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
