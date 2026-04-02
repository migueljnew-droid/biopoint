"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Edit3, Trash2, ChevronDown, ChevronUp, Clock, Pill, X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

interface StackItem {
  id: string;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  timing: string;
  taken?: boolean;
}

interface Stack {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  items: StackItem[];
}

export default function StacksPage() {
  const router = useRouter();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addingToStackId, setAddingToStackId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemDose, setItemDose] = useState("");
  const [itemUnit, setItemUnit] = useState("mg");
  const [itemFrequency, setItemFrequency] = useState("Daily");
  const [itemTiming, setItemTiming] = useState("Morning");
  const [itemDays, setItemDays] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; category: string; typicalDose: { min: number; max: number; unit: string }; route: string; frequency: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const fetchStacks = async () => {
    try {
      const res = await api.get("/stacks");
      setStacks(res.data);
    } catch (err) {
      console.error("Failed to fetch stacks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStacks(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.post("/stacks", { name: newName, description: newDesc });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchStacks();
    } catch (err) {
      console.error("Failed to create stack:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this stack?")) return;
    try {
      await api.delete(`/stacks/${id}`);
      fetchStacks();
    } catch (err) {
      console.error("Failed to delete stack:", err);
    }
  };

  const [compoundDb, setCompoundDb] = useState<typeof searchResults>([]);

  useEffect(() => {
    fetch("/peptideDatabase.json").then(r => r.json()).then(data => {
      setCompoundDb(data.map((c: Record<string, unknown>) => ({
        id: c.id as string, name: c.name as string, category: c.category as string,
        typicalDose: c.typicalDose as { min: number; max: number; unit: string },
        route: c.route as string, frequency: c.frequency as string,
      })));
    }).catch(() => {});
  }, []);

  const searchCompounds = (q: string) => {
    if (q.length < 2) { setSearchResults([]); setShowSearch(false); return; }
    const lower = q.toLowerCase();
    const results = compoundDb.filter(c => c.name.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower)).slice(0, 8);
    setSearchResults(results);
    setShowSearch(results.length > 0);
  };

  const selectCompound = (c: typeof searchResults[0]) => {
    setItemName(c.name);
    setItemDose(c.typicalDose?.min?.toString() || "");
    setItemUnit(c.typicalDose?.unit || "mg");
    setItemFrequency(c.frequency || "Daily");
    setShowSearch(false);
  };

  const toggleDay = (day: number) => {
    setItemDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleAddItem = async () => {
    if (!itemName.trim() || !addingToStackId) return;
    try {
      await api.post(`/stacks/${addingToStackId}/items`, {
        name: itemName, dose: parseFloat(itemDose) || 0, unit: itemUnit,
        frequency: itemFrequency, timing: itemTiming, scheduleDays: itemDays.length > 0 ? itemDays : undefined, isActive: true,
      });
      setItemName(""); setItemDose(""); setItemUnit("mg"); setItemFrequency("Daily"); setItemTiming("Morning"); setItemDays([]);
      setAddingToStackId(null);
      fetchStacks();
    } catch (err) {
      console.error("Failed to add item:", err);
    }
  };

  const handleDeleteItem = async (stackId: string, itemId: string) => {
    try {
      await api.delete(`/stacks/${stackId}/items/${itemId}`);
      fetchStacks();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleToggleTaken = async (stackId: string, itemId: string, taken: boolean) => {
    try {
      await api.put(`/stacks/${stackId}/items/${itemId}`, { taken: !taken });
      fetchStacks();
    } catch (err) {
      console.error("Failed to toggle item:", err);
    }
  };

  return (
    <div className="space-y-8 mesh-bg-dashboard">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-gradient-teal" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            Stacks
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Manage your supplement and peptide protocols</p>
        </div>
        <button
          onClick={() => {
            const adminEmails = ["migueljnew@gmail.com", "booklouisgold@gmail.com"];
            const userEmail = useAuthStore.getState().user?.email?.toLowerCase();
            const hasAccess = adminEmails.includes(userEmail || "");
            if (!hasAccess && stacks.length >= 1) {
              if (!confirm("Free users can only create 1 stack. Upgrade to BioPoint+ for unlimited stacks.\n\nWould you like to upgrade?")) return;
              router.push("/premium");
              return;
            }
            setShowCreate(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <Plus size={18} />
          New Stack
        </button>
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              className="glass-elevated p-8 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                  Create Stack
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Name</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
                    placeholder="e.g. Morning Protocol"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Description</label>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
                    placeholder="e.g. Energy and focus optimization"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Create Stack
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {addingToStackId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAddingToStackId(null)}
          >
            <motion.div
              className="glass-elevated p-8 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>Add Item</h2>
                <button onClick={() => setAddingToStackId(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Name</label>
                  <input value={itemName} onChange={(e) => { setItemName(e.target.value); searchCompounds(e.target.value); }} onFocus={() => { if (searchResults.length > 0) setShowSearch(true); }} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all" placeholder="Search peptides & supplements..." />
                  {showSearch && searchResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--glass-border)] shadow-2xl max-h-48 overflow-y-auto">
                      {searchResults.map((c) => (
                        <button key={c.id} onClick={() => selectCompound(c)} className="w-full px-4 py-2.5 text-left hover:bg-[var(--glass-hover)] transition-colors cursor-pointer flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">{c.category} · {c.typicalDose?.min}-{c.typicalDose?.max} {c.typicalDose?.unit}</p>
                          </div>
                          <Pill size={14} className="text-[var(--accent)]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Dose</label>
                    <input type="number" value={itemDose} onChange={(e) => setItemDose(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all" placeholder="5000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Unit</label>
                    <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                      <option value="g">g</option>
                      <option value="IU">IU</option>
                      <option value="ml">ml</option>
                      <option value="drops">drops</option>
                      <option value="capsules">capsules</option>
                      <option value="tablets">tablets</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Frequency</label>
                    <select value={itemFrequency} onChange={(e) => setItemFrequency(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                      <option value="Daily">Daily</option>
                      <option value="Twice Daily">Twice Daily</option>
                      <option value="3x Daily">3x Daily</option>
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Twice a week">Twice a week</option>
                      <option value="Three times a week">3x a week</option>
                      <option value="As Needed">As Needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Timing</label>
                    <select value={itemTiming} onChange={(e) => setItemTiming(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer">
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                      <option value="Before Bed">Before Bed</option>
                      <option value="With Food">With Food</option>
                      <option value="Empty Stomach">Empty Stomach</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Schedule Days</label>
                  <div className="flex gap-1.5">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          itemDays.includes(i)
                            ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                            : "bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Leave empty to use frequency-based schedule</p>
                </div>
                <button
                  onClick={handleAddItem}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Add to Stack
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Stacks List */}
      {!loading && stacks.length === 0 && (
        <GlassCard className="p-12 text-center">
          <Pill size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>No stacks yet</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">Create your first supplement or peptide stack to start tracking</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 cursor-pointer"
          >
            Create First Stack
          </button>
        </GlassCard>
      )}

      <div className="space-y-4">
        {stacks.map((stack, index) => {
          const isExpanded = expandedId === stack.id;
          const takenCount = stack.items?.filter((i) => i.taken).length ?? 0;
          const totalItems = stack.items?.length ?? 0;

          return (
            <motion.div
              key={stack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard className="overflow-hidden" glow={stack.isActive ? "accent" : "none"}>
                {/* Header */}
                <button
                  className="w-full flex items-center justify-between p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : stack.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center accent-glow">
                      <Pill size={20} className="text-[var(--accent)]" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-semibold" style={{ fontFamily: "'Satoshi', sans-serif" }}>
                        {stack.name}
                      </h3>
                      {stack.description && (
                        <p className="text-xs text-[var(--text-muted)]">{stack.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {stack.isActive && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[rgba(16,185,129,0.1)] text-[var(--success)]">
                        Active
                      </span>
                    )}
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {takenCount}/{totalItems}
                    </span>
                    {isExpanded ? <ChevronUp size={18} className="text-[var(--text-muted)]" /> : <ChevronDown size={18} className="text-[var(--text-muted)]" />}
                  </div>
                </button>

                {/* Expanded Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-2 border-t border-[var(--glass-border)] pt-4">
                        {stack.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-3 px-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)]"
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleToggleTaken(stack.id, item.id, !!item.taken)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  item.taken ? "bg-[var(--success)]" : "border border-[var(--glass-border)] hover:border-[var(--accent)]"
                                }`}
                              >
                                {item.taken && <Check size={12} className="text-white" />}
                              </button>
                              <div>
                                <p className={`text-sm font-medium ${item.taken ? "line-through text-[var(--text-muted)]" : ""}`}>
                                  {item.name}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {item.dose} {item.unit} · {item.frequency}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-[var(--text-muted)]" />
                                <span className="text-xs text-[var(--text-muted)]">{item.timing}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteItem(stack.id, item.id)}
                                className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(!stack.items || stack.items.length === 0) && (
                          <p className="text-sm text-[var(--text-muted)] text-center py-4">No items in this stack</p>
                        )}

                        {/* Actions */}
                        <div className="flex justify-between gap-3 pt-2">
                          <button
                            onClick={() => setAddingToStackId(stack.id)}
                            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            <Plus size={14} />
                            Add Item
                          </button>
                          <button
                            onClick={() => handleDelete(stack.id)}
                            className="flex items-center gap-1.5 text-xs text-[var(--error)] hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
