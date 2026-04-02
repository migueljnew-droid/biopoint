"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Trophy, Layers, Plus, UserPlus, LogOut, GitFork, Crown, X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";

interface LeaderEntry { id: string; name: string; score: number; trend: string; avatar: string; elite: boolean; isUser: boolean }
interface Group { id: string; name: string; description: string | null; memberCount: number; isMember: boolean }
interface TemplateItem { name: string; dose: number; unit: string }
interface Template { id: string; name: string; description: string | null; goal: string | null; forkCount: number; items: TemplateItem[] }

export default function CommunityPage() {
  const [tab, setTab] = useState<"leaderboard" | "groups" | "templates">("leaderboard");
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [lb, gr, tp] = await Promise.all([
        api.get("/community/leaderboard"),
        api.get("/community/groups"),
        api.get("/community/templates"),
      ]);
      setLeaderboard(lb.data);
      setGroups(gr.data);
      setTemplates(tp.data);
    } catch (err) {
      console.error("Failed to fetch community data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleJoinGroup = async (id: string) => {
    try { await api.post(`/community/groups/${id}/join`); fetchData(); } catch (err) { console.error(err); }
  };

  const handleLeaveGroup = async (id: string) => {
    try { await api.post(`/community/groups/${id}/leave`); fetchData(); } catch (err) { console.error(err); }
  };

  const handleForkTemplate = async (id: string, name: string) => {
    try { await api.post(`/community/templates/${id}/fork`); alert(`${name} added to your stacks!`); } catch (err) { console.error(err); }
  };

  const handleCreateGroup = async () => {
    if (!newName.trim()) return;
    try {
      await api.post("/community/groups", { name: newName, description: newDesc, isPublic: true });
      setNewName(""); setNewDesc(""); setShowCreate(false); fetchData();
    } catch (err) { console.error(err); }
  };

  const tabs = [
    { key: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
    { key: "groups" as const, label: "Groups", icon: Users },
    { key: "templates" as const, label: "Templates", icon: Layers },
  ];

  return (
    <div className="space-y-8 mesh-bg-dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient-gold" style={{ fontFamily: "'Satoshi', sans-serif" }}>Community</h1>
          <p className="text-[var(--text-muted)] mt-1">Compete, share stacks, and connect with biohackers</p>
        </div>
        {tab === "groups" && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">
            <Plus size={18} /> Create Group
          </button>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              tab === t.key ? "bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]" : "bg-[var(--glass)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </motion.div>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>}

      {/* Leaderboard */}
      {!loading && tab === "leaderboard" && (
        <div className="space-y-2">
          {leaderboard.length === 0 && (
            <GlassCard className="p-12 text-center">
              <Trophy size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>No scores yet</h3>
              <p className="text-sm text-[var(--text-muted)]">Log your daily metrics to appear on the leaderboard</p>
            </GlassCard>
          )}
          {leaderboard.map((entry, i) => {
            const podiumGlow = i === 0 ? "gold" : i === 1 ? "none" : i === 2 ? "none" : "none";
            const podiumBorder = i === 0 ? "border-yellow-400/40" : i === 1 ? "border-gray-300/30" : i === 2 ? "border-amber-600/30" : "";
            const avatarBg = i === 0 ? "bg-yellow-400/20 text-yellow-400" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-amber-600/20 text-amber-600" : "bg-[var(--accent-muted)] text-[var(--accent)]";
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <GlassCard
                  className={`p-4 flex items-center gap-4 ${entry.isUser ? "border-[var(--accent)] border" : i < 3 ? `border ${podiumBorder}` : ""}`}
                  glow={entry.isUser ? "accent" : podiumGlow as "gold" | "none"}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <Crown
                        size={20}
                        className="mx-auto"
                        style={{
                          color: i === 0 ? "#facc15" : i === 1 ? "#d1d5db" : "#d97706",
                          filter: i === 0 ? "drop-shadow(0 0 6px #facc15)" : "none",
                        }}
                      />
                    ) : (
                      <span className="text-sm font-mono text-[var(--text-muted)]">{i + 1}</span>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarBg}`}>
                    {entry.avatar}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${entry.isUser ? "text-[var(--accent)]" : i === 0 ? "text-yellow-400" : ""}`}>
                      {entry.name} {entry.isUser && "(You)"}
                    </p>
                    {entry.elite && <span className="text-[10px] text-yellow-400 font-semibold tracking-widest">ELITE</span>}
                  </div>
                  <span className="text-xl font-bold font-mono text-[var(--accent)]">{entry.score}</span>
                  <span className="text-xs text-[var(--success)] font-mono">{entry.trend}</span>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Groups */}
      {!loading && tab === "groups" && (
        <div className="space-y-3">
          {groups.length === 0 && (
            <GlassCard className="p-12 text-center">
              <Users size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>No groups yet</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">Create the first biohacking group</p>
              <button onClick={() => setShowCreate(true)} className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 cursor-pointer">Create Group</button>
            </GlassCard>
          )}
          {groups.map((group, i) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="p-5 flex items-center justify-between" glow={group.isMember ? "accent" : "none"}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center" style={{ boxShadow: group.isMember ? "0 0 12px var(--accent-glow)" : "none" }}>
                    <Users size={20} className="text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{group.name}</p>
                    {group.description && <p className="text-xs text-[var(--text-muted)]">{group.description}</p>}
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{group.memberCount} members</p>
                  </div>
                </div>
                {group.isMember ? (
                  <button onClick={() => handleLeaveGroup(group.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-xs text-[var(--text-muted)] hover:text-[var(--error)] hover:border-[var(--error)] transition-all cursor-pointer">
                    <LogOut size={14} /> Leave
                  </button>
                ) : (
                  <button onClick={() => handleJoinGroup(group.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-glow)] transition-all cursor-pointer">
                    <UserPlus size={14} /> Join
                  </button>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Templates */}
      {!loading && tab === "templates" && (
        <div className="space-y-3">
          {templates.length === 0 && (
            <GlassCard className="p-12 text-center">
              <Layers size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>No templates yet</h3>
              <p className="text-sm text-[var(--text-muted)]">Share your stacks as templates for the community</p>
            </GlassCard>
          )}
          {templates.map((tmpl, i) => (
            <motion.div key={tmpl.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold">{tmpl.name}</p>
                    {tmpl.description && <p className="text-xs text-[var(--text-muted)]">{tmpl.description}</p>}
                    {tmpl.goal && <p className="text-xs text-[var(--accent)] mt-0.5">{tmpl.goal}</p>}
                  </div>
                  <button onClick={() => handleForkTemplate(tmpl.id, tmpl.name)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-glow)] transition-all cursor-pointer">
                    <GitFork size={14} /> Fork ({tmpl.forkCount})
                  </button>
                </div>
                {tmpl.items.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tmpl.items.map((item, j) => (
                      <span key={j} className="px-2.5 py-1 rounded-md bg-[var(--glass)] border border-[var(--glass-border)] text-xs text-[var(--text-secondary)]">
                        {item.name} {item.dose}{item.unit}
                      </span>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)}>
            <motion.div className="glass-elevated p-8 w-full max-w-md" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>Create Group</h2>
                <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Name</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all" placeholder="e.g. Peptide Protocol Club" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Description</label>
                  <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all" placeholder="What's this group about?" />
                </div>
                <button onClick={handleCreateGroup} className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">Create Group</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
