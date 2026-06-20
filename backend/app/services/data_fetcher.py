import yfinance as yf
import random, math, time
from datetime import datetime, timezone, timedelta

_cache: dict = {}
_last_gbm: dict = {}

CACHE_TTL_OPEN   = 30   # seconds — longer TTL to avoid rate limits
CACHE_TTL_CLOSED = 600  # 10 min cache when market shut

IST = timezone(timedelta(hours=5, minutes=30))


def _is_market_open() -> bool:
    now  = datetime.now(IST)
    mins = now.hour * 60 + now.minute
    return now.weekday() < 5 and (9 * 60 + 15) <= mins < (15 * 60 + 30)


def _get_price_and_prev(ticker_sym: str) -> tuple[float, float]:
    """
    Uses fast_info first (single request, no rate limit issues).
    Falls back to history only if fast_info fails.
    """
    ticker = yf.Ticker(ticker_sym)

    try:
        fi    = ticker.fast_info
        price = float(fi.last_price)
        prev  = float(fi.previous_close)

        if price and prev and price > 0.5 and price < 1_000_000:
            return round(price, 2), round(prev, 2)
    except Exception:
        pass

    # Fallback to history with rate limit handling
    for attempt in range(3):
        try:
            time.sleep(attempt * 2)  # backoff: 0s, 2s, 4s
            hist = yf.download(
                ticker_sym, period="5d",
                auto_adjust=True, progress=False
            )
            if hasattr(hist.columns, "get_level_values"):
                hist.columns = hist.columns.get_level_values(0)
            if not hist.empty:
                price = round(float(hist["Close"].iloc[-1]), 2)
                prev  = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price, 2)
                return price, prev
        except Exception as e:
            if "Too Many Requests" in str(e) or "Rate" in str(e):
                time.sleep(5 * (attempt + 1))
            continue

    raise ValueError(f"All attempts failed for {ticker_sym}")


def _get_index_price(ticker_sym: str) -> tuple[float, float]:
    ticker = yf.Ticker(ticker_sym)

    # Try fast_info first
    try:
        fi    = ticker.fast_info
        price = float(fi.last_price)
        prev  = float(fi.previous_close)
        if price > 100 and prev > 100:
            return round(price, 2), round(prev, 2)
    except Exception:
        pass

    # Fallback with backoff
    for attempt in range(3):
        try:
            time.sleep(attempt * 2)
            hist = yf.download(
                ticker_sym, period="1mo",
                auto_adjust=True, progress=False
            )
            if hasattr(hist.columns, "get_level_values"):
                hist.columns = hist.columns.get_level_values(0)
            if not hist.empty:
                price = round(float(hist["Close"].iloc[-1]), 2)
                prev  = round(float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price, 2)
                return price, prev
        except Exception as e:
            if "Too Many Requests" in str(e) or "Rate" in str(e):
                time.sleep(5 * (attempt + 1))
            continue

    raise ValueError(f"Index fetch failed for {ticker_sym}")


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


NSE_OVERRIDES = {
    "TATAMOTORS": "TATAMOTORS.NS",
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
}


def _resolve_ticker(symbol: str, exchange: str) -> list[str]:
    primary = NSE_OVERRIDES.get(
        symbol, f"{symbol}{'.NS' if exchange == 'NSE' else '.BO'}"
    )
    candidates = [primary]
    if symbol in BSE_FALLBACKS and not primary.endswith(".BO"):
        candidates.append(BSE_FALLBACKS[symbol])
    return candidates


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

            # Get today's OHLV from fast_info (single request)
            ticker = yf.Ticker(ticker_sym)
            fi     = ticker.fast_info
            try:
                open_ = round(float(fi.open or prev),     2)
                high  = round(float(fi.day_high or price), 2)
                low   = round(float(fi.day_low or price),  2)
                vol   = int(fi.three_month_average_volume or 0)
            except Exception:
                open_ = prev
                high  = round(price * 1.005, 2)
                low   = round(price * 0.995, 2)
                vol   = 0

            chg     = round(price - prev, 2)
            chg_pct = round((chg / prev) * 100, 2) if prev else 0

            result = {
                "symbol": symbol, "exchange": exchange,
                "price":  price,  "open":  open_,
                "high":   high,   "low":   low,
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
        if f"_idx_{symbol}" in _cache:
            return {k: v for k, v in _cache[f"_idx_{symbol}"].items() if k != "_ts"}
        return {"symbol": symbol, "price": 0, "change": 0, "changePct": 0,
                "timestamp": datetime.now().isoformat()}
