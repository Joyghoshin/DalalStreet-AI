"use client";
import { useEffect, useState, useCallback } from "react";
import { formatINR, formatLakhCrore } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Holding {
  symbol:    string;
  qty:       number;
  avg_price: number;
  ltp:       number;
  invested:  number;
  current:   number;
  pnl:       number;
  pnl_pct:   number;
}

interface Summary {
  cash:        number;
  invested:    number;
  current_val: number;
  total_pnl:   number;
  pnl_pct:     number;
  total_value: number;
}

export default function Portfolio({ refreshKey }: { refreshKey?: number }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [loading,  setLoading]  = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([
        fetch(`${API}/api/portfolio/holdings`).then((r) => r.json()),
        fetch(`${API}/api/portfolio/summary`).then((r) => r.json()),
      ]);
      setHoldings(h);
      setSummary(s);
    } catch (e) {
      console.error("Portfolio fetch failed:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const card = {
    background: "var(--color-surface-card)",
    border: "1px solid var(--color-surface-border)",
    borderRadius: 16, padding: 16,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Summary cards */}
      {summary && (
        <div style={{ ...card }}>
          <h3 style={{
            margin: "0 0 12px", fontSize: 12, fontWeight: 600,
            color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            💼 Portfolio Summary
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Cash",        value: formatLakhCrore(summary.cash),        color: "#fff" },
              { label: "Invested",    value: formatLakhCrore(summary.invested),     color: "#fff" },
              { label: "Current Val", value: formatLakhCrore(summary.current_val),  color: "#fff" },
              {
                label: "Total P&L",
                value: `${summary.total_pnl >= 0 ? "+" : ""}${formatLakhCrore(summary.total_pnl)} (${summary.pnl_pct.toFixed(2)}%)`,
                color: summary.total_pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: "var(--color-surface-elevated)",
                borderRadius: 8, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 10, padding: "8px 10px", borderRadius: 8,
            background: "var(--color-surface-elevated)",
            display: "flex", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Total Portfolio Value</span>
            <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: "#fff" }}>
              {formatLakhCrore(summary.total_value)}
            </span>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div style={{ ...card }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 12,
        }}>
          <h3 style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            📊 Holdings {loading && <span style={{ color: "#6b7280" }}>↻</span>}
          </h3>
          <button
            onClick={fetchData}
            style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 6,
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-surface-border)",
              color: "#9ca3af", cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {holdings.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "20px 0" }}>
            No holdings yet. Buy some stocks!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
                  {["Symbol","Qty","Avg","LTP","P&L"].map((h, i) => (
                    <th key={h} style={{
                      padding: "6px 8px", fontSize: 10, color: "#6b7280",
                      textTransform: "uppercase", fontWeight: 500,
                      textAlign: i === 0 ? "left" : "right",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.symbol}
                    style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
                    <td style={{ padding: "8px", fontWeight: 700,
                      color: "var(--color-accent)" }}>{h.symbol}</td>
                    <td style={{ padding: "8px", textAlign: "right",
                      fontFamily: "monospace" }}>{h.qty}</td>
                    <td style={{ padding: "8px", textAlign: "right",
                      fontFamily: "monospace", color: "#9ca3af" }}>
                      {formatINR(h.avg_price)}</td>
                    <td style={{ padding: "8px", textAlign: "right",
                      fontFamily: "monospace" }}>{formatINR(h.ltp)}</td>
                    <td style={{
                      padding: "8px", textAlign: "right", fontFamily: "monospace",
                      fontWeight: 600,
                      color: h.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                    }}>
                      {h.pnl >= 0 ? "+" : ""}{formatINR(h.pnl)}
                      <div style={{ fontSize: 10, color: h.pnl >= 0
                        ? "var(--color-profit)" : "var(--color-loss)" }}>
                        ({h.pnl_pct.toFixed(2)}%)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
