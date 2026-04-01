"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function OraclePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "Greetings. I am The Oracle. I have analyzed your biological data. Ask me anything about your health, trends, or optimal performance protocols.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const history = messages
        .filter((m) => m.id !== "init")
        .slice(-10)
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", content: m.content }));

      const res = await api.post("/oracle/chat", { message: userMsg.content, history });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.response,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "I couldn't process that request. Please try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: "init-" + Date.now(),
        role: "assistant",
        content: "Greetings. I am The Oracle. I have analyzed your biological data. Ask me anything about your health, trends, or optimal performance protocols.",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-64px)] max-h-[calc(100vh-128px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center">
            <Sparkles size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Satoshi', sans-serif" }}>The Oracle</h1>
            <p className="text-xs text-[var(--text-muted)]">BIO-INTELLIGENCE V1.0</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-[var(--bg-primary)] rounded-br-md"
                  : "glass-card rounded-bl-md"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass-card px-5 py-3.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-[var(--glass-border)]">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your health..."
            className="flex-1 px-5 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-xl bg-[var(--accent)] flex items-center justify-center hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
          >
            <Send size={18} className="text-[var(--bg-primary)]" />
          </button>
        </form>
      </div>
    </div>
  );
}
