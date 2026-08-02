import os
import time
import requests
from groq import Groq
from app.services.trade_engine import get_holdings, get_cash, get_orders
from app.services.data_fetcher import get_live_price

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

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


def _log_to_central_tracker(feature_name, prompt_tokens, completion_tokens,
                             latency_ms, success, error_message=None):
    """
    Reports this Groq call to the shared cross-app usage dashboard (a
    separate Convex project, llm-usage-tracker). Best-effort only — if the
    tracker is unreachable, misconfigured, or rejects the request, we print
    a warning and move on rather than let it break an actual chat response.
    """
    url = os.getenv("USAGE_TRACKER_URL", "")
    secret = os.getenv("USAGE_LOG_SECRET", "")

    if not url or not secret:
        return

    try:
        resp = requests.post(
            f"{url}/logUsage",
            headers={
                "Content-Type": "application/json",
                "x-usage-secret": secret,
            },
            json={
                "appName": "dalal-street-ai",
                "feature": feature_name,
                "model": MODEL,
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "totalTokens": prompt_tokens + completion_tokens,
                "latencyMs": latency_ms,
                "success": success,
                "errorMessage": error_message,
            },
            timeout=5,
        )
        if resp.status_code != 200:
            print(f"⚠️  Usage tracker returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"⚠️  Failed to log to central usage tracker: {e}")


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


def chat(message: str, history: list = [], feature: str = "chat") -> str:
    """Send message to Groq with injected live prices.

    `feature` distinguishes regular chat from analyse_stock() calls (which
    route through this same function) for the usage dashboard — pass an
    explicit value from callers that aren't plain user chat.
    """
    live_context = _build_live_context()
    system       = SYSTEM_PROMPT + live_context

    messages = [
        {"role": "system",  "content": system},
        *history[-8:],
        {"role": "user",    "content": message},
    ]

    start_time = time.time()

    try:
        resp = client.chat.completions.create(
            model       = MODEL,
            messages    = messages,
            max_tokens  = 512,
            temperature = 0.3,   # lower = more factual, less hallucination
        )
        latency_ms = int((time.time() - start_time) * 1000)

        usage = getattr(resp, "usage", None)
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0

        _log_to_central_tracker(
            feature, prompt_tokens, completion_tokens, latency_ms, success=True,
        )

        return resp.choices[0].message.content
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        _log_to_central_tracker(
            feature, 0, 0, latency_ms, success=False, error_message=str(e),
        )
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
        return chat(prompt, feature="analyseStock")
    except Exception as e:
        return f"Could not analyse {symbol}: {e}"
