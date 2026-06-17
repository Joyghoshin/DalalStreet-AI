"use client";
import { useEffect, useState, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Candle {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}
type ChartType = "candle" | "line";
type Period    = "1mo" | "3mo" | "1y" | "3y";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1mo", label: "1M" }, { key: "3mo", label: "3M" },
  { key: "1y",  label: "1Y" }, { key: "3y",  label: "3Y" },
];

// ── Canvas renderer ───────────────────────────────────────────────────────────
function drawChart(
  canvas: HTMLCanvasElement,
  candles: Candle[],
  type: ChartType,
  hoverIdx: number | null,
  viewStart: number,   // 0..1 fraction
  viewEnd: number,
) {
  const ctx  = canvas.getContext("2d")!;
  const W    = canvas.width;
  const H    = canvas.height;
  const PAD  = { top: 24, right: 70, bottom: 44, left: 12 };
  const cW   = W - PAD.left - PAD.right;
  const cH   = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);
  if (!candles.length) return;

  // Visible slice
  const total  = candles.length;
  const iStart = Math.max(0, Math.floor(viewStart * total));
  const iEnd   = Math.min(total, Math.ceil(viewEnd * total));
  const visible = candles.slice(iStart, iEnd);
  if (!visible.length) return;

  const highs  = visible.map(c => c.high);
  const lows   = visible.map(c => c.low);
  const closes = visible.map(c => c.close);
  const maxP   = Math.max(...highs) * 1.005;
  const minP   = Math.min(...lows)  * 0.995;
  const rangeP = maxP - minP || 1;

  const toX = (i: number) => PAD.left + (i / Math.max(visible.length - 1, 1)) * cW;
  const toY = (p: number) => PAD.top  + ((maxP - p) / rangeP) * cH;

  // Grid
  const gridN = 5;
  ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 1;
  for (let g = 0; g <= gridN; g++) {
    const y = PAD.top + (g / gridN) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const price = maxP - (g / gridN) * rangeP;
    ctx.fillStyle = "#6b7280"; ctx.font = "10px monospace"; ctx.textAlign = "left";
    ctx.fillText(`₹${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      W - PAD.right + 4, y + 4);
  }

  if (type === "line") {
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0, "rgba(74,222,128,0.3)");
    grad.addColorStop(1, "rgba(74,222,128,0.00)");
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(closes[0]));
    for (let i = 1; i < closes.length; i++) ctx.lineTo(toX(i), toY(closes[i]));
    ctx.lineTo(toX(closes.length - 1), PAD.top + cH);
    ctx.lineTo(toX(0), PAD.top + cH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5;
    ctx.moveTo(toX(0), toY(closes[0]));
    for (let i = 1; i < closes.length; i++) ctx.lineTo(toX(i), toY(closes[i]));
    ctx.stroke();

    if (hoverIdx !== null) {
      const vi = hoverIdx - iStart;
      if (vi >= 0 && vi < visible.length) {
        const x = toX(vi); const y = toY(closes[vi]);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80"; ctx.fill();
        ctx.beginPath(); ctx.strokeStyle = "#374151"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + cH); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  } else {
    const candleW = Math.max(1, Math.floor(cW / visible.length) - 1);
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const x = toX(i);
      const isUp  = c.close >= c.open;
      const isHov = hoverIdx === iStart + i;
      const color = isUp ? "#4ade80" : "#f87171";
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = isHov ? 2 : 1;
      ctx.moveTo(x, toY(c.high)); ctx.lineTo(x, toY(c.low)); ctx.stroke();
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyH   = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
      ctx.fillStyle = isHov ? (isUp ? "#86efac" : "#fca5a5") : color;
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
      if (isHov) {
        ctx.beginPath(); ctx.strokeStyle = "#374151"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + cH); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // X-axis labels
  const step = Math.max(1, Math.floor(visible.length / 6));
  ctx.fillStyle = "#6b7280"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  for (let i = 0; i < visible.length; i += step) {
    ctx.fillText(visible[i].date.slice(0, 10), toX(i), H - PAD.bottom + 14);
  }

  // Zoom range indicator
  if (viewStart > 0 || viewEnd < 1) {
    ctx.fillStyle = "#374151";
    ctx.fillRect(PAD.left, H - 8, cW, 4);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(PAD.left + viewStart * cW, H - 8, (viewEnd - viewStart) * cW, 4);
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ candle, cx, cy }: { candle: Candle; cx: number; cy: number }) {
  const isUp = candle.close >= candle.open;
  return (
    <div style={{
      position: "absolute", left: Math.min(cx + 12, 580), top: Math.max(cy - 90, 4),
      background: "#111827", border: "1px solid #374151", borderRadius: 6,
      padding: "8px 10px", fontSize: 11, fontFamily: "monospace",
      color: "#e5e7eb", pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap",
      boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
    }}>
      <div style={{ color: "#9ca3af", marginBottom: 4 }}>{candle.date.slice(0, 10)}</div>
      <div>O: <span>₹{candle.open.toLocaleString("en-IN")}</span></div>
      <div>H: <span style={{ color: "#4ade80" }}>₹{candle.high.toLocaleString("en-IN")}</span></div>
      <div>L: <span style={{ color: "#f87171" }}>₹{candle.low.toLocaleString("en-IN")}</span></div>
      <div>C: <span style={{ color: isUp ? "#4ade80" : "#f87171", fontWeight: 700 }}>
        ₹{candle.close.toLocaleString("en-IN")}
      </span></div>
      <div style={{ color: "#6b7280", marginTop: 2 }}>Vol: {(candle.volume / 100000).toFixed(1)}L</div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function StockChartModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [candles,   setCandles]   = useState<Candle[]>([]);
  const [period,    setPeriod]    = useState<Period>("3y");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [hoverIdx,  setHoverIdx]  = useState<number | null>(null);
  const [tooltip,   setTooltip]   = useState<{ candle: Candle; cx: number; cy: number } | null>(null);

  // Zoom state: 0..1 fractions of total candles
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd,   setViewEnd]   = useState(1);

  // Pan/zoom drag
  const dragRef   = useRef<{ startX: number; startVS: number; startVE: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/api/chart/ohlc/${symbol}?period=${period}`);
      if (!res.ok) throw new Error(`No chart data for ${symbol}`);
      const data = await res.json();
      setCandles(data.candles || []);
      setViewStart(0); setViewEnd(1); // reset zoom on new data
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [symbol, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length) return;
    const W = wrapRef.current?.clientWidth || 740;
    canvas.width  = W;
    canvas.height = 340;
    drawChart(canvas, candles, chartType, hoverIdx, viewStart, viewEnd);
  }, [candles, chartType, hoverIdx, viewStart, viewEnd]);

  // Mouse helpers
  function canvasIdx(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const PAD_L  = 12, PAD_R = 70;
    const cW     = canvas.width - PAD_L - PAD_R;
    const total  = candles.length;
    const iStart = Math.floor(viewStart * total);
    const iEnd   = Math.ceil(viewEnd * total);
    const vis    = iEnd - iStart;
    const frac   = (mouseX - PAD_L) / cW;
    return Math.max(iStart, Math.min(iEnd - 1, Math.round(iStart + frac * (vis - 1))));
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!candles.length) return;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();

    if (dragRef.current) {
      // Panning
      const dx    = (e.clientX - dragRef.current.startX) / (canvas.width - 82);
      const span  = dragRef.current.startVE - dragRef.current.startVS;
      let ns = dragRef.current.startVS - dx;
      let ne = dragRef.current.startVE - dx;
      if (ns < 0)  { ne -= ns; ns = 0; }
      if (ne > 1)  { ns -= (ne - 1); ne = 1; }
      setViewStart(Math.max(0, ns));
      setViewEnd(Math.min(1, ne));
      return;
    }

    const idx = canvasIdx(e);
    setHoverIdx(idx);
    setTooltip({ candle: candles[idx], cx: e.clientX - rect.left, cy: e.clientY - rect.top });
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    dragRef.current = { startX: e.clientX, startVS: viewStart, startVE: viewEnd };
  }

  function handleMouseUp()    { dragRef.current = null; }
  function handleMouseLeave() { dragRef.current = null; setHoverIdx(null); setTooltip(null); }

  // Scroll to zoom
  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!candles.length) return;
    const canvas  = canvasRef.current!;
    const rect    = canvas.getBoundingClientRect();
    const frac    = (e.clientX - rect.left - 12) / (canvas.width - 82);
    const zoomDir = e.deltaY > 0 ? 1.15 : 0.85;
    const span    = viewEnd - viewStart;
    const newSpan = Math.max(0.05, Math.min(1, span * zoomDir));
    const pivot   = viewStart + frac * span;
    let ns = pivot - frac * newSpan;
    let ne = pivot + (1 - frac) * newSpan;
    if (ns < 0)  { ne -= ns;        ns = 0; }
    if (ne > 1)  { ns -= (ne - 1);  ne = 1; }
    setViewStart(Math.max(0, ns));
    setViewEnd(Math.min(1, ne));
  }

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const step = 0.1 * (viewEnd - viewStart);
      if (e.key === "ArrowLeft")  { setViewStart(s => Math.max(0, s - step)); setViewEnd(s => Math.max(step * 2, s - step)); }
      if (e.key === "ArrowRight") { setViewStart(s => Math.min(1 - step * 2, s + step)); setViewEnd(s => Math.min(1, s + step)); }
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") { setViewStart(0); setViewEnd(1); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose, viewStart, viewEnd]);

  function handleZoomIn() {
    const mid  = (viewStart + viewEnd) / 2;
    const span = (viewEnd - viewStart) * 0.6;
    setViewStart(Math.max(0, mid - span / 2));
    setViewEnd(Math.min(1, mid + span / 2));
  }
  function handleZoomOut() {
    const mid  = (viewStart + viewEnd) / 2;
    const span = Math.min(1, (viewEnd - viewStart) / 0.6);
    setViewStart(Math.max(0, mid - span / 2));
    setViewEnd(Math.min(1, mid + span / 2));
  }
  function handleReset() { setViewStart(0); setViewEnd(1); }

  const first = candles[0];
  const last  = candles[candles.length - 1];
  const totalRet  = first && last ? ((last.close - first.close) / first.close * 100).toFixed(2) : null;
  const isPositive = totalRet !== null && parseFloat(totalRet) >= 0;
  const periodHigh = candles.length ? Math.max(...candles.map(c => c.high)) : 0;
  const periodLow  = candles.length ? Math.min(...candles.map(c => c.low))  : 0;
  const zoomPct    = Math.round((viewEnd - viewStart) * 100);

  const btnStyle = (active: boolean, bg = "#166534", fg = "#86efac"): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 600, fontFamily: "monospace",
    background: active ? bg : "var(--color-surface-elevated)",
    color: active ? fg : "#6b7280", transition: "all 0.15s",
  });

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-surface-border)",
        borderRadius: 16, width: "100%", maxWidth: 820, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
      }}>

        {/* Header */}
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-accent)", fontFamily: "monospace" }}>
              {symbol}
            </span>
            {totalRet !== null && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace",
                background: isPositive ? "#14532d" : "#7f1d1d",
                color: isPositive ? "#86efac" : "#fca5a5",
              }}>
                {isPositive ? "+" : ""}{totalRet}% ({period})
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: "var(--color-surface-elevated)", color: "#9ca3af",
            cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Controls */}
        <div style={{
          padding: "8px 16px", borderBottom: "1px solid var(--color-surface-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
        }}>
          {/* Period */}
          <div style={{ display: "flex", gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={btnStyle(period === p.key)}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
              Zoom: {zoomPct}%
            </span>
            <button onClick={handleZoomIn}  style={btnStyle(false)} title="Zoom in (+ key)">＋</button>
            <button onClick={handleZoomOut} style={btnStyle(false)} title="Zoom out (− key)">－</button>
            <button onClick={handleReset}   style={btnStyle(false)} title="Reset zoom (0 key)">⊡</button>
            <div style={{ width: 1, height: 16, background: "var(--color-surface-border)" }} />
            <button onClick={() => setChartType("candle")} style={btnStyle(chartType === "candle", "#1e3a5f", "#93c5fd")}>
              🕯 Candle
            </button>
            <button onClick={() => setChartType("line")} style={btnStyle(chartType === "line")}>
              📈 Line
            </button>
          </div>
        </div>

        {/* Stats */}
        {candles.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            borderBottom: "1px solid var(--color-surface-border)",
          }}>
            {[
              { label: "Current",        value: `₹${last?.close.toLocaleString("en-IN")}`, color: "#e5e7eb" },
              { label: `${period} High`, value: `₹${periodHigh.toLocaleString("en-IN")}`,  color: "#4ade80" },
              { label: `${period} Low`,  value: `₹${periodLow.toLocaleString("en-IN")}`,   color: "#f87171" },
              { label: `${period} Ret`,  value: `${isPositive ? "+" : ""}${totalRet}%`,     color: isPositive ? "#4ade80" : "#f87171" },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: "7px 16px",
                borderRight: i < 3 ? "1px solid var(--color-surface-border)" : "none",
              }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: s.color, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div ref={wrapRef} style={{ padding: "12px 16px 8px", position: "relative" }}>
          {loading && (
            <div style={{ height: 340, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "3px solid var(--color-surface-border)",
                borderTopColor: "#4ade80",
                animation: "chartSpin 0.8s linear infinite",
              }} />
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                Fetching {symbol} history…
              </span>
              <style>{`@keyframes chartSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {error && (
            <div style={{ height: 340, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#f87171", fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}
          {!loading && !error && (
            <div style={{ position: "relative", userSelect: "none" }}>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: 340, display: "block", cursor: dragRef.current ? "grabbing" : "crosshair" }}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
              />
              {tooltip && <Tooltip {...tooltip} />}
            </div>
          )}
          <div style={{ fontSize: 9, color: "#374151", textAlign: "center", marginTop: 4 }}>
            🖱 Scroll to zoom · Drag to pan · ← → keys to scroll · 0 to reset · Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}
