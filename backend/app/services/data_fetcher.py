import yfinance as yf
import random, math, time
from datetime import datetime, timezone, timedelta

_cache: dict = {}
_last_gbm: dict = {}

# Longer TTL to minimize Yahoo API calls on cloud
CACHE_TTL_OPEN   = 60   # 1 min
CACHE_TTL_CLOSED = 900  # 15 min

IST = timezone(timedelta(hours=5, minutes=30))


def _is_market_open() -> bool:
    now  = datetime.now(IST)
    mins = now.hour * 60 + now.minute
    return now.weekday() < 5 and (9 * 60 + 15) <= mins < (15 * 60 + 30)


def _fetch_fast_info(ticker_sym: str) -> tuple[float, float, float, float, float, int]:
    """
    Uses ONLY fast_info — single HTTP request, avoids rate limits.
    Returns (price, prev_close, open, high, low, volume)
    Never calls yf.download() which triggers rate limits.
    """
    time.sleep(0.3)  # small delay between requests
    ticker = yf.Ticker(ticker_sym)
    fi     = ticker.fast_info

    price = float(fi.last_price      or 0)
    prev  = float(fi.previous_close  or 0)
    open_ = float(fi.open            or prev)
    high  = float(fi.day_high        or price)
    low   = float(fi.day_low         or price)
    vol   = int(fi.three_month_average_volume or 0)

    if price <= 0 or prev <= 0:
        raise ValueError(f"Invalid price from fast_info: price={price} prev={prev}")

    return (
        round(price, 2), round(prev, 2),
        round(open_, 2), round(high, 2),
        round(low, 2),   vol,
    )


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


def _resolve_ticker(symbol: str, exchange: str) -> str:
    return NSE_OVERRIDES.get(
        symbol, f"{symbol}{'.NS' if exchange == 'NSE' else '.BO'}"
    )


def get_live_price(symbol: str, exchange: str = "NSE") -> dict:
    ttl    = CACHE_TTL_OPEN if _is_market_open() else CACHE_TTL_CLOSED
    cached = _cache.get(symbol)
    if cached and (time.time() - cached["_ts"]) < ttl:
        return {k: v for k, v in cached.items() if k != "_ts"}

    ticker_sym = _resolve_ticker(symbol, exchange)

    try:
        price, prev, open_, high, low, vol = _fetch_fast_info(ticker_sym)

        if price < 0.5 or price > 1_000_000:
            raise ValueError(f"Suspicious price {price}")

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
        print(f"[price] {ticker_sym}: {e} — GBM fallback")
        # Return last cached value if available
        if symbol in _cache:
            return {k: v for k, v in _cache[symbol].items() if k != "_ts"}
        return _gbm(symbol, exchange)


def get_index(symbol: str) -> dict:
    ttl    = CACHE_TTL_OPEN if _is_market_open() else CACHE_TTL_CLOSED
    cached = _cache.get(f"_idx_{symbol}")
    if cached and (time.time() - cached["_ts"]) < ttl:
        return {k: v for k, v in cached.items() if k != "_ts"}

    try:
        time.sleep(0.3)
        ticker = yf.Ticker(symbol)
        fi     = ticker.fast_info
        price  = round(float(fi.last_price     or 0), 2)
        prev   = round(float(fi.previous_close or 0), 2)

        if price <= 0:
            raise ValueError(f"Invalid index price: {price}")

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
