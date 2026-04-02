"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Zap } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { api, setTokens } from "@/lib/api";

/* ── CSS-only floating particle data ── */
const PARTICLES = [
  { x: "8%", y: "15%", size: 2, delay: "0s", duration: "8s", opacity: 0.4 },
  { x: "92%", y: "20%", size: 3, delay: "1.2s", duration: "11s", opacity: 0.3 },
  { x: "15%", y: "75%", size: 2, delay: "2.5s", duration: "9s", opacity: 0.35 },
  { x: "85%", y: "65%", size: 4, delay: "0.8s", duration: "13s", opacity: 0.25 },
  { x: "50%", y: "8%", size: 2, delay: "3s", duration: "10s", opacity: 0.3 },
  { x: "30%", y: "90%", size: 3, delay: "1.8s", duration: "12s", opacity: 0.25 },
  { x: "70%", y: "88%", size: 2, delay: "4s", duration: "8.5s", opacity: 0.35 },
  { x: "5%", y: "50%", size: 3, delay: "0.4s", duration: "14s", opacity: 0.2 },
  { x: "95%", y: "45%", size: 2, delay: "2s", duration: "9.5s", opacity: 0.3 },
  { x: "45%", y: "95%", size: 4, delay: "3.5s", duration: "11.5s", opacity: 0.2 },
  { x: "60%", y: "5%", size: 2, delay: "1.5s", duration: "7.5s", opacity: 0.4 },
  { x: "22%", y: "40%", size: 2, delay: "5s", duration: "10s", opacity: 0.25 },
];

/* ── DNA helix ring decorative element ── */
function DNAHelix() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large outer orbit ring */}
      <div
        className="absolute rounded-full animate-spin-slow"
        style={{
          width: 600,
          height: 600,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(34, 211, 238, 0.04)",
        }}
      />
      {/* Mid orbit ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 440,
          height: 440,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(16, 185, 129, 0.04)",
          animation: "spin-slow 30s linear infinite reverse",
        }}
      />
      {/* Inner orbit ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px dashed rgba(34, 211, 238, 0.06)",
          animation: "spin-slow 20s linear infinite",
        }}
      />

      {/* Orbiting dot on outer ring */}
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          width: 600,
          height: 600,
          marginTop: -300,
          marginLeft: -300,
          animation: "orbit 18s linear infinite",
        }}
      >
        <div
          className="absolute w-2 h-2 rounded-full"
          style={{
            top: "50%",
            left: "0%",
            transform: "translate(-50%, -50%)",
            background: "var(--accent)",
            boxShadow: "0 0 8px rgba(34, 211, 238, 0.6)",
          }}
        />
      </div>

      {/* Orbiting dot on inner ring — opposite direction */}
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          width: 300,
          height: 300,
          marginTop: -150,
          marginLeft: -150,
          animation: "orbit 12s linear infinite reverse",
        }}
      >
        <div
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            top: "50%",
            left: "100%",
            transform: "translate(-50%, -50%)",
            background: "var(--success)",
            boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)",
          }}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login, register, error, clearError } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      router.push("/dashboard");
    } catch {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) console.error("Google sign-in error:", oauthError);
  };

  const handleAppleSignIn = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) console.error("Apple sign-in error:", oauthError);
  };

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg-auth px-4 overflow-hidden relative">
      {/* Top accent bar */}
      <div className="top-accent-bar" />

      {/* ── Layered atmospheric glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Primary teal glow — top-center */}
        <motion.div
          className="absolute animate-mesh-drift"
          style={{
            width: 700,
            height: 700,
            borderRadius: "50%",
            top: "-15%",
            left: "50%",
            transform: "translateX(-50%)",
            background:
              "radial-gradient(ellipse at center, rgba(34, 211, 238, 0.07) 0%, transparent 65%)",
          }}
        />
        {/* Success glow — bottom-left */}
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            bottom: "-10%",
            left: "-5%",
            background:
              "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.05) 0%, transparent 65%)",
            animation: "mesh-drift 16s ease-in-out infinite 4s",
          }}
        />
        {/* Gold glow — bottom-right */}
        <div
          className="absolute"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            bottom: "0%",
            right: "5%",
            background:
              "radial-gradient(ellipse at center, rgba(202, 138, 4, 0.04) 0%, transparent 65%)",
            animation: "mesh-drift 20s ease-in-out infinite 8s",
          }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 211, 238, 0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 211, 238, 0.025) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
          }}
        />
      </div>

      {/* ── CSS particles ── */}
      {mounted &&
        PARTICLES.map((p, i) => (
          <div
            key={i}
            className="fixed rounded-full pointer-events-none"
            style={{
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              background: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--success)" : "var(--gold-light)",
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 3}px currentColor`,
              animation: `float ${p.duration} ease-in-out infinite ${p.delay}`,
            }}
          />
        ))}

      {/* ── DNA helix rings ── */}
      <DNAHelix />

      {/* ── Main card ── */}
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
      >
        {/* ── Logo block ── */}
        <motion.div
          className="flex flex-col items-center mb-10"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {/* Logo mark with pulse ring */}
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-2xl animate-pulse-ring"
              style={{
                background: "transparent",
                border: "1px solid rgba(34, 211, 238, 0.2)",
              }}
            />
            <motion.div
              className="w-16 h-16 rounded-2xl overflow-hidden animate-logo-pulse relative z-10"
              style={{
                border: "1px solid rgba(34, 211, 238, 0.25)",
                boxShadow:
                  "0 0 30px rgba(34, 211, 238, 0.2), 0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
              whileHover={{ scale: 1.05 }}
            >
              <img
                src="/icon.png"
                alt="BioPoint"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>

          <h2
            className="text-3xl font-bold tracking-tight text-gradient-teal"
            style={{ fontFamily: "'Satoshi', sans-serif" }}
          >
            BioPoint
          </h2>
          <p
            className="text-xs tracking-[0.2em] uppercase font-medium mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Your Stack, Organized
          </p>
        </motion.div>

        {/* ── Glass card ── */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {/* Animated border gradient */}
          <div
            className="absolute -inset-[1px] rounded-[18px] pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.3) 0%, rgba(16,185,129,0.2) 40%, rgba(202,138,4,0.15) 70%, rgba(34,211,238,0.2) 100%)",
              backgroundSize: "300% 300%",
              animation: "gradient-shift 6s ease-in-out infinite",
              borderRadius: 18,
              padding: "1px",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          <div
            className="relative glass-elevated p-8 rounded-[17px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(15,15,22,0.95) 0%, rgba(10,10,16,0.98) 100%)",
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
            }}
          >
            {/* Card top glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)",
              }}
            />

            {/* Heading */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? "register" : "login"}
                className="text-center mb-8"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <h1
                  className="text-2xl font-bold mb-2"
                  style={{ fontFamily: "'Satoshi', sans-serif" }}
                >
                  {isRegister ? "Start your journey" : "Welcome back"}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {isRegister
                    ? "Start managing your peptides & supplements"
                    : "Sign in to manage your protocol"}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  className="block text-xs font-semibold mb-2 uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-xs font-semibold mb-2 uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    className="input-field w-full px-4 py-3 pr-12 rounded-xl text-sm"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200 cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                    style={{
                      color: "var(--error)",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                    }}
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--error)" }}
                    />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: submitting
                    ? "var(--accent)"
                    : "linear-gradient(135deg, var(--accent) 0%, #0EA5E9 100%)",
                  color: "var(--bg-primary)",
                  boxShadow: "0 4px 24px rgba(34, 211, 238, 0.25)",
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.15 }}
              >
                {submitting ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "rgba(5,5,10,0.3)",
                        borderTopColor: "var(--bg-primary)",
                      }}
                    />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Zap size={15} />
                    <span>{isRegister ? "Create Account" : "Sign In"}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                or
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
            </div>

            {/* OAuth Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-secondary)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={handleAppleSignIn}
                className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-secondary)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z"/>
                </svg>
                Apple
              </button>
            </div>

            {/* Toggle */}
            <p className="text-sm text-center mt-4" style={{ color: "var(--text-muted)" }}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  clearError();
                }}
                className="font-semibold transition-colors duration-200 cursor-pointer"
                style={{ color: "var(--accent)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
              >
                {isRegister ? "Sign In" : "Create account"}
              </button>
            </p>
          </div>
        </motion.div>

        {/* Footer tagline */}
        <motion.p
          className="text-center text-xs mt-6"
          style={{ color: "var(--text-muted)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Your biology, optimized.{" "}
          <span style={{ color: "rgba(34, 211, 238, 0.5)" }}>Scientifically.</span>
        </motion.p>
      </motion.div>
    </div>
  );
}
