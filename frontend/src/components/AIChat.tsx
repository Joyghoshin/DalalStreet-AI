"use client";
import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role:    "user" | "assistant";
  content: string;
  time:    string;
}

const SUGGESTIONS = [
  "How is my portfolio doing?",
  "Should I buy RELIANCE now?",
  "Compare TCS vs INFY",
  "What is NIFTY outlook?",
  "Show my biggest loss",
  "Is ITC a good buy?",
];

export default function AIChat() {
  const [messages,    setMessages]    = useState<Message[]>([{
    role:    "assistant",
    content: "Namaste! 🙏 I am DalalStreet AI — your Groq-powered market assistant.\n\nAsk me anything about your portfolio, NSE/BSE stocks, or market trends.",
    time:    "",  // set client-side to avoid SSR hydration mismatch
  }]);

  // Set initial message time on client only (avoids SSR/client timestamp mismatch)
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m, i) => i === 0 && m.time === "" ? { ...m, time: now() } : m)
    );
  }, []);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [suggestions, setSuggestions] = useState(SUGGESTIONS);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  function now() {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata"
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: "user", content: msg, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build history for context
    const history = messages.slice(-8).map((m) => ({
      role:    m.role,
      content: m.content,
    }));

    try {
      const res  = await fetch(`${API}/api/chat/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, time: now() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role:    "assistant",
          content: "⚠️ Could not reach AI backend. Is the server running?",
          time:    now(),
        },
      ]);
    }
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const card = {
    background: "var(--color-surface-card)",
    border:     "1px solid var(--color-surface-border)",
    borderRadius: 16,
    display:    "flex" as const,
    flexDirection: "column" as const,
    height:     "520px",
    overflow:   "hidden",
  };

  return (
    <div style={card}>

      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-surface-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <h3 style={{
          margin: 0, fontSize: 12, fontWeight: 600, color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          🤖 AI Assistant
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#8b5cf6", display: "inline-block",
            boxShadow: "0 0 6px #8b5cf6",
          }}/>
          <span style={{ fontSize: 11, color: "#8b5cf6" }}>Groq llama-3.3</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
            gap: 8, alignItems: "flex-start",
          }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
              background: msg.role === "user"
                ? "var(--color-accent)" : "#4c1d95",
            }}>
              {msg.role === "user" ? "👤" : "🤖"}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: "82%",
              padding: "10px 14px",
              borderRadius: msg.role === "user"
                ? "14px 4px 14px 14px"
                : "4px 14px 14px 14px",
              background: msg.role === "user"
                ? "var(--color-accent)"
                : "var(--color-surface-elevated)",
              border: msg.role === "assistant"
                ? "1px solid var(--color-surface-border)" : "none",
            }}>
              <div style={{
                fontSize: 13, lineHeight: 1.55, color: "#f3f4f6",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {msg.content}
              </div>
              <div
                suppressHydrationWarning
                style={{
                  fontSize: 10, color: "rgba(255,255,255,0.4)",
                  marginTop: 4, textAlign: "right",
                }}
              >
                {msg.time}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#4c1d95", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>🤖</div>
            <div style={{
              padding: "10px 14px", borderRadius: "4px 14px 14px 14px",
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-surface-border)",
              display: "flex", gap: 4, alignItems: "center",
            }}>
              {[0,1,2].map((d) => (
                <span key={d} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#8b5cf6",
                  display: "inline-block",
                  animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{
          padding: "8px 16px", flexShrink: 0,
          borderTop: "1px solid var(--color-surface-border)",
          display: "flex", gap: 6, flexWrap: "wrap" as const,
        }}>
          {suggestions.slice(0, 3).map((s) => (
            <button key={s} onClick={() => send(s)} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20,
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-surface-border)",
              color: "#9ca3af", cursor: "pointer",
              whiteSpace: "nowrap" as const,
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "10px 12px", flexShrink: 0,
        borderTop: "1px solid var(--color-surface-border)",
        display: "flex", gap: 8, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your portfolio or any stock… (Enter to send)"
          rows={1}
          style={{
            flex: 1, padding: "8px 12px", fontSize: 13,
            fontFamily: "monospace", resize: "none",
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 10, color: "#fff", outline: "none",
            lineHeight: 1.5, maxHeight: 80, overflowY: "auto",
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 14px", borderRadius: 10, border: "none",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 16, fontWeight: 700,
            background: loading || !input.trim() ? "#2a2e3a" : "#7c3aed",
            color: loading || !input.trim() ? "#4b5563" : "#fff",
            transition: "all 0.15s", flexShrink: 0,
          }}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
