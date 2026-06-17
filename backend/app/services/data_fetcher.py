import yfinance as yf
import random, math, time
from datetime import datetime, timezone, timedelta

_cache: dict = {}
_last_gbm: dict = {}

CACHE_TTL_OPEN   = 4    # seconds
CACHE_TTL_CLOSED = 300  # 5 min cache when market shut

IST = timezone(timedelta(hours=5, minutes=30))


def _is_market_open() -> bool:
    now  = datetime.now(IST)
    mins = now.hour * 60 + now.minute
    return now.weekday() < 5 and (9 * 60 + 15) <= mins < (15 * 60 + 30)


def _history(ticker_sym: str, period: str = "5d") -> "pd.DataFrame":
    """Download history with auto_adjust=True (correct post-split prices)."""
    import yfinance as yf
    hist = yf.download(ticker_sym, period=period,
                       auto_adjust=True, progress=False)
    if hasattr(hist.columns, "get_level_values"):
        hist.columns = hist.columns.get_level_values(0)
    return hist


def _get_price_and_prev(ticker_sym: str) -> tuple[float, float]:
    """
    Returns (price, previous_close) using auto_adjust=True.
    This fixes wrong prices for ITC, WIPRO, INFY etc. after splits/bonuses.
    """
    ticker = yf.Ticker(ticker_sym)
    hist   = _history(ticker_sym, "5d")

    if hist.empty:
        raise ValueError(f"No history for {ticker_sym}")

    last_close = round(float(hist["Close"].iloc[-1]), 2)
    prev_close = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else last_close, 2)

    if _is_market_open():
        try:
            fi    = ticker.fast_info
            price = round(float(fi.last_price), 2)
            # Sanity check — reject if > 50% off from last close
            if price < 0.5 or abs(price - last_close) / max(last_close, 1) > 0.5:
                price = last_close
        except Exception:
            price = last_close
    else:
        price = last_close

    return price, prev_close


def _get_index_price(ticker_sym: str) -> tuple[float, float]:
    """
    Fetch index (^NSEI, ^BSESN, ^NSEBANK).
    Tries fast_info first; falls back to 1mo history — always returns data.
    """
    ticker = yf.Ticker(ticker_sym)

    # Try fast_info (works during market hours)
    try:
        fi    = ticker.fast_info
        price = float(fi.last_price)
        prev  = float(fi.previous_close)
        if price > 100 and prev > 100:
            return round(price, 2), round(prev, 2)
    except Exception:
        pass

    # Fallback: 1mo daily history always has data
    hist = _history(ticker_sym, "1mo")
    if hist.empty:
        raise ValueError(f"No index data for {ticker_sym}")

    price = round(float(hist["Close"].iloc[-1]), 2)
    prev  = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price, 2)
    return price, prev


def _gbm(symbol: str, exchange: str) -> dict:
    base  = _last_gbm.get(symbol, random.uniform(500, 3000))
    shock = math.exp(
        (0.0001 - 0.5 * 0.02**2) / 252 +
        0.02 * math.sqrt(1 / 252) * random.gauss(0, 1)
    )
    price = round(base * shock, 2)
    _last_gbm[symbol] = price
    chg   = round(price - base, 2)
    return {
        "symbol": symbol, "exchange": exchange,
        "price":  price,  "open":  round(base * 0.998, 2),
        "high":   round(price * 1.005, 2),
        "low":    round(price * 0.995, 2),
        "volume": random.randint(100_000, 5_000_000),
        "change": chg,
        "changePct": round((chg / base) * 100, 2) if base else 0,
        "timestamp": datetime.now().isoformat(),
    }


# ── Ticker map ────────────────────────────────────────────────────────────────
NSE_OVERRIDES = {
    "TATAMOTORS": "500570.BO",
    "BHARTIARTL": "BHARTIARTL.NS",
    "KOTAKBANK":  "KOTAKBANK.NS",
    "HDFCBANK":   "HDFCBANK.NS",
    "WIPRO":      "WIPRO.NS",
    "SBIN":       "SBIN.NS",
    "ITC":        "ITC.NS",
    "INFY":       "INFY.NS",
    "TCS":        "TCS.NS",
    "RELIANCE":   "RELIANCE.NS",
    "LTIM":       "LTIM.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "BAJAJHFL":   "BAJAJHFL.NS",
    "HCLTECH":    "HCLTECH.NS",
    "ADANIENT":   "ADANIENT.NS",
    "AXISBANK":   "AXISBANK.NS",
    "ICICIBANK":  "ICICIBANK.NS",
    "HINDUNILVR": "HINDUNILVR.NS",
    "MARUTI":     "MARUTI.NS",
    "SUNPHARMA":  "SUNPHARMA.NS",
    "TITAN":      "TITAN.NS",
    "NESTLEIND":  "NESTLEIND.NS",
    "ONGC":       "ONGC.NS",
    "POWERGRID":  "POWERGRID.NS",
    "TECHM":      "TECHM.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS",
    "JSWSTEEL":   "JSWSTEEL.NS",
    "TATASTEEL":  "TATASTEEL.NS",
    "COALINDIA":  "COALINDIA.NS",
}

BSE_FALLBACKS = {
    "TATAMOTORS": "500570.BO",
    "LTIM":       "540005.BO",
    "ADANIENT":   "512599.BO",
    "BAJAJHFL":   "508246.BO",
}


def _resolve_ticker(symbol: str, exchange: str) -> list[str]:
    primary = NSE_OVERRIDES.get(symbol, f"{symbol}{'.NS' if exchange == 'NSE' else '.BO'}")
    candidates = [primary]
    if symbol in BSE_FALLBACKS and not primary.endswith(".BO"):
        candidates.append(BSE_FALLBACKS[symbol])
    if primary.endswith(".NS"):
        candidates.append(primary.replace(".NS", ".BO"))
    elif primary.endswith(".BO"):
        candidates.append(primary.replace(".BO", ".NS"))
    return candidates


# ── Public API ────────────────────────────────────────────────────────────────

def get_live_price(symbol: str, exchange: str = "NSE") -> dict:
    ttl    = CACHE_TTL_OPEN if _is_market_open() else CACHE_TTL_CLOSED
    cached = _cache.get(symbol)
    if cached and (time.time() - cached["_ts"]) < ttl:
        return {k: v for k, v in cached.items() if k != "_ts"}

    candidates = _resolve_ticker(symbol, exchange)
    last_err   = None

    for ticker_sym in candidates:
        try:
            price, prev = _get_price_and_prev(ticker_sym)
            if price < 0.5 or price > 1_000_000:
                raise ValueError(f"Suspicious price {price}")

            # Today's OHLV from intraday history
            hist1 = _history(ticker_sym, "1d")
            if not hist1.empty:
                row   = hist1.iloc[-1]
                open_ = round(float(row["Open"]),  2)
                high  = round(float(row["High"]),  2)
                low   = round(float(row["Low"]),   2)
                vol   = int(float(row["Volume"])) if str(row["Volume"]) != "nan" else 0
            else:
                open_ = prev
                high  = round(price * 1.005, 2)
                low   = round(price * 0.995, 2)
                vol   = 0

            chg     = round(price - prev, 2)
            chg_pct = round((chg / prev) * 100, 2) if prev else 0

            result = {
                "symbol": symbol, "exchange": exchange,
                "price":  price,  "open": open_,
                "high":   high,   "low":  low,
                "volume": vol,    "change": chg,
                "changePct": chg_pct,
                "timestamp": datetime.now().isoformat(),
            }
            _cache[symbol] = {**result, "_ts": time.time()}
            return result

        except Exception as e:
            last_err = e
            print(f"[price] {ticker_sym}: {e} — trying next")
            continue

    print(f"[price] All failed for {symbol}: {last_err} — GBM fallback")
    return _gbm(symbol, exchange)


def get_index(symbol: str) -> dict:
    ttl    = CACHE_TTL_OPEN if _is_market_open() else CACHE_TTL_CLOSED
    cached = _cache.get(f"_idx_{symbol}")
    if cached and (time.time() - cached["_ts"]) < ttl:
        return {k: v for k, v in cached.items() if k != "_ts"}

    try:
        price, prev = _get_index_price(symbol)
        chg = round(price - prev, 2)
        result = {
            "symbol":    symbol,
            "price":     price,
            "change":    chg,
            "changePct": round((chg / prev) * 100, 2) if prev else 0,
            "timestamp": datetime.now().isoformat(),
        }
        _cache[f"_idx_{symbol}"] = {**result, "_ts": time.time()}
        return result

    except Exception as e:
        print(f"[index] {symbol}: {e}")
        # Return last known value instead of zeros
        if f"_idx_{symbol}" in _cache:
            return {k: v for k, v in _cache[f"_idx_{symbol}"].items() if k != "_ts"}
        return {"symbol": symbol, "price": 0, "change": 0, "changePct": 0,
                "timestamp": datetime.now().isoformat()}
