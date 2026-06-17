import os
from groq import Groq
from app.services.trade_engine import get_holdings, get_cash, get_orders
from app.services.data_fetcher import get_live_price

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are DalalStreet AI — an expert Indian stock market assistant
built for NSE and BSE traders.

CRITICAL RULE: You MUST use ONLY the live price data provided in the system context.
NEVER quote prices from your training data. If a user asks about a stock price,
use ONLY the price shown in the "LIVE MARKET DATA" section below.

You help users:
- Analyse NSE/BSE stocks using the live prices provided
- Review their virtual portfolio and P&L
- Suggest buy/sell decisions based on live market context
- Explain market concepts in simple terms

Rules:
- Always use Indian formatting: ₹, Lakhs (L), Crores (Cr)
- Be concise — max 4-5 sentences unless asked for detail
- Always remind users this is a VIRTUAL DEMO — not real financial advice
- Reference the user's actual portfolio and LIVE prices when relevant
- NEVER use prices from memory — only use prices from the context below"""


def _build_live_context() -> str:
    """Build live market + portfolio context injected into every message."""
    lines = ["\n═══ LIVE MARKET DATA (use ONLY these prices) ═══"]

    # Live prices for all watchlist stocks
    symbols = [
        "RELIANCE","TCS","INFY","HDFCBANK","ITC",
        "SBIN","BHARTIARTL","KOTAKBANK","WIPRO","TATAMOTORS"
    ]
    for sym in symbols:
        try:
            d = get_live_price(sym)
            arrow = "▲" if d["changePct"] >= 0 else "▼"
            lines.append(
                f"  {sym}: ₹{d['price']:.2f} {arrow}{abs(d['changePct']):.2f}% "
                f"| H:₹{d['high']:.2f} L:₹{d['low']:.2f}"
            )
        except Exception:
            pass

    # Portfolio snapshot
    lines.append("\n═══ USER PORTFOLIO (virtual) ═══")
    try:
        holdings = get_holdings()
        cash     = get_cash()
        lines.append(f"  Cash: ₹{cash:,.2f}")

        if not holdings:
            lines.append("  Holdings: None")
        else:
            total_invested = 0
            total_current  = 0
            for h in holdings:
                try:
                    live     = get_live_price(h["symbol"])
                    ltp      = live["price"]
                    invested = h["qty"] * h["avg_price"]
                    current  = h["qty"] * ltp
                    pnl      = current - invested
                    pnl_pct  = (pnl / invested * 100) if invested else 0
                    total_invested += invested
                    total_current  += current
                    lines.append(
                        f"  {h['symbol']}: {h['qty']} shares | "
                        f"Avg ₹{h['avg_price']:.2f} | LTP ₹{ltp:.2f} | "
                        f"P&L ₹{pnl:+.2f} ({pnl_pct:+.2f}%)"
                    )
                except Exception:
                    lines.append(f"  {h['symbol']}: {h['qty']} @ ₹{h['avg_price']:.2f}")

            total_pnl = total_current - total_invested
            lines.append(
                f"  Total P&L: ₹{total_pnl:+.2f} | "
                f"Portfolio: ₹{(cash + total_current):,.2f}"
            )

        orders = get_orders(limit=3)
        if orders:
            lines.append(f"  Last trade: {orders[0]['side']} "
                        f"{orders[0]['qty']} {orders[0]['symbol']} "
                        f"@ ₹{orders[0]['price']:.2f}")
    except Exception as e:
        lines.append(f"  Portfolio unavailable: {e}")

    lines.append("═══════════════════════════════════════")
    return "\n".join(lines)


def chat(message: str, history: list = []) -> str:
    """Send message to Groq with injected live prices."""
    live_context = _build_live_context()
    system       = SYSTEM_PROMPT + live_context

    messages = [
        {"role": "system",  "content": system},
        *history[-8:],
        {"role": "user",    "content": message},
    ]

    try:
        resp = client.chat.completions.create(
            model       = "llama-3.3-70b-versatile",
            messages    = messages,
            max_tokens  = 512,
            temperature = 0.3,   # lower = more factual, less hallucination
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"AI error: {str(e)}. Check your GROQ_API_KEY."


def analyse_stock(symbol: str) -> str:
    try:
        live = get_live_price(symbol)
        prompt = (
            f"Analyse {symbol} using the live price data in your context. "
            f"The current price is ₹{live['price']:.2f}, "
            f"change is {live['changePct']:+.2f}% today. "
            f"Give a 3-sentence view."
        )
        return chat(prompt)
    except Exception as e:
        return f"Could not analyse {symbol}: {e}"
