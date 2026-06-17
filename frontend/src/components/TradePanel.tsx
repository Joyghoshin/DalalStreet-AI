"use client";
import { useState } from "react";
import { usePriceStore } from "@/stores/priceStore";
import { formatINR } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SYMBOLS = [
  "RELIANCE","TCS","INFY","HDFCBANK","ITC",
  "SBIN","BHARTIARTL","KOTAKBANK","WIPRO","TATAMOTORS",
];

export default function TradePanel({ onTrade }: { onTrade?: () => void }) {
  const prices  = usePriceStore((s) => s.prices);
  const [symbol, setSymbol]   = useState("RELIANCE");
  const [qty,    setQty]      = useState(1);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{msg: string; ok: boolean} | null>(null);

  const stock = prices[symbol];
  const total = stock ? stock.price * qty : 0;

  async function trade(side: "buy" | "sell") {
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch(`${API}/api/portfolio/${side}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol, qty }),
      });
      const data = await res.json();
      if (data.error) {
        setResult({ msg: data.error, ok: false });
      } else {
        setResult({
          msg: `${side.toUpperCase()} ${qty} × ${symbol} @ ${formatINR(data.price)} ✅`,
          ok: true,
        });
        onTrade?.();
      }
    } catch (e) {
      setResult({ msg: "Network error — is backend running?", ok: false });
    }
    setLoading(false);
  }

  return (
    <div style={{
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-surface-border)",
      borderRadius: 16, padding: 16,
    }}>
      <h3 style={{
        margin: "0 0 14px", fontSize: 12, fontWeight: 600,
        color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        📈 Trade Panel
      </h3>

      {/* Symbol selector */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
          Symbol
        </label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "monospace",
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 8, color: "#fff", outline: "none",
          }}
        >
          {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Live price display */}
      {stock && (
        <div style={{
          padding: "8px 10px", borderRadius: 8, marginBottom: 10,
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-surface-border)",
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>LTP</span>
          <span style={{
            fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: "#fff"
          }}>
            {formatINR(stock.price)}
          </span>
        </div>
      )}

      {/* Quantity */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
          Quantity
        </label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "monospace",
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
          }}
        />
        {stock && (
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
            Est. value: {formatINR(total)}
          </div>
        )}
      </div>

      {/* Buy / Sell buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={() => trade("buy")}
          disabled={loading}
          style={{
            padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "monospace",
            background: loading ? "#1a3a2a" : "#166534",
            color: loading ? "#4ade80" : "#86efac",
            transition: "all 0.15s",
          }}
        >
          {loading ? "…" : "▲ BUY"}
        </button>
        <button
          onClick={() => trade("sell")}
          disabled={loading}
          style={{
            padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "monospace",
            background: loading ? "#3a1a1a" : "#7f1d1d",
            color: loading ? "#f87171" : "#fca5a5",
            transition: "all 0.15s",
          }}
        >
          {loading ? "…" : "▼ SELL"}
        </button>
      </div>

      {/* Result message */}
      {result && (
        <div style={{
          marginTop: 10, padding: "8px 10px", borderRadius: 8, fontSize: 12,
          background: result.ok ? "#14532d20" : "#7f1d1d20",
          border: `1px solid ${result.ok ? "#166534" : "#7f1d1d"}`,
          color: result.ok ? "#86efac" : "#fca5a5",
          fontFamily: "monospace",
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
