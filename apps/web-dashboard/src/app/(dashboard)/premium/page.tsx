"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, FlaskConical, Brain, Shield, TrendingUp, Crown, Check, Star } from "lucide-react";

const FEATURES = [
  { icon: FlaskConical, label: "Unlimited AI Lab Analysis", desc: "Upload and analyze unlimited blood work reports" },
  { icon: Brain, label: "The Oracle — Unlimited AI Chat", desc: "No message limits on your AI health advisor" },
  { icon: TrendingUp, label: "Advanced Trend Analytics", desc: "Deep biomarker trends, correlations, and predictions" },
  { icon: Zap, label: "Unlimited Stacks & Items", desc: "No cap on supplement protocols and items" },
  { icon: Shield, label: "Priority Data Encryption", desc: "Military-grade AES-256 for all your health data" },
  { icon: Star, label: "Community Pro Badge", desc: "Stand out on leaderboards with your Pro status" },
];

const PLANS = [
  { id: "monthly", name: "Monthly", price: "$9.99", period: "/mo", trial: "Recurring billing", popular: false },
  { id: "yearly", name: "Yearly", price: "$79.99", period: "/yr", trial: "7-day free trial", popular: true, savings: "Save 33%" },
];

export default function PremiumPage() {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    // RevenueCat handles subscriptions — web redirects to App Store for now
    // When Stripe web checkout is configured, this will redirect to a checkout session
    setTimeout(() => {
      window.open("https://apps.apple.com/app/biopoint/id6740043838", "_blank");
      setPurchasing(false);
    }, 800);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Hero */}
      <motion.div
        className="text-center pt-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      >
        {/* Animated crown */}
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
          style={{ background: "linear-gradient(135deg, var(--gold-muted), rgba(252,211,77,0.15))", border: "1px solid rgba(202,138,4,0.3)" }}
          animate={{ rotate: [0, -3, 3, -3, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Crown size={36} className="text-[var(--gold-light)]" style={{ filter: "drop-shadow(0 0 12px rgba(252,211,77,0.5))" }} />
        </motion.div>

        <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>
          Upgrade to <span className="text-gradient-gold">BioPoint+</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg">Unlock the full power of your biology</p>
      </motion.div>

      {/* Features */}
      <motion.div className="space-y-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--gold-muted)", border: "1px solid rgba(202,138,4,0.2)" }}>
                <feature.icon size={20} className="text-[var(--gold-light)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{feature.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
              </div>
              <Check size={18} className="text-[var(--gold-light)] flex-shrink-0" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Plan Selector */}
      <motion.div className="space-y-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer relative overflow-hidden ${
              selectedPlan === plan.id ? "border-[var(--gold)] bg-[var(--gold-muted)]" : "border-[var(--glass-border)] bg-[var(--glass)] hover:border-[var(--glass-border-hover)]"
            }`}
          >
            {plan.popular && (
              <motion.div
                className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--gold)", color: "var(--bg-primary)" }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Most Popular
              </motion.div>
            )}
            <div className="flex items-center justify-between pl-8">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold">{plan.name}</p>
                  {plan.savings && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[var(--success)]">{plan.savings}</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{plan.trial}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif", color: selectedPlan === plan.id ? "var(--gold-light)" : "var(--text-primary)" }}>
                  {plan.price}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{plan.period}</p>
              </div>
            </div>
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selectedPlan === plan.id ? "border-[var(--gold)] bg-[var(--gold)]" : "border-[var(--glass-border)]"
            }`}>
              {selectedPlan === plan.id && <Check size={12} className="text-[var(--bg-primary)]" />}
            </div>
          </button>
        ))}
      </motion.div>

      {/* Purchase Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #FCD34D, #CA8A04)",
            color: "var(--bg-primary)",
            boxShadow: "0 8px 32px rgba(202,138,4,0.3), 0 0 60px rgba(252,211,77,0.1)",
          }}
        >
          {purchasing ? (
            <div className="w-5 h-5 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Sparkles size={20} /> Start Free Trial</>
          )}
        </button>
        <p className="text-center text-xs text-[var(--text-muted)] mt-3">Cancel anytime. No charge until trial ends.</p>
      </motion.div>

      {/* Trust indicators */}
      <motion.div className="flex items-center justify-center gap-6 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        {["HIPAA Compliant", "256-bit Encryption", "Cancel Anytime"].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <Shield size={12} className="text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
