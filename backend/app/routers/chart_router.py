"""
app/routers/chart.py
OHLC history endpoint for stock charts.
"""
import yfinance as yf
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

def _ticker_sym(symbol: str) -> str:
    if symbol in NSE_OVERRIDES:
        return NSE_OVERRIDES[symbol]
    return f"{symbol}.NS"

@router.get("/ohlc/{symbol}")
def get_ohlc(
    symbol: str,
    period: str = Query("3y", description="1d|1w|1mo|3mo|1y|3y"),
):
    symbol = symbol.upper().strip()
    if period not in PERIOD_MAP:
        period = "3y"

    yf_period, interval = PERIOD_MAP[period]
    candidates = [_ticker_sym(symbol)]
    if symbol in BSE_FALLBACKS:
        candidates.append(BSE_FALLBACKS[symbol])

    df = None
    for t in candidates:
        try:
            raw = yf.download(
                t, period=yf_period, interval=interval,
                auto_adjust=True, progress=False
            )
            if not raw.empty:
                df = raw
                break
        except Exception:
            continue

    if df is None or df.empty:
        raise HTTPException(404, f"No chart data for {symbol}")

    # Flatten MultiIndex if present
    if hasattr(df.columns, "get_level_values"):
        df.columns = df.columns.get_level_values(0)

    candles = []
    for ts, row in df.iterrows():
        try:
            candles.append({
                "date":   str(ts)[:16],   # "2024-01-15 09:15"
                "open":   round(float(row["Open"]),  2),
                "high":   round(float(row["High"]),  2),
                "low":    round(float(row["Low"]),   2),
                "close":  round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })
        except Exception:
            continue

    return {
        "symbol":   symbol,
        "period":   period,
        "interval": interval,
        "count":    len(candles),
        "candles":  candles,
    }
