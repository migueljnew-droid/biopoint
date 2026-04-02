"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, Calendar, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

export default function ProgressPage() {
  const [photos, setPhotos] = useState<{ date: string; url: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { date: new Date().toLocaleDateString(), url }]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-8 mesh-bg-dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight text-gradient-success" style={{ fontFamily: "'Satoshi', sans-serif" }}>Progress</h1>
        <p className="text-[var(--text-muted)] mt-1">Track your physical transformation over time</p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <label
          className={`block border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${
            dragOver
              ? "border-[var(--success)] bg-[rgba(16,185,129,0.08)] success-glow"
              : "border-[var(--glass-border)] hover:border-[var(--success)] hover:bg-[var(--glass)]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <div className="w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center mx-auto mb-4" style={{ border: "1px solid rgba(16,185,129,0.25)" }}>
            <Camera size={28} className="text-[var(--success)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Drop a progress photo or click to browse</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Track your transformation week over week</p>
        </label>
      </motion.div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {photos.map((photo, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="overflow-hidden">
                <img src={photo.url} alt={`Progress ${photo.date}`} className="w-full aspect-square object-cover" />
                <div className="p-3 text-center">
                  <p className="text-xs text-[var(--text-muted)]">{photo.date}</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <TrendingUp size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Satoshi', sans-serif" }}>No progress photos yet</h3>
          <p className="text-sm text-[var(--text-muted)]">Upload your first photo to start tracking your transformation</p>
        </GlassCard>
      )}
    </div>
  );
}
