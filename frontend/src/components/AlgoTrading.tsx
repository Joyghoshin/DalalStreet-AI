"use client";
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlavorKey = "momentum" | "reversion" | "arbitrage" | "options";

interface Strategy {
  key: string;
  name: string;
  sub: string;
  badge: string;
  badgeColor: string;
}

interface SignalRow {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD" | "ENTER" | "SKIP" | "WATCH";
  col3: string;
  col4: string;
  col5: string;
}

interface StrategyDetail {
  name: string;
  desc: string;
  params: [string, string][];
  colHeaders: [string, string, string, string, string];
  rows: SignalRow[];
  greeks?: { label: string; value: string; pct: number; color: string }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FLAVORS: { key: FlavorKey; label: string; dot: string }[] = [
  { key: "momentum",  label: "Momentum",      dot: "#4ade80" },
  { key: "reversion", label: "Mean reversion", dot: "#60a5fa" },
  { key: "arbitrage", label: "Arbitrage",      dot: "#a78bfa" },
  { key: "options",   label: "Options F&O",    dot: "#f87171" },
];

const STRATEGIES: Record<FlavorKey, Strategy[]> = {
  momentum: [
    { key: "breakout", name: "52-week breakout", sub: "Price + volume surge",   badge: "High hit rate", badgeColor: "#14532d" },
    { key: "ema",      name: "EMA crossover",    sub: "9 / 21 / 50 EMA",        badge: "Trend follow",  badgeColor: "#1e3a5f" },
    { key: "rsi",      name: "RSI momentum",     sub: "Nifty 200 universe",     badge: "Mid-cap focus", badgeColor: "#713f12" },
  ],
  reversion: [
    { key: "bb",    name: "Bollinger bands",  sub: "Band squeeze play",      badge: "Low volatility", badgeColor: "#1e3a5f" },
    { key: "zscore",name: "Z-score revert",  sub: "Statistical deviation",  badge: "Quant",          badgeColor: "#3b0764" },
    { key: "open",  name: "Opening range",   sub: "9:15–9:30 AM NSE",       badge: "Intraday",       badgeColor: "#14532d" },
  ],
  arbitrage: [
    { key: "cash", name: "Cash-futures arb", sub: "Spot vs F&O spread",     badge: "Low risk",       badgeColor: "#3b0764" },
    { key: "pair", name: "Pairs trading",    sub: "Sector co-integration",  badge: "Market neutral", badgeColor: "#1e3a5f" },
    { key: "etf",  name: "ETF arbitrage",    sub: "NAV vs price gap",       badge: "Nifty BeES",     badgeColor: "#14532d" },
  ],
  options: [
    { key: "sell",  name: "Options selling", sub: "Short strangle/straddle", badge: "High margin",  badgeColor: "#7f1d1d" },
    { key: "iron",  name: "Iron condor",     sub: "Range-bound Nifty",       badge: "Defined risk", badgeColor: "#3b0764" },
    { key: "delta", name: "Delta neutral",   sub: "Gamma scalping",          badge: "Advanced",     badgeColor: "#1e3a5f" },
  ],
};

const DETAILS: Record<string, StrategyDetail> = {
  "momentum-breakout": {
    name: "52-week breakout",
    desc: "Scans NSE 500 for stocks making fresh 52-week highs with 2× average volume. Entry on close above breakout level.",
    params: [["Universe","NSE 500"],["Timeframe","Daily"],["Stop loss","3%"],["Target","9% (3R)"]],
    colHeaders: ["Symbol","Signal","Price","Vol surge","Strength"],
    rows: [
      { symbol:"TATAELXSI", signal:"BUY",  col3:"₹8,420", col4:"2.8×", col5:"★★★★★" },
      { symbol:"POLYCAB",   signal:"BUY",  col3:"₹6,180", col4:"2.1×", col5:"★★★★☆" },
      { symbol:"CAMS",      signal:"HOLD", col3:"₹3,940", col4:"1.4×", col5:"★★★☆☆" },
      { symbol:"DMART",     signal:"SELL", col3:"₹4,850", col4:"0.9×", col5:"★★☆☆☆" },
    ],
  },
  "momentum-ema": {
    name: "EMA crossover",
    desc: "9/21 EMA golden cross on 15-min chart with 50 EMA trend filter. Auto-exits on 9 EMA bearish cross.",
    params: [["Universe","Nifty 200"],["Timeframe","15 min"],["EMAs","9 / 21 / 50"],["Stop loss","ATR 1.5×"]],
    colHeaders: ["Symbol","Signal","Price","Cross","Trend"],
    rows: [
      { symbol:"ADANIENT",   signal:"BUY",  col3:"₹2,840", col4:"9>21",  col5:"Bullish" },
      { symbol:"BAJFINANCE", signal:"BUY",  col3:"₹7,180", col4:"9>21",  col5:"Bullish" },
      { symbol:"ASIANPAINT", signal:"HOLD", col3:"₹2,640", col4:"Flat",  col5:"Neutral" },
      { symbol:"BRITANNIA",  signal:"SELL", col3:"₹5,120", col4:"9<21",  col5:"Bearish" },
    ],
  },
  "momentum-rsi": {
    name: "RSI momentum",
    desc: "Buys stocks with RSI crossing above 60 after pullback. Exits when RSI falls below 50. Nifty Midcap 150 universe.",
    params: [["Universe","Midcap 150"],["Timeframe","Daily"],["RSI period","14"],["Filter","RSI > 60"]],
    colHeaders: ["Symbol","Signal","Price","RSI","Momentum"],
    rows: [
      { symbol:"APLAPOLLO",  signal:"BUY",  col3:"₹1,620", col4:"64", col5:"Rising" },
      { symbol:"KAJARIACER", signal:"BUY",  col3:"₹1,240", col4:"61", col5:"Rising" },
      { symbol:"RBLBANK",    signal:"HOLD", col3:"₹215",   col4:"53", col5:"Flat"   },
      { symbol:"MFSL",       signal:"SELL", col3:"₹1,080", col4:"72", col5:"Overbought" },
    ],
  },
  "reversion-bb": {
    name: "Bollinger band squeeze",
    desc: "Identifies Nifty 50 stocks outside 2σ bands with RSI divergence. Mean-reversion entry targeting mid-band.",
    params: [["Universe","Nifty 50"],["Timeframe","15 min"],["Bands","2σ"],["RSI filter","<30 / >70"]],
    colHeaders: ["Symbol","Signal","Price","Deviation","RSI"],
    rows: [
      { symbol:"WIPRO",   signal:"BUY",  col3:"₹512",   col4:"-2.4σ", col5:"26" },
      { symbol:"INFY",    signal:"HOLD", col3:"₹1,840", col4:"-1.1σ", col5:"41" },
      { symbol:"HCLTECH", signal:"SELL", col3:"₹1,980", col4:"+2.2σ", col5:"74" },
      { symbol:"LTIM",    signal:"SELL", col3:"₹5,620", col4:"+2.7σ", col5:"78" },
    ],
  },
  "reversion-zscore": {
    name: "Z-score reversion",
    desc: "Computes 20-day rolling z-score of returns. Enters when |z| > 2.0 and reverts toward zero mean.",
    params: [["Lookback","20 days"],["Timeframe","Daily"],["Entry","z > ±2.0"],["Exit","z < ±0.5"]],
    colHeaders: ["Symbol","Signal","Price","Z-score","Days out"],
    rows: [
      { symbol:"TATASTEEL",  signal:"BUY",  col3:"₹168",   col4:"-2.3", col5:"3d" },
      { symbol:"JSWSTEEL",   signal:"BUY",  col3:"₹940",   col4:"-2.1", col5:"2d" },
      { symbol:"HINDALCO",   signal:"HOLD", col3:"₹685",   col4:"-1.4", col5:"—"  },
      { symbol:"COALINDIA",  signal:"SELL", col3:"₹498",   col4:"+2.5", col5:"4d" },
    ],
  },
  "reversion-open": {
    name: "Opening range breakout",
    desc: "Captures the high/low of the first 15 minutes (9:15–9:30 AM IST). Trades the breakout direction with volume confirmation.",
    params: [["Range window","9:15–9:30"],["Timeframe","1 min"],["Target","2× range"],["Stop","Below range"]],
    colHeaders: ["Symbol","Signal","Price","OR high","OR low"],
    rows: [
      { symbol:"NIFTY50",   signal:"BUY",  col3:"24,610", col4:"24,590", col5:"24,540" },
      { symbol:"BANKNIFTY", signal:"SELL", col3:"52,180", col4:"52,420", col5:"52,100" },
      { symbol:"RELIANCE",  signal:"BUY",  col3:"₹2,948", col4:"₹2,941", col5:"₹2,918" },
      { symbol:"HDFCBANK",  signal:"HOLD", col3:"₹1,862", col4:"₹1,870", col5:"₹1,850" },
    ],
  },
  "arbitrage-cash": {
    name: "Cash-futures arbitrage",
    desc: "Exploits mispricing between NSE spot and near-month futures. Triggers when annualised spread exceeds risk-free rate + transaction cost.",
    params: [["Min spread","0.45%"],["Expiry","Near month"],["Risk-free","6.5% p.a."],["Margin req.","~15%"]],
    colHeaders: ["Symbol","Signal","Spread","Ann. yield","Lot size"],
    rows: [
      { symbol:"RELIANCE",  signal:"ENTER", col3:"₹14.5", col4:"8.2%", col5:"250"  },
      { symbol:"ICICIBANK", signal:"ENTER", col3:"₹5.8",  col4:"7.4%", col5:"1375" },
      { symbol:"SBIN",      signal:"SKIP",  col3:"₹1.2",  col4:"5.9%", col5:"1500" },
      { symbol:"HDFCBANK",  signal:"ENTER", col3:"₹8.1",  col4:"7.9%", col5:"550"  },
    ],
  },
  "arbitrage-pair": {
    name: "Pairs trading",
    desc: "Finds co-integrated pairs within the same sector. Trades spread divergence when z-score exceeds ±2.0.",
    params: [["Method","Co-integration"],["Universe","Nifty 100"],["Entry","Z > ±2.0"],["Holding","5–10 days"]],
    colHeaders: ["Pair","Signal","Spread z","Corr (90d)","P-value"],
    rows: [
      { symbol:"INFY / TCS",         signal:"BUY",  col3:"-2.2", col4:"0.94", col5:"0.003" },
      { symbol:"SBIN / BANKBARODA",  signal:"SELL", col3:"+2.5", col4:"0.91", col5:"0.008" },
      { symbol:"ONGC / BPCL",        signal:"HOLD", col3:"-1.1", col4:"0.88", col5:"0.021" },
      { symbol:"LT / SIEMENS",       signal:"BUY",  col3:"-2.0", col4:"0.86", col5:"0.014" },
    ],
  },
  "arbitrage-etf": {
    name: "ETF arbitrage",
    desc: "Monitors premium/discount of Nifty BeES and BankBeES vs their live NAV. Enters when gap exceeds 0.10%.",
    params: [["ETFs","Nifty BeES / BankBeES"],["Min gap","0.10%"],["Settlement","T+1"],["Mechanism","AP creation/redemption"]],
    colHeaders: ["ETF","Signal","Price","NAV","Premium"],
    rows: [
      { symbol:"NIFTYBEES",  signal:"SELL", col3:"₹249.80", col4:"₹249.20", col5:"+0.24%" },
      { symbol:"BANKBEES",   signal:"BUY",  col3:"₹523.10", col4:"₹524.40", col5:"-0.25%" },
      { symbol:"JUNIORBEES", signal:"HOLD", col3:"₹698.50", col4:"₹698.40", col5:"+0.01%" },
      { symbol:"ITBEES",     signal:"BUY",  col3:"₹51.20",  col4:"₹51.60",  col5:"-0.78%" },
    ],
  },
  "options-sell": {
    name: "Options selling — Nifty weekly",
    desc: "Sells OTM call and put on Nifty weekly expiry. Targets IV crush and theta decay. Adjusts delta on 0.30 breach.",
    params: [["Nifty spot","24,580"],["India VIX","13.4 ↓"],["Expiry","Thu 19 Jun"],["IV rank","38%"]],
    colHeaders: ["Strike","Type","Premium","Delta","Action"],
    rows: [
      { symbol:"25,000 CE", signal:"SELL",  col3:"₹62",  col4:"-0.24", col5:"Short call" },
      { symbol:"24,000 PE", signal:"SELL",  col3:"₹58",  col4:"+0.22", col5:"Short put"  },
      { symbol:"24,600 CE", signal:"WATCH", col3:"₹180", col4:"-0.41", col5:"Hedge CE"   },
      { symbol:"24,500 PE", signal:"WATCH", col3:"₹160", col4:"+0.38", col5:"Hedge PE"   },
    ],
    greeks: [
      { label:"Theta", value:"+₹840/day", pct:72, color:"#4ade80" },
      { label:"Vega",  value:"-₹520",     pct:48, color:"#60a5fa" },
      { label:"Gamma", value:"-0.003",    pct:30, color:"#f87171" },
      { label:"Delta", value:"-0.02",     pct:12, color:"#a78bfa" },
    ],
  },
  "options-iron": {
    name: "Iron condor — BankNifty",
    desc: "Sells an OTM call spread and OTM put spread on BankNifty. Profits when underlying stays within the tent.",
    params: [["BankNifty","52,180"],["Max profit","₹4,200"],["Max loss","₹5,800"],["Width","500 pts each side"]],
    colHeaders: ["Leg","Strike","Type","Premium","Action"],
    rows: [
      { symbol:"Short call", signal:"SELL",  col3:"53,000 CE", col4:"₹310", col5:"Sell" },
      { symbol:"Long call",  signal:"BUY",   col3:"53,500 CE", col4:"₹120", col5:"Buy"  },
      { symbol:"Short put",  signal:"SELL",  col3:"51,500 PE", col4:"₹280", col5:"Sell" },
      { symbol:"Long put",   signal:"BUY",   col3:"51,000 PE", col4:"₹110", col5:"Buy"  },
    ],
  },
  "options-delta": {
    name: "Delta neutral — gamma scalping",
    desc: "Buys ATM straddle and dynamically hedges delta by trading underlying futures. Profits from large moves (long gamma).",
    params: [["Position","Long straddle"],["Hedge freq.","Every Δ0.10"],["Gamma","Long"],["Ideal VIX","< 15"]],
    colHeaders: ["Component","Strike","Delta","Gamma","P&L"],
    rows: [
      { symbol:"Long CE",   signal:"BUY",  col3:"24,600 CE", col4:"+0.50", col5:"+₹1,840" },
      { symbol:"Long PE",   signal:"BUY",  col3:"24,600 PE", col4:"-0.50", col5:"+₹960"   },
      { symbol:"Short fut", signal:"SELL", col3:"NIFTY Jun", col4:"-0.00", col5:"-₹620"   },
      { symbol:"Net",       signal:"HOLD", col3:"ATM",       col4:"~0.00", col5:"+₹2,180" },
    ],
  },
};

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: SignalRow["signal"] }) {
  const map: Record<string, { bg: string; color: string }> = {
    BUY:   { bg: "#14532d", color: "#86efac" },
    ENTER: { bg: "#14532d", color: "#86efac" },
    SELL:  { bg: "#7f1d1d", color: "#fca5a5" },
    HOLD:  { bg: "#1c1917", color: "#a8a29e" },
    SKIP:  { bg: "#1c1917", color: "#a8a29e" },
    WATCH: { bg: "#713f12", color: "#fde68a" },
  };
  const s = map[signal] ?? map.HOLD;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, fontFamily: "monospace",
      padding: "2px 8px", borderRadius: 4,
      background: s.bg, color: s.color,
      letterSpacing: "0.04em",
    }}>
      {signal}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AlgoTrading() {
  const [flavor,   setFlavor]   = useState<FlavorKey>("momentum");
  const [stratKey, setStratKey] = useState("breakout");

  const detail = DETAILS[`${flavor}-${stratKey}`] ?? DETAILS["momentum-breakout"];

  // When switching flavor, reset to first strategy
  function handleFlavorSwitch(f: FlavorKey) {
    setFlavor(f);
    setStratKey(STRATEGIES[f][0].key);
  }

  // Live IST clock
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Kolkata",
      }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const card: React.CSSProperties = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-surface-border)",
    borderRadius: 8,
    padding: "10px 12px",
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
          🤖 Algo trading
        </h3>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: "#4ade80", marginRight: 5,
            animation: "algoPulse 1.4s ease infinite",
          }} />
          Live · IST {clock}
        </span>
      </div>

      <style>{`
        @keyframes algoPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>

      {/* ── Flavor tabs ── */}
      <div style={{
        display: "flex", gap: 4, padding: "10px 14px",
        borderBottom: "1px solid var(--color-surface-border)",
        overflowX: "auto",
      }}>
        {FLAVORS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFlavorSwitch(f.key)}
            style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 11,
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              border: "1px solid var(--color-surface-border)",
              fontFamily: "monospace",
              background: flavor === f.key
                ? "var(--color-surface-elevated)" : "transparent",
              color: flavor === f.key ? "#fff" : "#6b7280",
              transition: "all 0.15s",
            }}
          >
            <span style={{
              display: "inline-block", width: 6, height: 6,
              borderRadius: "50%", background: f.dot,
              marginRight: 5, verticalAlign: "middle",
            }} />
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Strategy cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {STRATEGIES[flavor].map(s => (
            <div
              key={s.key}
              onClick={() => setStratKey(s.key)}
              style={{
                ...card,
                cursor: "pointer",
                borderColor: stratKey === s.key
                  ? "var(--color-accent)" : "var(--color-surface-border)",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", marginBottom: 3 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>{s.sub}</div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px",
                borderRadius: 4, background: s.badgeColor,
                color: "#d1fae5", letterSpacing: "0.04em",
              }}>
                {s.badge}
              </span>
            </div>
          ))}
        </div>

        {/* ── Signal panel ── */}
        <div style={card}>
          {/* Panel header */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>
                {detail.name}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, maxWidth: 480 }}>
                {detail.desc}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px",
              borderRadius: 4, background: "#14532d", color: "#86efac",
              whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#4ade80", display: "inline-block",
                animation: "algoPulse 1.4s ease infinite",
              }} />
              LIVE
            </span>
          </div>

          {/* Params */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            gap: 6, marginBottom: 12,
          }}>
            {detail.params.map(([label, val]) => (
              <div key={label} style={{
                background: "var(--color-surface-card)",
                borderRadius: 6, padding: "6px 8px",
                border: "1px solid var(--color-surface-border)",
              }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", fontFamily: "monospace", marginTop: 2 }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Signals table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {detail.colHeaders.map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "5px 8px",
                    fontSize: 10, color: "#6b7280", fontWeight: 600,
                    borderBottom: "1px solid var(--color-surface-border)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < detail.rows.length - 1 ? "1px solid var(--color-surface-border)" : "none" }}>
                  <td style={{ padding: "7px 8px", fontFamily: "monospace", fontWeight: 700, color: "#d1d5db" }}>
                    {row.symbol}
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <SignalBadge signal={row.signal} />
                  </td>
                  <td style={{ padding: "7px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{row.col3}</td>
                  <td style={{ padding: "7px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{row.col4}</td>
                  <td style={{ padding: "7px 8px", fontFamily: "monospace", color: "#9ca3af" }}>{row.col5}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Greeks (options only) */}
          {detail.greeks && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--color-surface-border)", paddingTop: 12 }}>
              <div style={{
                fontSize: 9, color: "#6b7280", textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 8,
              }}>
                Greeks snapshot
              </div>
              {detail.greeks.map(g => (
                <div key={g.label} style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 7,
                }}>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 42 }}>{g.label}</span>
                  <div style={{
                    flex: 1, height: 6, borderRadius: 3,
                    background: "var(--color-surface-card)", overflow: "hidden",
                  }}>
                    <div style={{ height: "100%", width: `${g.pct}%`, background: g.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#e5e7eb", width: 80, textAlign: "right" }}>
                    {g.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
