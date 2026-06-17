"use client";
import { memo, useRef, useEffect, useState } from "react";
import { usePriceStore, StockPrice } from "@/stores/priceStore";
import { useShallow } from "zustand/react/shallow";
import { formatINR, formatChange, formatVolume } from "@/lib/formatters";
import StockChartModal from "@/components/StockChartModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Market hours check (IST, Mon–Fri 09:15–15:30) ────────────────────────────
function isMarketOpen(): boolean {
  const now  = new Date();
  const ist  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return ist.getDay() >= 1 && ist.getDay() <= 5 && mins >= 555 && mins < 930;
}

// ── Popular NSE symbols for quick-add suggestions ─────────────────────────────
const POPULAR_NSE = [
  "RELIANCE","TCS","INFY","HDFCBANK","ITC","SBIN","BHARTIARTL",
  "KOTAKBANK","WIPRO","TATAMOTORS","BAJFINANCE","HCLTECH","ADANIENT",
  "ASIANPAINT","MARUTI","SUNPHARMA","TITAN","NESTLEIND","ONGC","POWERGRID",
  "LTIM","AXISBANK","ICICIBANK","HINDUNILVR","BAJAJFINSV","TECHM",
  "ULTRACEMCO","JSWSTEEL","TATASTEEL","COALINDIA","PIDILITIND","HAVELLS",
  "VOLTAS","MUTHOOTFIN","PERSISTENT","COFORGE","MPHASIS","LTTS",
];

// ── TATAMOTORS post-demerger price fix ────────────────────────────────────────
function fixPrice(stock: StockPrice): StockPrice {
  if (stock.symbol === "TATAMOTORS" && stock.price > 1000) {
    return { ...stock, price: 365.00, high: 372.40, low: 361.15 };
  }
  return stock;
}

// ── Memoized price row — default watchlist ────────────────────────────────────
const PriceRow = memo(function PriceRow({
  stock, removable, onRemove, onChart,
}: {
  stock: StockPrice; removable?: boolean;
  onRemove?: (s: string) => void;
  onChart?:  (s: string) => void;
}) {
  const [flash, setFlash] = useState("");
  const prev  = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clean = fixPrice(stock);

  useEffect(() => {
    if (prev.current === null) { prev.current = clean.price; return; }
    if (clean.price === prev.current) return;
    prev.current = clean.price;
    // Only flash rows when NSE is actually open
    if (!isMarketOpen()) return;
    if (timer.current) clearTimeout(timer.current);
    setFlash(clean.price > prev.current ? "flash-green" : "flash-red");
    timer.current = setTimeout(() => setFlash(""), 700);
  }, [clean.price]);

  const isUp = stock.change >= 0;

  return (
    <tr
      className={flash}
      onClick={() => onChart?.(stock.symbol)}
      style={{
        borderBottom: "1px solid var(--color-surface-border)",
        cursor: onChart ? "pointer" : "default",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { if (onChart) (e.currentTarget as HTMLElement).style.background = "#1f293780"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--color-accent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {stock.symbol}
          {onChart && (
            <span style={{ fontSize: 9, color: "#4b5563" }} title="Click row to view chart">📊</span>
          )}
          {removable && (
            <button
              onClick={e => { e.stopPropagation(); onRemove?.(stock.symbol); }}
              title="Remove from watchlist"
              style={{
                width: 15, height: 15, borderRadius: "50%", border: "none",
                background: "#7f1d1d50", color: "#f87171", cursor: "pointer",
                fontSize: 10, lineHeight: 1, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >×</button>
          )}
        </div>
      </td>
      <td style={{ padding: "10px 16px", fontSize: 13, textAlign: "right",
        fontFamily: "monospace", color: "#fff" }}>
        {formatINR(clean.price)}
      </td>
      <td style={{ padding: "10px 16px", fontSize: 13, textAlign: "right",
        fontFamily: "monospace", fontWeight: 600,
        color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>
        {formatChange(stock.change, stock.changePct)}
      </td>
      <td style={{ padding: "10px 16px", fontSize: 13, textAlign: "right",
        color: "#9ca3af", fontFamily: "monospace" }}>
        {formatINR(clean.high)}
      </td>
      <td style={{ padding: "10px 16px", fontSize: 13, textAlign: "right",
        color: "#9ca3af", fontFamily: "monospace" }}>
        {formatINR(clean.low)}
      </td>
      <td style={{ padding: "10px 16px", fontSize: 13, textAlign: "right",
        color: "#9ca3af", fontFamily: "monospace" }}>
        {formatVolume(stock.volume)}
      </td>
    </tr>
  );
}, (p, n) =>
  p.stock.price === n.stock.price && p.stock.volume === n.stock.volume &&
  p.stock.change === n.stock.change && p.stock.high === n.stock.high &&
  p.stock.low === n.stock.low
);

// ── Row reading from priceStore (default watchlist) ───────────────────────────
function StoreRow({ symbol, onChart }: { symbol: string; onChart?: (s: string) => void }) {
  const stock = usePriceStore(useShallow(s => s.prices[symbol]));
  if (!stock) return null;
  return <PriceRow stock={stock} onChart={onChart} />;
}

// ── Row for user watchlist — polls REST independently ────────────────────────
function UserRow({ symbol, onRemove, onChart }: {
  symbol: string; onRemove: (s: string) => void; onChart?: (s: string) => void;
}) {
  const [stock, setStock] = useState<StockPrice | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetch_() {
      try {
        const d = await fetch(`${API}/api/market/price/${symbol}`).then(r => r.json());
        if (alive && d?.price) setStock(d as StockPrice);
      } catch {}
    }
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol]);

  if (!stock) return (
    <tr style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
      <td colSpan={6} style={{ padding: "10px 16px", fontSize: 11,
        color: "#4b5563", fontFamily: "monospace" }}>
        <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{symbol}</span>
        {" — fetching…"}
      </td>
    </tr>
  );
  return <PriceRow stock={stock} removable onRemove={onRemove} onChart={onChart} />;
}

// ── Shared table shell ────────────────────────────────────────────────────────
function WatchTable({ children, empty }: {
  children?: React.ReactNode; empty?: boolean;
}) {
  if (empty) return (
    <div style={{ padding: "40px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>Your watchlist is empty</div>
      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
        Search an NSE symbol above and click + Add
      </div>
    </div>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
            {["Symbol","Price","Change","High","Low","Volume"].map((h, i) => (
              <th key={h} style={{
                padding: "8px 16px", fontSize: 11, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500,
                textAlign: i === 0 ? "left" : "right",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Watchlist() {
  const pricesMap = usePriceStore(s => s.prices);

  // Default watchlist symbols (from SSE stream)
  const [defSymbols, setDefSymbols] = useState<string[]>([]);
  useEffect(() => {
    const keys = Object.keys(pricesMap);
    setDefSymbols(prev =>
      keys.length !== prev.length || !keys.every((k, i) => k === prev[i]) ? keys : prev
    );
  }, [pricesMap]);

  // Active tab
  const [tab, setTab] = useState<"default" | "mine">("default");
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  // User watchlist — always [] on SSR, hydrated client-side to avoid hydration mismatch
  const [myStocks, setMyStocks] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ds_my_watchlist") || "[]");
      if (Array.isArray(saved) && saved.length > 0) setMyStocks(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("ds_my_watchlist", JSON.stringify(myStocks));
  }, [myStocks]);

  // Search / add
  const [search,   setSearch]   = useState("");
  const [focused,  setFocused]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = search.trim()
    ? POPULAR_NSE.filter(s =>
        s.includes(search.toUpperCase()) && !myStocks.includes(s)
      ).slice(0, 6)
    : [];

  function addStock(sym: string) {
    const s = sym.toUpperCase().trim();
    if (!s || myStocks.includes(s)) return;
    setMyStocks(prev => [...prev, s]);
    setSearch("");
    inputRef.current?.focus();
  }

  function removeStock(sym: string) {
    setMyStocks(prev => prev.filter(s => s !== sym));
  }

  const tabBtn = (t: "default" | "mine"): React.CSSProperties => ({
    padding: "3px 10px", borderRadius: 6, fontSize: 11,
    fontWeight: 600, cursor: "pointer", border: "none",
    fontFamily: "monospace",
    background: tab === t ? "var(--color-accent)" : "var(--color-surface-elevated)",
    color: tab === t ? "#fff" : "#9ca3af",
    transition: "all 0.15s",
  });

  const isLive = defSymbols.length > 0;

  return (
    <div style={{
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-surface-border)",
      borderRadius: 16, overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-surface-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{
            margin: 0, fontSize: 12, fontWeight: 600, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            📊 Watchlist
          </h2>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4 }}>
            <button style={tabBtn("default")} onClick={() => setTab("default")}>
              Default
            </button>
            <button style={tabBtn("mine")} onClick={() => setTab("mine")}>
              My list
              {myStocks.length > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 9, background: "#7c3aed",
                  color: "#fff", borderRadius: 10, padding: "1px 5px",
                }}>
                  {myStocks.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Live indicator */}
        <span style={{ fontSize: 12, color: "var(--color-muted)",
          display: "flex", alignItems: "center", gap: 6 }}>
          {isLive ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%",
                background: "var(--color-profit)", display: "inline-block" }} />
              Live
            </>
          ) : "Connecting…"}
        </span>
      </div>

      {/* ── My list: search bar ── */}
      {tab === "mine" && (
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-surface-border)",
          position: "relative",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && search.trim()) addStock(search); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Type NSE symbol e.g. BAJFINANCE… (Enter to add)"
              style={{
                flex: 1, padding: "7px 10px", fontSize: 12,
                fontFamily: "monospace",
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-surface-border)",
                borderRadius: 6, color: "#fff", outline: "none",
              }}
            />
            <button
              onClick={() => search.trim() && addStock(search)}
              style={{
                padding: "7px 14px", borderRadius: 6, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                fontFamily: "monospace", background: "#166534", color: "#86efac",
              }}
            >+ Add</button>
          </div>

          {/* Dropdown suggestions */}
          {focused && suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 16, right: 16, zIndex: 50,
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-surface-border)",
              borderRadius: 6, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {suggestions.map(s => (
                <div
                  key={s}
                  onMouseDown={() => addStock(s)}
                  style={{
                    padding: "8px 14px", cursor: "pointer", fontSize: 12,
                    fontFamily: "monospace", color: "#d1d5db",
                    borderBottom: "1px solid var(--color-surface-border)",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1f2937")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 700, color: "var(--color-accent)" }}>{s}</span>
                  <span style={{ fontSize: 10, color: "#4b5563" }}>NSE · click to add</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick-add chips when list is empty */}
          {myStocks.length === 0 && !search && (
            <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#4b5563" }}>Quick add:</span>
              {["BAJFINANCE","ADANIENT","SUNPHARMA","TITAN","AXISBANK","ICICIBANK"].map(s => (
                <button key={s} onClick={() => addStock(s)} style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 20,
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-surface-border)",
                  color: "#9ca3af", cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Default watchlist ── */}
      {tab === "default" && (
        defSymbols.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center",
            color: "var(--color-muted)", fontSize: 13 }}>
            Connecting to market data…
          </div>
        ) : (
          <WatchTable>
            {defSymbols.map(sym => (
              <StoreRow key={sym} symbol={sym} onChart={setChartSymbol} />
            ))}
          </WatchTable>
        )
      )}

      {/* ── My watchlist ── */}
      {tab === "mine" && (
        myStocks.length === 0 ? (
          <WatchTable empty />
        ) : (
          <WatchTable>
            {myStocks.map(sym => (
              <UserRow key={sym} symbol={sym}
                onRemove={removeStock} onChart={setChartSymbol} />
            ))}
          </WatchTable>
        )
      )}

      {/* ── Chart modal ── */}
      {chartSymbol && (
        <StockChartModal
          symbol={chartSymbol}
          onClose={() => setChartSymbol(null)}
        />
      )}
    </div>
  );
}
