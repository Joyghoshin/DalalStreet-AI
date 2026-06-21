"""
app/routers/chart_router.py
OHLC history endpoint — uses ticker.history() which is less rate-limited
than yf.download() on cloud servers.
"""
import yfinance as yf
import time
from fastapi import APIRouter, HTTPException, Query
from app.services.data_fetcher import NSE_OVERRIDES, BSE_FALLBACKS

router = APIRouter(prefix="/api/chart", tags=["Chart"])

PERIOD_MAP = {
    "1d":  ("1d",  "5m"),
    "1w":  ("5d",  "15m"),
    "1mo": ("1mo", "1h"),
    "3mo": ("3mo", "1d"),
    "1y":  ("1y",  "1d"),
    "3y":  ("3y",  "1wk"),
}


def _candidates(symbol: str) -> list[str]:
    result = []
    if symbol in NSE_OVERRIDES:
        result.append(NSE_OVERRIDES[symbol])
    else:
        result.append(f"{symbol}.NS")
    if symbol in BSE_FALLBACKS:
        bse = BSE_FALLBACKS[symbol]
        if bse not in result:
            result.append(bse)
    for suffix in [".NS", ".BO"]:
        t = f"{symbol}{suffix}"
        if t not in result:
            result.append(t)
    return result


@router.get("/ohlc/{symbol}")
def get_ohlc(
    symbol: str,
    period: str = Query("3y", description="1d|1w|1mo|3mo|1y|3y"),
):
    symbol = symbol.upper().strip()
    if period not in PERIOD_MAP:
        period = "3y"

    yf_period, interval = PERIOD_MAP[period]
    candidates = _candidates(symbol)

    df = None
    for t in candidates:
        for attempt in range(3):
            try:
                time.sleep(1 + attempt)   # 1s, 2s, 3s backoff
                ticker = yf.Ticker(t)
                # Use ticker.history() — less rate-limited than yf.download()
                raw = ticker.history(
                    period=yf_period,
                    interval=interval,
                    auto_adjust=True,
                )
                if raw is not None and not raw.empty and len(raw) > 5:
                    df = raw
                    break
            except Exception as e:
                print(f"[chart] {t} attempt {attempt+1}: {e}")
                time.sleep(2 * (attempt + 1))
                continue
        if df is not None:
            break

    if df is None or df.empty:
        raise HTTPException(404, f"No chart data for {symbol} — Yahoo may be rate limiting")

    # Flatten MultiIndex columns if present
    if hasattr(df.columns, "get_level_values"):
        df.columns = df.columns.get_level_values(0)

    candles = []
    for ts, row in df.iterrows():
        try:
            o = float(row["Open"])
            h = float(row["High"])
            l = float(row["Low"])
            c = float(row["Close"])
            v = float(row["Volume"]) if str(row["Volume"]) != "nan" else 0
            # Skip NaN rows
            if o != o or h != h or l != l or c != c:
                continue
            candles.append({
                "date":   str(ts)[:16],
                "open":   round(o, 2),
                "high":   round(h, 2),
                "low":    round(l, 2),
                "close":  round(c, 2),
                "volume": int(v),
            })
        except Exception:
            continue

    if not candles:
        raise HTTPException(404, f"No valid candles for {symbol}")

    return {
        "symbol":   symbol,
        "period":   period,
        "interval": interval,
        "count":    len(candles),
        "candles":  candles,
    }
