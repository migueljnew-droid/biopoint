"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Sparkles, ChevronDown, ChevronUp, CheckCircle, AlertCircle, TrendingUp, FlaskConical, X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface Marker {
  id: string;
  name: string;
  value: number | null;
  unit: string;
  refRangeLow: number | null;
  refRangeHigh: number | null;
  isInRange: boolean | null;
}

interface Lab {
  id: string;
  filename: string;
  uploadedAt: string;
  markers: Marker[];
}

interface AnalysisResult {
  summary: string;
  markers: Array<{ name: string; value: number; unit: string; range: string; flag: string; insight: string }>;
}

export default function LabsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchLabs = useCallback(async () => {
    try {
      const res = await api.get("/labs");
      setLabs(res.data);
    } catch (err) {
      console.error("Failed to fetch labs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLabs(); }, [fetchLabs]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { uploadUrl, s3Key } = (await api.post("/labs/presign", { filename: file.name, contentType: file.type })).data;
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await api.post("/labs", { filename: file.name, s3Key, notes: "Uploaded from web" });
      fetchLabs();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload lab report");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (id: string) => {
    const adminEmails = ["migueljnew@gmail.com", "booklouisgold@gmail.com"];
    const userEmail = useAuthStore.getState().user?.email?.toLowerCase();
    if (!adminEmails.includes(userEmail || "")) {
      if (!confirm("AI Lab Analysis requires BioPoint+. Would you like to upgrade?")) return;
      window.location.href = "/premium";
      return;
    }
    setAnalyzingId(id);
    try {
      const res = await api.post(`/labs/${id}/analyze`, {});
      setAnalysisResult(res.data);
      setShowModal(true);
      fetchLabs();
    } catch (err: any) {
      alert(err.response?.data?.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-8 mesh-bg-labs">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight text-gradient-teal" style={{ fontFamily: "'Satoshi', sans-serif" }}>Labs</h1>
        <p className="text-[var(--text-muted)] mt-1">Upload and analyze your blood work</p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <label
          className={`block border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent-muted)] accent-glow"
              : "border-[var(--glass-border)] hover:border-[var(--accent)] hover:bg-[var(--glass)] hover:accent-glow"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" />
          {uploading ? (
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-muted)] flex items-center justify-center mx-auto mb-4">
                <Upload size={28} className="text-[var(--accent)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">Drop your lab report here or click to browse</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Supports JPEG, PNG, PDF</p>
            </>
          )}
        </label>
      </motion.div>

      {/* Summary Stats */}
      {labs.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Reports", value: labs.length, color: "var(--accent)", glow: "accent" as const },
            { label: "Biomarkers", value: labs.reduce((sum, l) => sum + l.markers.length, 0), color: "var(--accent)", glow: "accent" as const },
            { label: "In Range", value: labs.reduce((sum, l) => sum + l.markers.filter(m => m.isInRange === true).length, 0), color: "var(--success)", glow: "success" as const },
            { label: "Out of Range", value: labs.reduce((sum, l) => sum + l.markers.filter(m => m.isInRange === false).length, 0), color: "var(--error)", glow: "none" as const },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
              <GlassCard className="p-4 text-center" glow={stat.glow}>
                <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>}

      {/* Lab Reports */}
      <div className="space-y-3">
        {labs.map((lab, index) => {
          const isExpanded = expandedId === lab.id;
          return (
            <motion.div key={lab.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.05 }}>
              <GlassCard className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : lab.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center">
                      <FlaskConical size={20} className="text-[var(--accent)]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{lab.filename}</p>
                      <p className="text-xs text-[var(--text-muted)]">{new Date(lab.uploadedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-[var(--accent)]">{lab.markers.length} markers</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAnalyze(lab.id); }}
                      disabled={analyzingId === lab.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-glow)] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {analyzingId === lab.id ? (
                        <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      Analyze
                    </button>
                    {isExpanded ? <ChevronUp size={18} className="text-[var(--text-muted)]" /> : <ChevronDown size={18} className="text-[var(--text-muted)]" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-[var(--glass-border)] pt-4 space-y-2">
                        {lab.markers.length > 0 ? lab.markers.map((m) => {
                          const statusColor = m.isInRange === null ? "var(--text-muted)" : m.isInRange ? "var(--success)" : "var(--error)";
                          return (
                            <div key={m.id} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-[var(--glass)]">
                              <div>
                                <p className="text-sm font-medium">{m.name}</p>
                                {m.refRangeLow !== null && m.refRangeHigh !== null && (
                                  <p className="text-xs text-[var(--text-muted)]">Ref: {m.refRangeLow} - {m.refRangeHigh} {m.unit}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold font-mono" style={{ color: statusColor }}>
                                  {m.value ?? "—"}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">{m.unit}</span>
                                {m.isInRange !== null && (
                                  m.isInRange ? <CheckCircle size={16} className="text-[var(--success)]" /> : <AlertCircle size={16} className="text-[var(--error)]" />
                                )}
                              </div>
                            </div>
                          );
                        }) : (
                          <p className="text-sm text-[var(--text-muted)] text-center py-4">No markers — tap Analyze to extract biomarkers</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Analysis Modal */}
      <AnimatePresence>
        {showModal && analysisResult && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="glass-elevated p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>AI Analysis</h2>
                <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="glass-card p-5 mb-6">
                <h3 className="text-sm font-semibold text-[var(--accent)] mb-2">Summary</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{analysisResult.summary}</p>
              </div>
              <h3 className="text-sm font-semibold mb-4">Detected Markers</h3>
              <div className="space-y-3">
                {analysisResult.markers.map((m, i) => {
                  const flagColor = m.flag === "NORMAL" ? "var(--success)" : m.flag === "HIGH" ? "var(--error)" : "var(--warning)";
                  return (
                    <div key={i} className="py-3 border-b border-[var(--glass-border)]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold font-mono" style={{ color: flagColor }}>{m.value}</span>
                          <span className="text-xs text-[var(--text-muted)]">{m.unit}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: flagColor, background: `color-mix(in srgb, ${flagColor} 15%, transparent)` }}>
                            {m.flag}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Ref: {m.range}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{m.insight}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
