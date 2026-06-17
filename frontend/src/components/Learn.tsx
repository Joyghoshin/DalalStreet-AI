"use client";
import { useState, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

interface Lesson {
  id: number;
  title: string;
  emoji: string;
  duration: string;
  content: { heading: string; body: string; tip?: string }[];
  quiz: { q: string; options: string[]; answer: number }[];
}

// ── Lessons data ──────────────────────────────────────────────────────────────

const LESSONS: Lesson[] = [
  {
    id: 1,
    title: "What is Algo Trading?",
    emoji: "🤖",
    duration: "3 min",
    content: [
      {
        heading: "Trading with a computer brain",
        body: "Algorithmic trading (algo trading) means using a computer program to automatically buy and sell stocks based on pre-defined rules — instead of you manually clicking 'Buy' or 'Sell'.",
        tip: "Think of it like setting a recipe: 'If the stock price goes above ₹500 AND volume is 2× normal, then BUY 10 shares.'",
      },
      {
        heading: "Why do people use it?",
        body: "Humans get emotional — we panic-sell when prices fall, or hold too long hoping for recovery. An algo has no emotions. It follows rules exactly, every single time, even at 3 AM.",
      },
      {
        heading: "Is it only for big banks?",
        body: "Not anymore! With tools like yfinance (which this app uses), even retail traders in India can backtest and run strategies on NSE stocks from their laptop.",
        tip: "This app lets you backtest 5 years of NSE data — the same data professional traders use.",
      },
    ],
    quiz: [
      {
        q: "What is the main advantage of algo trading over manual trading?",
        options: [
          "It always makes profit",
          "It removes emotional decision-making",
          "It works only during market hours",
          "It requires a broker licence",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: 2,
    title: "Key Terms You Must Know",
    emoji: "📖",
    duration: "4 min",
    content: [
      {
        heading: "Entry & Exit",
        body: "'Entry' is when your algo buys a stock. 'Exit' is when it sells. Every strategy needs clear rules for BOTH — otherwise you might buy but never know when to sell.",
        tip: "A common beginner mistake: spending all time on entry signals and ignoring exit rules.",
      },
      {
        heading: "Stop Loss",
        body: "A stop loss is a automatic exit if the trade goes against you. Example: 'If stock falls 3% from my buy price, sell immediately.' It limits your maximum loss on any single trade.",
      },
      {
        heading: "Backtesting",
        body: "Before running any strategy with real money, you test it on historical data to see how it WOULD have performed. This app backtests on 5 years of NSE data.",
        tip: "Backtesting doesn't guarantee future results — but it tells you if your idea has ever worked.",
      },
      {
        heading: "Sharpe Ratio",
        body: "A measure of risk-adjusted return. A Sharpe above 1.0 is good. Above 2.0 is excellent. It answers: 'Am I being paid enough for the risk I'm taking?'",
      },
    ],
    quiz: [
      {
        q: "What does a stop loss do?",
        options: [
          "Guarantees profit",
          "Automatically buys more shares",
          "Limits your loss on a trade",
          "Stops the algorithm from running",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: 3,
    title: "Momentum Strategies",
    emoji: "🚀",
    duration: "5 min",
    content: [
      {
        heading: "The core idea",
        body: "Momentum strategies bet that stocks moving up will continue moving up (and falling stocks will keep falling). The simple logic: 'The trend is your friend.'",
      },
      {
        heading: "52-Week Breakout",
        body: "When a stock hits a NEW 52-week high with unusually high volume, it often signals strong institutional buying. The algo buys the breakout and holds for ~20 days.",
        tip: "Volume confirmation is key — a price breakout without volume is often a 'false breakout' that reverses quickly.",
      },
      {
        heading: "EMA Crossover (9/21)",
        body: "EMA = Exponential Moving Average. When the fast 9-day EMA crosses ABOVE the slow 21-day EMA, it signals upward momentum. When it crosses below, it signals a reversal.",
      },
      {
        heading: "RSI Momentum",
        body: "RSI (Relative Strength Index) measures how overbought or oversold a stock is (0–100). Buying when RSI crosses above 60 (from below) catches stocks gaining fresh momentum.",
      },
    ],
    quiz: [
      {
        q: "In EMA crossover strategy, what triggers a BUY signal?",
        options: [
          "9-day EMA crosses below 21-day EMA",
          "9-day EMA crosses above 21-day EMA",
          "RSI goes below 30",
          "Stock hits a 52-week low",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: 4,
    title: "Mean Reversion Strategies",
    emoji: "↩️",
    duration: "4 min",
    content: [
      {
        heading: "The opposite of momentum",
        body: "Mean reversion bets that when a stock moves too far from its average price, it will 'snap back.' Like a rubber band — the further you stretch it, the harder it snaps back.",
      },
      {
        heading: "Bollinger Bands",
        body: "Bollinger Bands draw lines 2 standard deviations above and below a 20-day average price. When price touches the LOWER band, it's statistically oversold. The algo buys, targeting the middle band.",
        tip: "Works best in sideways markets. In strong trending markets, price can 'walk the band' and the strategy fails.",
      },
      {
        heading: "Z-Score Reversion",
        body: "Z-score measures how many standard deviations a stock's return is from its recent average. A z-score below −2.0 means the stock has dropped unusually far — a buy signal expecting recovery.",
      },
    ],
    quiz: [
      {
        q: "Mean reversion strategies work best when markets are:",
        options: [
          "In a strong uptrend",
          "Crashing rapidly",
          "Moving sideways (range-bound)",
          "Opening for the first time",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: 5,
    title: "Reading Backtest Results",
    emoji: "📊",
    duration: "5 min",
    content: [
      {
        heading: "Don't just look at total return",
        body: "A strategy that made +200% but had a −60% drawdown (your portfolio halved at one point) is very hard to actually follow in real life. You'd have panic-sold long before recovery.",
        tip: "Ask yourself: 'Could I have emotionally stayed in this strategy during its worst period?'",
      },
      {
        heading: "Win rate vs Profit factor",
        body: "Win rate is how often trades are profitable. But a 40% win rate can still be very profitable if average wins are 3× bigger than average losses. Profit Factor = Total Wins ÷ Total Losses. Above 1.5 is solid.",
      },
      {
        heading: "Beating Buy & Hold",
        body: "The simplest benchmark: would you have done better just buying RELIANCE (or Nifty) and holding? If your algo doesn't consistently beat this, it's not worth the complexity.",
      },
      {
        heading: "Overfitting danger",
        body: "If you tweak a strategy's parameters until it looks perfect on historical data, it probably won't work in the future. This is called 'overfitting' — the strategy learned the past noise, not real patterns.",
      },
    ],
    quiz: [
      {
        q: "A strategy has 35% win rate but profit factor of 2.1. It is:",
        options: [
          "Definitely a losing strategy",
          "Potentially profitable — big wins, small losses",
          "Only useful for options trading",
          "Too risky to ever use",
        ],
        answer: 1,
      },
    ],
  },
];

// ── Strategy cards ─────────────────────────────────────────────────────────────

const STRATEGY_CARDS = [
  {
    name: "52-Week Breakout",
    type: "Momentum",
    typeColor: "#4ade80",
    difficulty: "Beginner",
    diffColor: "#14532d",
    idea: "Buy stocks hitting all-time highs with strong volume.",
    entry: "Close > 52-week high AND volume > 2× average",
    exit: "After 20 days OR if price falls 3%",
    bestIn: "Bull markets, trending stocks",
    avoidIn: "Sideways, choppy markets",
    keyMetric: "Volume surge (2×+)",
    risk: "False breakouts without volume",
  },
  {
    name: "EMA Crossover",
    type: "Momentum",
    typeColor: "#4ade80",
    difficulty: "Beginner",
    diffColor: "#14532d",
    idea: "Follow short-term trend using two moving averages.",
    entry: "9-EMA crosses above 21-EMA (above 50-EMA)",
    exit: "9-EMA crosses back below 21-EMA",
    bestIn: "Trending markets",
    avoidIn: "Whipsaw / choppy price action",
    keyMetric: "EMA spacing width",
    risk: "Lag — signals come after the move starts",
  },
  {
    name: "RSI Momentum",
    type: "Momentum",
    typeColor: "#4ade80",
    difficulty: "Beginner",
    diffColor: "#14532d",
    idea: "Enter when stock gains fresh upward strength.",
    entry: "RSI(14) crosses above 60 from below",
    exit: "RSI drops below 50",
    bestIn: "Midcap stocks, post-consolidation breakouts",
    avoidIn: "Overbought trending markets",
    keyMetric: "RSI 14-period",
    risk: "RSI can stay overbought in strong trends",
  },
  {
    name: "Bollinger Bands",
    type: "Mean Reversion",
    typeColor: "#60a5fa",
    difficulty: "Intermediate",
    diffColor: "#1e3a5f",
    idea: "Buy oversold dips, sell at average price.",
    entry: "Price touches or breaks below lower band (−2σ)",
    exit: "Price returns to middle band (20-day average)",
    bestIn: "Range-bound, sideways markets",
    avoidIn: "Strong trending markets",
    keyMetric: "Band width (volatility)",
    risk: "Price can 'walk the band' in downtrends",
  },
  {
    name: "Z-Score Reversion",
    type: "Mean Reversion",
    typeColor: "#60a5fa",
    difficulty: "Intermediate",
    diffColor: "#1e3a5f",
    idea: "Buy statistically oversold stocks expecting snap-back.",
    entry: "20-day return z-score < −2.0",
    exit: "Z-score recovers above −0.5",
    bestIn: "Quality large-cap stocks",
    avoidIn: "Fundamentally broken companies",
    keyMetric: "Z-score magnitude",
    risk: "Catching 'falling knives' — some stocks deserve to fall",
  },
];

// ── AI Tutor chatbot ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DalalStreet AI Tutor — a friendly, patient teacher helping complete beginners understand algorithmic trading in the Indian stock market (NSE/BSE).

Your rules:
- Explain everything simply, like talking to someone who has never traded before
- Use Indian market examples (RELIANCE, TCS, NIFTY 50, NSE, BSE, ₹ rupees)
- Keep answers short and clear — maximum 4-5 sentences unless a longer explanation is truly needed
- Use simple analogies (cricket, chai, everyday life) to explain complex concepts
- Never use jargon without immediately explaining it
- Be encouraging and positive — beginners need confidence
- When relevant, mention how concepts apply to the strategies in this app (52-week breakout, EMA crossover, RSI, Bollinger Bands, Z-score)
- Do NOT give financial advice or tell people to buy specific stocks`;

async function askTutor(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API error");
  return data.content?.[0]?.text || "Sorry, I could not generate a response.";
}

// ── Main component ─────────────────────────────────────────────────────────────

type Section = "lessons" | "chat" | "cards";

export default function Learn() {
  const [section,      setSection]      = useState<Section>("lessons");
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [lessonStep,   setLessonStep]   = useState(0); // 0..content, last = quiz
  const [quizAnswer,   setQuizAnswer]   = useState<number | null>(null);
  const [completed,    setCompleted]    = useState<Set<number>>(new Set());
  const [activeCard,   setActiveCard]   = useState(0);

  // Chat state
  const [chatMsgs,  setChatMsgs]  = useState<ChatMsg[]>([{
    role: "assistant",
    text: "Namaste! 🙏 I'm your Algo Trading Tutor.\n\nAsk me anything — 'What is a stop loss?', 'How does RSI work?', 'What strategy should a beginner start with?' — I'll explain it simply!",
  }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  async function sendChat(text?: string) {
    const msg = (text || chatInput).trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: "user", text: msg }];
    setChatMsgs(newMsgs);
    setChatLoading(true);
    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.text }));
      const reply = await askTutor(apiMsgs);
      setChatMsgs(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMsgs(prev => [...prev, { role: "assistant", text: "⚠️ Connection error. Please try again." }]);
    }
    setChatLoading(false);
  }

  function startLesson(lesson: Lesson) {
    setActiveLesson(lesson);
    setLessonStep(0);
    setQuizAnswer(null);
  }

  function nextStep() {
    if (!activeLesson) return;
    if (lessonStep < activeLesson.content.length) {
      setLessonStep(s => s + 1);
      setQuizAnswer(null);
    }
  }

  function finishLesson() {
    if (activeLesson) {
      setCompleted(prev => new Set([...prev, activeLesson.id]));
    }
    setActiveLesson(null);
    setLessonStep(0);
  }

  const isQuizStep = activeLesson && lessonStep === activeLesson.content.length;

  // Styles
  const card: React.CSSProperties = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-surface-border)",
    borderRadius: 8, padding: "10px 12px",
  };

  const tabBtn = (s: Section): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 6, fontSize: 11,
    fontWeight: 600, cursor: "pointer", border: "none",
    fontFamily: "monospace",
    background: section === s ? "var(--color-surface-elevated)" : "transparent",
    color: section === s ? "#fff" : "#6b7280",
    borderBottom: section === s ? "2px solid #4ade80" : "2px solid transparent",
  });

  return (
    <div style={{
      background: "var(--color-surface-card)",
      border: "1px solid var(--color-surface-border)",
      borderRadius: 16, overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--color-surface-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h3 style={{
          margin: 0, fontSize: 12, fontWeight: 600,
          color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          🎓 Algo trading — learn & train
        </h3>
        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
          {completed.size}/{LESSONS.length} lessons done
        </span>
      </div>

      {/* Section tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "8px 14px",
        borderBottom: "1px solid var(--color-surface-border)",
      }}>
        <button style={tabBtn("lessons")} onClick={() => { setSection("lessons"); setActiveLesson(null); }}>
          📚 Lessons
        </button>
        <button style={tabBtn("chat")} onClick={() => setSection("chat")}>
          🤖 AI Tutor
        </button>
        <button style={tabBtn("cards")} onClick={() => setSection("cards")}>
          🃏 Strategy cards
        </button>
      </div>

      <div style={{ padding: "12px 14px" }}>

        {/* ── LESSONS ── */}
        {section === "lessons" && !activeLesson && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Start from Lesson 1 — each takes 3–5 minutes with a quiz at the end.
            </div>
            {LESSONS.map((lesson, i) => {
              const done    = completed.has(lesson.id);
              const locked  = i > 0 && !completed.has(LESSONS[i - 1].id);
              return (
                <div
                  key={lesson.id}
                  onClick={() => !locked && startLesson(lesson)}
                  style={{
                    ...card,
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.4 : 1,
                    display: "flex", alignItems: "center", gap: 12,
                    borderColor: done ? "#166534" : "var(--color-surface-border)",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    background: done ? "#14532d" : "var(--color-surface-card)",
                    border: `1px solid ${done ? "#166534" : "var(--color-surface-border)"}`,
                  }}>
                    {done ? "✅" : lesson.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                      {lesson.id}. {lesson.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {lesson.content.length} sections · {lesson.duration} · 1 quiz
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                    background: done ? "#14532d" : locked ? "#1c1917" : "#1e3a5f",
                    color: done ? "#86efac" : locked ? "#78716c" : "#93c5fd",
                  }}>
                    {done ? "Done" : locked ? "Locked" : "Start →"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ACTIVE LESSON ── */}
        {section === "lessons" && activeLesson && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Progress bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>
                  {activeLesson.emoji} {activeLesson.title}
                </span>
                <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                  {isQuizStep ? "Quiz" : `${lessonStep + 1} / ${activeLesson.content.length}`}
                </span>
              </div>
              <div style={{ height: 4, background: "var(--color-surface-elevated)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "#4ade80",
                  width: `${((lessonStep + (isQuizStep ? 1 : 0)) / (activeLesson.content.length + 1)) * 100}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>

            {/* Content step */}
            {!isQuizStep && (
              <div style={card}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "#e5e7eb", marginBottom: 8,
                }}>
                  {activeLesson.content[lessonStep].heading}
                </div>
                <div style={{
                  fontSize: 13, color: "#9ca3af", lineHeight: 1.7,
                }}>
                  {activeLesson.content[lessonStep].body}
                </div>
                {activeLesson.content[lessonStep].tip && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 6,
                    background: "#14532d20", border: "1px solid #166534",
                    fontSize: 12, color: "#86efac", lineHeight: 1.6,
                  }}>
                    💡 {activeLesson.content[lessonStep].tip}
                  </div>
                )}
              </div>
            )}

            {/* Quiz step */}
            {isQuizStep && (
              <div style={card}>
                <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginBottom: 8 }}>
                  🧠 Quick check
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 12, lineHeight: 1.5 }}>
                  {activeLesson.quiz[0].q}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activeLesson.quiz[0].options.map((opt, i) => {
                    const isCorrect = i === activeLesson.quiz[0].answer;
                    const isSelected = quizAnswer === i;
                    let bg = "var(--color-surface-card)";
                    let border = "var(--color-surface-border)";
                    let color = "#9ca3af";
                    if (quizAnswer !== null) {
                      if (isCorrect)  { bg = "#14532d20"; border = "#166534"; color = "#86efac"; }
                      if (isSelected && !isCorrect) { bg = "#7f1d1d20"; border = "#7f1d1d"; color = "#fca5a5"; }
                    }
                    return (
                      <div
                        key={i}
                        onClick={() => quizAnswer === null && setQuizAnswer(i)}
                        style={{
                          padding: "8px 12px", borderRadius: 6, cursor: quizAnswer === null ? "pointer" : "default",
                          background: bg, border: `1px solid ${border}`,
                          fontSize: 12, color, transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700,
                          background: isSelected || (quizAnswer !== null && isCorrect) ? border : "var(--color-surface-elevated)",
                          color: isSelected || (quizAnswer !== null && isCorrect) ? "#fff" : "#6b7280",
                        }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                        {quizAnswer !== null && isCorrect && <span style={{ marginLeft: "auto" }}>✅</span>}
                        {quizAnswer !== null && isSelected && !isCorrect && <span style={{ marginLeft: "auto" }}>❌</span>}
                      </div>
                    );
                  })}
                </div>
                {quizAnswer !== null && (
                  <div style={{
                    marginTop: 8, fontSize: 12, padding: "6px 10px", borderRadius: 6,
                    background: quizAnswer === activeLesson.quiz[0].answer ? "#14532d20" : "#7f1d1d20",
                    color: quizAnswer === activeLesson.quiz[0].answer ? "#86efac" : "#fca5a5",
                    border: `1px solid ${quizAnswer === activeLesson.quiz[0].answer ? "#166534" : "#7f1d1d"}`,
                  }}>
                    {quizAnswer === activeLesson.quiz[0].answer
                      ? "🎉 Correct! Great understanding."
                      : `Not quite. The correct answer is: ${activeLesson.quiz[0].options[activeLesson.quiz[0].answer]}`}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button
                onClick={() => { setActiveLesson(null); setLessonStep(0); }}
                style={{
                  padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, background: "var(--color-surface-elevated)",
                  color: "#9ca3af", fontFamily: "monospace",
                }}
              >
                ← Back
              </button>
              {!isQuizStep ? (
                <button onClick={nextStep} style={{
                  padding: "7px 18px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, background: "#166534",
                  color: "#86efac", fontFamily: "monospace",
                }}>
                  {lessonStep < activeLesson.content.length - 1 ? "Next →" : "Take quiz →"}
                </button>
              ) : (
                <button
                  onClick={finishLesson}
                  disabled={quizAnswer === null}
                  style={{
                    padding: "7px 18px", borderRadius: 6, border: "none",
                    cursor: quizAnswer === null ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 700,
                    background: quizAnswer === null ? "#1c1917" : "#7c3aed",
                    color: quizAnswer === null ? "#4b5563" : "#fff",
                    fontFamily: "monospace",
                  }}
                >
                  Complete lesson ✓
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── AI TUTOR CHAT ── */}
        {section === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: 420 }}>

            {/* Quick questions */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
              {[
                "What is algo trading?",
                "How does RSI work?",
                "What is a stop loss?",
                "Which strategy for beginners?",
                "What is Sharpe ratio?",
              ].map(q => (
                <button key={q} onClick={() => sendChat(q)} style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 20,
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-surface-border)",
                  color: "#9ca3af", cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", display: "flex",
              flexDirection: "column", gap: 8, paddingRight: 4,
            }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{
                  display: "flex",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                  gap: 8, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13,
                    background: m.role === "user" ? "var(--color-accent)" : "#4c1d95",
                  }}>
                    {m.role === "user" ? "👤" : "🎓"}
                  </div>
                  <div style={{
                    maxWidth: "85%", padding: "8px 12px",
                    borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                    background: m.role === "user" ? "var(--color-accent)" : "var(--color-surface-elevated)",
                    border: m.role === "assistant" ? "1px solid var(--color-surface-border)" : "none",
                    fontSize: 12, color: "#f3f4f6", lineHeight: 1.6,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "#4c1d95", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 13,
                  }}>🎓</div>
                  <div style={{
                    padding: "8px 12px", borderRadius: "4px 14px 14px 14px",
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-surface-border)",
                    display: "flex", gap: 4, alignItems: "center",
                  }}>
                    {[0,1,2].map(d => (
                      <span key={d} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: "#8b5cf6", display: "inline-block",
                        animation: `lrnPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div style={{
              marginTop: 8, display: "flex", gap: 6, alignItems: "flex-end",
            }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Ask anything about algo trading… (Enter to send)"
                rows={1}
                style={{
                  flex: 1, padding: "7px 10px", fontSize: 12,
                  fontFamily: "monospace", resize: "none",
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-surface-border)",
                  borderRadius: 8, color: "#fff", outline: "none",
                  lineHeight: 1.5, maxHeight: 72, overflowY: "auto",
                }}
              />
              <button
                onClick={() => sendChat()}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "none",
                  cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                  fontSize: 15, fontWeight: 700,
                  background: chatLoading || !chatInput.trim() ? "#2a2e3a" : "#7c3aed",
                  color: chatLoading || !chatInput.trim() ? "#4b5563" : "#fff",
                  flexShrink: 0,
                }}
              >↑</button>
            </div>
          </div>
        )}

        {/* ── STRATEGY CARDS ── */}
        {section === "cards" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Card selector */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {STRATEGY_CARDS.map((c, i) => (
                <button key={i} onClick={() => setActiveCard(i)} style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 20,
                  border: `1px solid ${activeCard === i ? c.typeColor : "var(--color-surface-border)"}`,
                  background: activeCard === i ? `${c.typeColor}20` : "transparent",
                  color: activeCard === i ? c.typeColor : "#6b7280",
                  cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600,
                }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Active card */}
            {(() => {
              const c = STRATEGY_CARDS[activeCard];
              return (
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.idea}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                        background: `${c.typeColor}20`, color: c.typeColor }}>{c.type}</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                        background: c.diffColor, color: "#d1fae5" }}>{c.difficulty}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "🟢 Entry signal",  value: c.entry },
                      { label: "🔴 Exit signal",   value: c.exit },
                      { label: "✅ Best in",       value: c.bestIn },
                      { label: "⚠️ Avoid when",   value: c.avoidIn },
                      { label: "📏 Key metric",    value: c.keyMetric },
                      { label: "🎯 Main risk",     value: c.risk },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        background: "var(--color-surface-card)",
                        border: "1px solid var(--color-surface-border)",
                        borderRadius: 6, padding: "8px 10px",
                      }}>
                        <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase",
                          letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    marginTop: 10, padding: "8px 10px", borderRadius: 6,
                    background: "#1e3a5f20", border: "1px solid #1e3a5f",
                    fontSize: 11, color: "#93c5fd",
                  }}>
                    💡 Try this in the <strong>🔬 Backtest</strong> tab — run it on RELIANCE or TCS over 5 years to see real historical performance.
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <style>{`
        @keyframes lrnPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}
