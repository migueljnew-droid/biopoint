"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Target, Heart, Bell, Scale, Shield, FileText, LogOut, ChevronRight, Download, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Profile {
  sex: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  baselineWeightKg: number | null;
  goals: string[];
  dietStyle: string | null;
  onboardingComplete: boolean;
}

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [units, setUnitsState] = useState<"metric" | "imperial">("imperial");
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("bp_units") : null;
    if (saved === "metric" || saved === "imperial") setUnitsState(saved);
  }, []);

  const setUnits = (u: "metric" | "imperial") => {
    setUnitsState(u);
    if (typeof window !== "undefined") localStorage.setItem("bp_units", u);
  };
  const [editModal, setEditModal] = useState<"details" | "goals" | "health" | null>(null);
  const [editSex, setEditSex] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [editDiet, setEditDiet] = useState("");

  const GOAL_OPTIONS = ["Build Muscle", "Lose Fat", "Improve Sleep", "Boost Energy", "Increase Focus", "Longevity", "Recovery", "Gut Health", "Hormone Optimization", "Immune Support"];
  const DIET_OPTIONS = ["Standard", "Keto", "Carnivore", "Paleo", "Vegan", "Vegetarian", "Mediterranean", "Intermittent Fasting", "Other"];

  useEffect(() => {
    api.get("/profile").then((res) => {
      setProfile(res.data);
      setEditSex(res.data.sex || "");
      setEditDob(res.data.dateOfBirth?.split("T")[0] || "");
      setEditHeight(res.data.heightCm?.toString() || "");
      setEditWeight(res.data.baselineWeightKg?.toString() || "");
      setEditGoals(res.data.goals || []);
      setEditDiet(res.data.dietStyle || "");
    }).catch(console.error);
  }, []);

  const saveProfile = async (data: Record<string, unknown>) => {
    try {
      const res = await api.put("/profile", data);
      setProfile(res.data);
      setEditModal(null);
    } catch { alert("Failed to save"); }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      await logout();
      router.push("/login");
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.get("/user/data-export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "biopoint-data-export.json"; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Export failed"); }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("This will permanently delete your account and all data. This cannot be undone. Are you sure?")) return;
    if (!confirm("FINAL WARNING: All your stacks, labs, scores, and health data will be permanently deleted.")) return;
    try {
      await api.delete("/user/account");
      await logout();
      router.push("/login");
    } catch { alert("Account deletion failed. Contact support."); }
  };

  const SettingItem = ({ icon: Icon, label, value, onClick, danger }: { icon: typeof User; label: string; value?: string; onClick?: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between py-3.5 px-4 transition-all hover:bg-[var(--glass-hover)] cursor-pointer ${danger ? "hover:bg-[rgba(239,68,68,0.05)]" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? "bg-[rgba(239,68,68,0.1)]" : "bg-[var(--accent-muted)]"}`}>
          <Icon size={18} className={danger ? "text-[var(--error)]" : "text-[var(--accent)]"} />
        </div>
        <span className={`text-sm font-medium ${danger ? "text-[var(--error)]" : ""}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-[var(--text-muted)]">{value}</span>}
        <ChevronRight size={16} className="text-[var(--text-muted)]" />
      </div>
    </button>
  );

  const ToggleItem = ({ icon: Icon, label, value, onChange }: { icon: typeof User; label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-3.5 px-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center">
          <Icon size={18} className="text-[var(--accent)]" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${value ? "bg-[var(--accent)]" : "bg-[var(--glass-border)]"}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${value ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif" }}>Settings</h1>
        <p className="text-[var(--text-muted)] mt-1">Manage your account and preferences</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-muted)] flex items-center justify-center text-2xl font-bold text-[var(--accent)]">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                {user?.name || "Athlete"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
              <span className="inline-block mt-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
                BioPoint+
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">Account</p>
        <GlassCard className="divide-y divide-[var(--glass-border)] overflow-hidden">
          <SettingItem icon={User} label="Personal Details" value={profile?.sex || "Not set"} onClick={() => setEditModal("details")} />
          <SettingItem icon={Target} label="My Goals" value={profile?.goals?.length ? `${profile.goals.length} goals` : "Not set"} onClick={() => setEditModal("goals")} />
          <SettingItem icon={Heart} label="Health Profile" value={profile?.dietStyle || "Not set"} onClick={() => setEditModal("health")} />
        </GlassCard>
      </motion.div>

      {/* Preferences */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">Preferences</p>
        <GlassCard className="divide-y divide-[var(--glass-border)] overflow-hidden">
          <ToggleItem icon={Bell} label="Notifications" value={notifications} onChange={setNotifications} />
          <SettingItem icon={Scale} label="Units" value={units === "metric" ? "Metric (kg/cm)" : "Imperial (lb/in)"} onClick={() => setUnits(units === "metric" ? "imperial" : "metric")} />
        </GlassCard>
      </motion.div>

      {/* Support & Legal */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">Support</p>
        <GlassCard className="divide-y divide-[var(--glass-border)] overflow-hidden">
          <SettingItem icon={Shield} label="Privacy Policy" onClick={() => window.open("https://biopoint-privacy.vercel.app", "_blank")} />
          <SettingItem icon={FileText} label="Access Logs (HIPAA)" />
          <SettingItem icon={Download} label="Export My Data" onClick={handleExportData} />
        </GlassCard>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">Account Actions</p>
        <GlassCard className="divide-y divide-[var(--glass-border)] overflow-hidden">
          <SettingItem icon={LogOut} label="Log Out" onClick={handleLogout} danger />
          <SettingItem icon={Trash2} label="Delete Account" onClick={handleDeleteAccount} danger />
        </GlassCard>
      </motion.div>

      <p className="text-center text-xs text-[var(--text-muted)] pb-8">Version 1.0.0 · BioPoint Web Dashboard</p>

      {/* Edit Modals */}
      <AnimatePresence>
        {editModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditModal(null)}>
            <motion.div className="glass-elevated p-8 w-full max-w-md" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  {editModal === "details" ? "Personal Details" : editModal === "goals" ? "My Goals" : "Health Profile"}
                </h2>
                <button onClick={() => setEditModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={20} /></button>
              </div>

              {editModal === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Sex</label>
                    <div className="flex gap-2">
                      {[{label: "Male", value: "male"}, {label: "Female", value: "female"}, {label: "Other", value: "other"}].map(s => (
                        <button key={s.value} onClick={() => setEditSex(s.value)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${editSex === s.value ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]"}`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Date of Birth</label>
                    <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Height ({units === "imperial" ? "ft/in" : "cm"})</label>
                      {units === "imperial" ? (
                        <div className="flex gap-2">
                          <select value={editHeight ? Math.floor(parseFloat(editHeight) / 30.48).toString() : ""} onChange={(e) => { const ft = parseInt(e.target.value) || 0; const existingIn = editHeight ? Math.round((parseFloat(editHeight) / 2.54) % 12) : 0; setEditHeight(((ft * 12 + existingIn) * 2.54).toFixed(1)); }} className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                            <option value="">ft</option>
                            {[3,4,5,6,7].map(ft => <option key={ft} value={ft}>{ft} ft</option>)}
                          </select>
                          <select value={editHeight ? Math.round((parseFloat(editHeight) / 2.54) % 12).toString() : ""} onChange={(e) => { const inches = parseInt(e.target.value) || 0; const existingFt = editHeight ? Math.floor(parseFloat(editHeight) / 30.48) : 5; setEditHeight(((existingFt * 12 + inches) * 2.54).toFixed(1)); }} className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                            <option value="">in</option>
                            {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => <option key={i} value={i}>{i} in</option>)}
                          </select>
                        </div>
                      ) : (
                        <select value={editHeight || ""} onChange={(e) => setEditHeight(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                          <option value="">Select</option>
                          {Array.from({length: 61}, (_, i) => 140 + i).map(cm => <option key={cm} value={cm}>{cm} cm</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Weight ({units === "imperial" ? "lbs" : "kg"})</label>
                      <input type="number" value={units === "imperial" && editWeight ? (parseFloat(editWeight) * 2.20462).toFixed(0) : editWeight} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setEditWeight(units === "imperial" ? (val / 2.20462).toFixed(1) : val.toString()); }} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all" placeholder={units === "imperial" ? "180" : "80"} />
                    </div>
                  </div>
                  <button onClick={() => {
                    const data: Record<string, unknown> = {};
                    if (editSex) data.sex = editSex;
                    if (editDob) data.dateOfBirth = new Date(editDob + "T00:00:00.000Z").toISOString();
                    if (editHeight) data.heightCm = parseFloat(editHeight);
                    if (editWeight) data.baselineWeightKg = parseFloat(editWeight);
                    saveProfile(data);
                  }} className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">Save</button>
                </div>
              )}

              {editModal === "goals" && (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-muted)]">Select your optimization goals</p>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map(goal => (
                      <button key={goal} onClick={() => setEditGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal])} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${editGoals.includes(goal) ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]"}`}>{goal}</button>
                    ))}
                  </div>
                  <button onClick={() => saveProfile({ goals: editGoals })} className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">Save Goals</button>
                </div>
              )}

              {editModal === "health" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Diet Style</label>
                    <div className="flex flex-wrap gap-2">
                      {DIET_OPTIONS.map(d => (
                        <button key={d} onClick={() => setEditDiet(d)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${editDiet === d ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]"}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => saveProfile({ dietStyle: editDiet })} className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">Save</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
