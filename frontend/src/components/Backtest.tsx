"use client";
import { useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Metrics {
  totalReturn:  number;
  annualReturn: number;
  volatility:   number;
  sharpeRatio:  number;
  maxDrawdown:  number;
  totalTrades:  number;
  winRate:      number;
  avgWin:       number;
  avgLoss:      number;
  profitFactor: number;
}

interface Trade {
  entry:   string;
  exit:    string;
  entryPx: number;
  exitPx:  number;
  pnl:     number;
  days:    number;
  reason:  string;
}

interface BacktestResult {
  symbol:       string;
  strategyName: string;
  years:        number;
  metrics:      Metrics;
  equityCurve:  { date: string; equity: number }[];
  trades:       Trade[];
  totalTrades:  number;
  benchmark:    { totalReturn: number; annualReturn: number; label: string };
}

interface CompareRow {
  strategy:     string;
  strategyName: string;
  metrics:      Partial<Metrics>;
  totalTrades:  number;
  error?:       string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = [
  "RELIANCE","TCS","INFY","HDFCBANK","ITC",
  "SBIN","BHARTIARTL","KOTAKBANK","WIPRO","TATAMOTORS",
  "BAJFINANCE","HCLTECH","ADANIENT","ASIANPAINT","MARUTI",
];

const STRATEGIES = [
  { key: "breakout_52w",     label: "52-Week Breakout",    color: "#4ade80" },
  { key: "ema_crossover",    label: "EMA Crossover (9/21)", color: "#60a5fa" },
  { key: "rsi_momentum",     label: "RSI Momentum",         color: "#f59e0b" },
  { key: "bollinger_bands",  label: "Bollinger Bands",      color: "#a78bfa" },
  { key: "zscore_reversion", label: "Z-Score Reversion",    color: "#f87171" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricBox({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: "var(--color-surface-elevated)",
      border: "1px solid var(--color-surface-border)",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700, fontFamily: "monospace",
        color: color || "#e5e7eb", marginTop: 3,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 0", gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid var(--color-surface-border)",
        borderTopColor: "#4ade80",
        animation: "btSpin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
        Fetching 5yr history from NSE…
      </div>
      <style>{`@keyframes btSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Backtest() {
  const [symbol,    setSymbol]    = useState("RELIANCE");
  const [strategy,  setStrategy]  = useState("ema_crossover");
  const [mode,      setMode]      = useState<"single" | "compare">("single");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<BacktestResult | null>(null);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chart" | "trades">("chart");

  const runSingle = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res  = await fetch(
        `${API}/api/backtest/run?symbol=${symbol}&strategy=${strategy}&years=5`
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Backtest failed");
      }
      const data = await res.json();
      setResult(data);
      setMode("single");
    } catch (e: any) {
      setError(e.message || "Unknown error");
    }
    setLoading(false);
  }, [symbol, strategy]);

  const runCompare = useCallback(async () => {
    setLoading(true); setError(null); setCompareRows([]);
    try {
      const res  = await fetch(
        `${API}/api/backtest/compare?symbol=${symbol}&years=5`
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Compare failed");
      }
      const data = await res.json();
      setCompareRows(data.strategies);
      setMode("compare");
    } catch (e: any) {
      setError(e.message || "Unknown error");
    }
    setLoading(false);
  }, [symbol]);

  const card: React.CSSProperties = {
    background: "var(--color-surface-card)",
    border: "1px solid var(--color-surface-border)",
    borderRadius: 8, padding: "10px 12px",
  };

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 12, fontFamily: "monospace",
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-surface-border)",
    borderRadius: 6, color: "#fff", outline: "none", width: "100%",
  };

  return (
    <div style={{
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-surface-border)",
      borderRadius: 16, overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--color-surface-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h3 style={{
          margin: 0, fontSize: 12, fontWeight: 600,
          color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          📊 Strategy backtest · 5yr NSE data
        </h3>
        {result && (
          <span style={{
            fontSize: 10, fontFamily: "monospace", color: "#6b7280",
          }}>
            {result.symbol} · {result.strategyName}
          </span>
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Controls ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Symbol</div>
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selStyle}>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Strategy</div>
            <select value={strategy} onChange={e => setStrategy(e.target.value)} style={selStyle}>
              {STRATEGIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <button
            onClick={runSingle}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700, fontFamily: "monospace",
              background: loading ? "#1a3a2a" : "#166534",
              color: loading ? "#4ade80" : "#86efac",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {loading && mode === "single" ? "Running…" : "▶ Run"}
          </button>
          <button
            onClick={runCompare}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700, fontFamily: "monospace",
              background: loading ? "#1a1e3a" : "#1e3a5f",
              color: loading ? "#60a5fa" : "#93c5fd",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {loading && mode === "compare" ? "Running…" : "⚡ Compare all"}
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && <LoadingSpinner />}

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding: "10px 12px", borderRadius: 8, fontSize: 12,
            background: "#7f1d1d20", border: "1px solid #7f1d1d",
            color: "#fca5a5", fontFamily: "monospace",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Single result ── */}
        {!loading && result && mode === "single" && (
          <>
            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              <MetricBox
                label="Total return"
                value={`${result.metrics.totalReturn > 0 ? "+" : ""}${result.metrics.totalReturn}%`}
                sub="vs benchmark"
                color={result.metrics.totalReturn > 0 ? "#4ade80" : "#f87171"}
              />
              <MetricBox
                label="Annual return"
                value={`${result.metrics.annualReturn > 0 ? "+" : ""}${result.metrics.annualReturn}%`}
                color={result.metrics.annualReturn > 0 ? "#4ade80" : "#f87171"}
              />
              <MetricBox
                label="Sharpe ratio"
                value={String(result.metrics.sharpeRatio)}
                color={result.metrics.sharpeRatio > 1 ? "#4ade80" : result.metrics.sharpeRatio > 0 ? "#f59e0b" : "#f87171"}
              />
              <MetricBox
                label="Max drawdown"
                value={`${result.metrics.maxDrawdown}%`}
                color="#f87171"
              />
              <MetricBox
                label="Win rate"
                value={`${result.metrics.winRate}%`}
                sub={`${result.metrics.totalTrades} trades`}
                color={result.metrics.winRate > 50 ? "#4ade80" : "#f59e0b"}
              />
            </div>

            {/* Secondary metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              <MetricBox label="Volatility"     value={`${result.metrics.volatility}%`} />
              <MetricBox label="Profit factor"  value={String(result.metrics.profitFactor)} color={result.metrics.profitFactor > 1 ? "#4ade80" : "#f87171"} />
              <MetricBox label="Avg win"        value={`+${result.metrics.avgWin}%`}  color="#4ade80" />
              <MetricBox label="Avg loss"       value={`${result.metrics.avgLoss}%`}  color="#f87171" />
            </div>

            {/* Benchmark comparison */}
            <div style={{
              ...card, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                📌 {result.benchmark.label}
              </span>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "#9ca3af" }}>
                Total: <span style={{ color: result.benchmark.totalReturn > 0 ? "#4ade80" : "#f87171" }}>
                  {result.benchmark.totalReturn > 0 ? "+" : ""}{result.benchmark.totalReturn}%
                </span>
                {" · "}
                Annual: <span style={{ color: result.benchmark.annualReturn > 0 ? "#4ade80" : "#f87171" }}>
                  {result.benchmark.annualReturn > 0 ? "+" : ""}{result.benchmark.annualReturn}%
                </span>
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                background: result.metrics.annualReturn > result.benchmark.annualReturn ? "#14532d" : "#7f1d1d",
                color: result.metrics.annualReturn > result.benchmark.annualReturn ? "#86efac" : "#fca5a5",
              }}>
                {result.metrics.annualReturn > result.benchmark.annualReturn ? "▲ Beats B&H" : "▼ Lags B&H"}
              </span>
            </div>

            {/* Chart / Trades tabs */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["chart", "trades"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11,
                  fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "monospace",
                  background: activeTab === t ? "var(--color-surface-elevated)" : "transparent",
                  color: activeTab === t ? "#fff" : "#6b7280",
                  borderBottom: activeTab === t ? "2px solid #4ade80" : "2px solid transparent",
                }}>
                  {t === "chart" ? "📈 Equity curve" : `📋 Trades (${result.totalTrades})`}
                </button>
              ))}
            </div>

            {/* Equity curve */}
            {activeTab === "chart" && result.equityCurve.length > 0 && (
              <div style={{ ...card, padding: "12px 8px" }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={result.equityCurve}
                    margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#6b7280" }}
                      tickFormatter={v => v.slice(0, 7)}
                      interval={Math.floor(result.equityCurve.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#6b7280" }}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827", border: "1px solid #374151",
                        borderRadius: 6, fontSize: 11, fontFamily: "monospace",
                      }}
                      formatter={(v) => [`₹${(v as number)?.toLocaleString("en-IN") ?? ""}`, "Equity"]}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <ReferenceLine y={100000} stroke="#374151" strokeDasharray="4 4" />
                    <Line
                      type="monotone" dataKey="equity"
                      stroke="#4ade80" strokeWidth={1.5}
                      dot={false} activeDot={{ r: 3, fill: "#4ade80" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 9, color: "#4b5563", textAlign: "center", marginTop: 4 }}>
                  Starting capital ₹1,00,000 · {result.years}-year backtest
                </div>
              </div>
            )}

            {/* Trade log */}
            {activeTab === "trades" && (
              <div style={{ ...card, maxHeight: 260, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["Entry date","Exit date","Entry ₹","Exit ₹","P&L %","Days","Reason"].map(h => (
                        <th key={h} style={{
                          padding: "5px 8px", textAlign: "left",
                          fontSize: 9, color: "#6b7280", fontWeight: 600,
                          borderBottom: "1px solid var(--color-surface-border)",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                          position: "sticky", top: 0,
                          background: "var(--color-surface-elevated)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{t.entry}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{t.exit}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#d1d5db" }}>₹{t.entryPx.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#d1d5db" }}>₹{t.exitPx.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 700,
                          color: t.pnl > 0 ? "#4ade80" : "#f87171" }}>
                          {t.pnl > 0 ? "+" : ""}{t.pnl}%
                        </td>
                        <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{t.days}d</td>
                        <td style={{ padding: "5px 8px" }}>
                          <span style={{
                            fontSize: 9, padding: "2px 6px", borderRadius: 4,
                            background: "#1c1917", color: "#78716c",
                          }}>{t.reason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Compare all strategies ── */}
        {!loading && compareRows.length > 0 && mode === "compare" && (
          <div style={{ ...card, overflowX: "auto" }}>
            <div style={{
              fontSize: 11, color: "#9ca3af", marginBottom: 10, fontWeight: 600,
            }}>
              {symbol} — All strategies · 5-year comparison
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Strategy","Total ret","Annual ret","Sharpe","Max DD","Win rate","Trades","P.Factor"].map(h => (
                    <th key={h} style={{
                      padding: "5px 8px", textAlign: "left",
                      fontSize: 9, color: "#6b7280", fontWeight: 600,
                      borderBottom: "1px solid var(--color-surface-border)",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows
                  .slice()
                  .sort((a, b) => (b.metrics.annualReturn || 0) - (a.metrics.annualReturn || 0))
                  .map((row, i) => {
                    const color = STRATEGIES.find(s => s.key === row.strategy)?.color || "#9ca3af";
                    const m = row.metrics;
                    return (
                      <tr key={row.strategy} style={{
                        borderBottom: "1px solid var(--color-surface-border)",
                        background: i === 0 ? "#14532d10" : "transparent",
                      }}>
                        <td style={{ padding: "7px 8px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            fontWeight: 600, color: "#e5e7eb", fontSize: 12,
                          }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {row.strategyName}
                            {i === 0 && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#14532d", color: "#86efac" }}>BEST</span>}
                          </span>
                        </td>
                        {row.error ? (
                          <td colSpan={7} style={{ padding: "7px 8px", color: "#f87171", fontSize: 11 }}>
                            Error: {row.error}
                          </td>
                        ) : (
                          <>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace", fontWeight: 700,
                              color: (m.totalReturn || 0) > 0 ? "#4ade80" : "#f87171" }}>
                              {(m.totalReturn || 0) > 0 ? "+" : ""}{m.totalReturn}%
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace",
                              color: (m.annualReturn || 0) > 0 ? "#4ade80" : "#f87171" }}>
                              {(m.annualReturn || 0) > 0 ? "+" : ""}{m.annualReturn}%
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace",
                              color: (m.sharpeRatio || 0) > 1 ? "#4ade80" : (m.sharpeRatio || 0) > 0 ? "#f59e0b" : "#f87171" }}>
                              {m.sharpeRatio}
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace", color: "#f87171" }}>
                              {m.maxDrawdown}%
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace",
                              color: (m.winRate || 0) > 50 ? "#4ade80" : "#f59e0b" }}>
                              {m.winRate}%
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace", color: "#9ca3af" }}>
                              {row.totalTrades}
                            </td>
                            <td style={{ padding: "7px 8px", fontFamily: "monospace",
                              color: (m.profitFactor || 0) > 1 ? "#4ade80" : "#f87171" }}>
                              {m.profitFactor}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 10, color: "#4b5563" }}>
              Sorted by annual return · Click ▶ Run on a strategy above to see its equity curve
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !result && compareRows.length === 0 && !error && (
          <div style={{
            padding: "32px 0", textAlign: "center",
            color: "#4b5563", fontSize: 12, fontFamily: "monospace",
          }}>
            Select a symbol + strategy and click ▶ Run<br/>
            <span style={{ fontSize: 11, color: "#374151" }}>
              or ⚡ Compare all to rank all 5 strategies at once
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
