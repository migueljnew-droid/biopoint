"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, TrendingUp, Trash2, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";

interface Photo {
  id: string;
  originalUrl: string;
  category: string | null;
  capturedAt: string;
  weightKg: number | null;
  notes: string | null;
}

export default function ProgressPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await api.get("/photos");
      setPhotos(res.data);
    } catch (err) {
      console.error("Failed to fetch photos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      // 1. Get presigned upload URL
      const presignRes = await api.post("/photos/presign", {
        filename: file.name,
        contentType: file.type,
      });
      const { uploadUrl, s3Key } = presignRes.data;

      // 2. Upload file to S3
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // 3. Create photo record
      await api.post("/photos", {
        originalS3Key: s3Key,
        category: "progress",
        capturedAt: new Date().toISOString(),
      });

      // 4. Refresh list
      await fetchPhotos();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this progress photo?")) return;
    try {
      await api.delete(`/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
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
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-gradient-success" style={{ fontFamily: "'Satoshi', sans-serif" }}>Progress</h1>
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
            {uploading ? <Loader2 size={28} className="text-[var(--success)] animate-spin" /> : <Camera size={28} className="text-[var(--success)]" />}
          </div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {uploading ? "Uploading..." : "Drop a progress photo or click to browse"}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Track your transformation week over week</p>
        </label>
      </motion.div>

      {/* Photo Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo, i) => (
            <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="overflow-hidden group relative">
                <img src={photo.originalUrl} alt={`Progress ${new Date(photo.capturedAt).toLocaleDateString()}`} className="w-full aspect-square object-cover" />
                <div className="p-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--text-muted)]">{new Date(photo.capturedAt).toLocaleDateString()}</p>
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--error)]"
                    aria-label="Delete photo"
                  >
                    <Trash2 size={14} />
                  </button>
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
