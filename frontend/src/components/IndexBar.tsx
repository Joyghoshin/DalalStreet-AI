"use client";
import { useEffect, useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface IndexData {
  name:      string;
  symbol:    string;
  price:     number;
  change:    number;
  changePct: number;
}

function IndexTicker({ index }: { index: IndexData }) {
  const [flash, setFlash] = useState("");
  const prev  = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prev.current === null) { prev.current = index.price; return; }
    if (index.price === prev.current) return;
    if (timer.current) clearTimeout(timer.current);
    setFlash(index.price > prev.current ? "flash-green" : "flash-red");
    prev.current = index.price;
    timer.current = setTimeout(() => setFlash(""), 800);
  }, [index.price]);

  const isUp = index.change >= 0;

  return (
    <div className={flash} style={{
      display: "flex", alignItems: "center", gap: 10,
      flexShrink: 0, padding: "4px 14px",
      borderRight: "1px solid var(--color-surface-border)",
    }}>
      {/* Exchange badge */}
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
        padding: "1px 5px", borderRadius: 4,
        background: index.name.includes("SENSEX")
          ? "#1e3a5f" : "#1a3a2a",
        color: index.name.includes("SENSEX")
          ? "#60a5fa" : "#4ade80",
        border: `1px solid ${index.name.includes("SENSEX")
          ? "#2563eb" : "#16a34a"}`,
      }}>
        {index.name.includes("SENSEX") ? "BSE" : "NSE"}
      </span>

      {/* Index name */}
      <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
        {index.name}
      </span>

      {/* Price */}
      <span style={{
        fontSize: 13, fontFamily: "monospace",
        fontWeight: 700, color: "#fff",
      }}>
        {index.price > 0
          ? index.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })
          : "—"}
      </span>

      {/* Change */}
      <span style={{
        fontSize: 11, fontFamily: "monospace", fontWeight: 600,
        color: isUp ? "var(--color-profit)" : "var(--color-loss)",
        display: "flex", alignItems: "center", gap: 2,
      }}>
        <span style={{
          display: "inline-block",
          animation: isUp ? "bounceUp 1s ease infinite" : "bounceDown 1s ease infinite",
        }}>
          {isUp ? "▲" : "▼"}
        </span>
        {Math.abs(index.change).toFixed(2)}
        <span style={{ opacity: 0.8 }}>
          ({Math.abs(index.changePct).toFixed(2)}%)
        </span>
      </span>
    </div>
  );
}

export default function IndexBar() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [time,    setTime]    = useState("");

  // Fetch indices via REST (simpler than SSE for this bar)
  async function fetchIndices() {
    try {
      const data = await fetch(`${API}/api/market/indices`).then(r => r.json());
      setIndices(data);
    } catch (e) {
      console.warn("Index fetch failed:", e);
    }
  }

  useEffect(() => {
    fetchIndices();
    const interval = setInterval(fetchIndices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live clock
  useEffect(() => {
    const tick = () => setTime(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* Bounce animations */}
      <style>{`
        @keyframes bounceUp {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes bounceDown {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(2px); }
        }
      `}</style>

      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", overflow: "hidden",
      }}>
        {/* Index tickers */}
        <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
          {indices.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--color-muted)", padding: "0 8px" }}>
              Loading indices…
            </span>
          ) : (
            indices.map((idx) => <IndexTicker key={idx.name} index={idx} />)
          )}
        </div>

        {/* Live IST clock */}
        <div style={{
          fontSize: 12, fontFamily: "monospace",
          color: "#6b7280", padding: "0 12px", flexShrink: 0,
        }}>
          🕐 IST {time}
        </div>
      </div>
    </>
  );
}
