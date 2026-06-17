"""
app/services/backtest.py
Backtesting engine for DalalStreet-AI — 5 strategies, up to 5 years of NSE data.
Uses yfinance for OHLCV history. No external backtest library needed.
"""
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Literal

STRATEGY = Literal[
    "breakout_52w", "ema_crossover", "rsi_momentum",
    "bollinger_bands", "zscore_reversion"
]

PERIOD_YEARS = 5

# ── helpers ──────────────────────────────────────────────────────────────────

def _fetch(symbol: str, years: int = PERIOD_YEARS) -> pd.DataFrame:
    end   = datetime.today()
    start = end - timedelta(days=365 * years)
    df = yf.download(f"{symbol}.NS", start=start, end=end,
                     auto_adjust=True, progress=False)
    if df.empty:
        raise ValueError(f"No data for {symbol}")
    df.index = pd.to_datetime(df.index)
    # Flatten MultiIndex columns if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df[["Open", "High", "Low", "Close", "Volume"]].dropna()


def _equity_curve(returns: pd.Series, initial: float = 100_000) -> list[dict]:
    """Convert daily returns series → equity curve list for charting."""
    equity = (1 + returns).cumprod() * initial
    return [
        {"date": str(d.date()), "equity": round(float(v), 2)}
        for d, v in equity.items()
    ]


def _metrics(returns: pd.Series, trades: list[dict]) -> dict:
    if returns.empty or len(returns) == 0:
        return {}
    total_ret   = float((1 + returns).prod() - 1) * 100
    ann_ret     = float((1 + returns).prod() ** (252 / max(len(returns), 1)) - 1) * 100
    volatility  = float(returns.std() * np.sqrt(252)) * 100
    sharpe      = ann_ret / volatility if volatility > 0 else 0
    # Max drawdown
    cum = (1 + returns).cumprod()
    roll_max = cum.cummax()
    dd = (cum - roll_max) / roll_max
    max_dd = float(dd.min()) * 100

    wins  = [t for t in trades if t.get("pnl", 0) > 0]
    total_trades = len(trades)
    win_rate = len(wins) / total_trades * 100 if total_trades else 0
    avg_win  = np.mean([t["pnl"] for t in wins]) if wins else 0
    losses   = [t for t in trades if t.get("pnl", 0) <= 0]
    avg_loss = np.mean([t["pnl"] for t in losses]) if losses else 0
    profit_factor = abs(sum(t["pnl"] for t in wins) / sum(t["pnl"] for t in losses)) \
        if losses and sum(t["pnl"] for t in losses) != 0 else 0

    return {
        "totalReturn":    round(total_ret, 2),
        "annualReturn":   round(ann_ret, 2),
        "volatility":     round(volatility, 2),
        "sharpeRatio":    round(sharpe, 2),
        "maxDrawdown":    round(max_dd, 2),
        "totalTrades":    total_trades,
        "winRate":        round(win_rate, 2),
        "avgWin":         round(avg_win, 2),
        "avgLoss":        round(avg_loss, 2),
        "profitFactor":   round(profit_factor, 2),
    }


# ── strategies ────────────────────────────────────────────────────────────────

def _strat_breakout_52w(df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
    """Buy on new 52-week high close with 2× avg volume. Exit after 20 days or -3% stop."""
    close  = df["Close"]
    volume = df["Volume"]
    high52 = close.rolling(252).max().shift(1)
    avg_vol = volume.rolling(20).mean().shift(1)

    position = False
    entry_price = 0.0
    entry_idx   = 0
    trades: list[dict] = []
    daily_ret = pd.Series(0.0, index=df.index)

    for i in range(252, len(df)):
        row = df.iloc[i]
        if not position:
            if (close.iloc[i] > high52.iloc[i] and
                    volume.iloc[i] > 2 * avg_vol.iloc[i]):
                position    = True
                entry_price = row["Close"]
                entry_idx   = i
        else:
            days_held = i - entry_idx
            ret_since = (row["Close"] - entry_price) / entry_price
            daily_ret.iloc[i] = (row["Close"] - df["Close"].iloc[i-1]) / df["Close"].iloc[i-1]
            if ret_since <= -0.03 or days_held >= 20:
                pnl = round((row["Close"] - entry_price) / entry_price * 100, 2)
                trades.append({
                    "entry":    str(df.index[entry_idx].date()),
                    "exit":     str(df.index[i].date()),
                    "entryPx":  round(entry_price, 2),
                    "exitPx":   round(row["Close"], 2),
                    "pnl":      pnl,
                    "days":     days_held,
                    "reason":   "stop" if ret_since <= -0.03 else "target",
                })
                position = False

    return daily_ret[daily_ret != 0], trades


def _strat_ema_crossover(df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
    """9/21 EMA golden cross entry, 9/21 death cross exit. 50 EMA trend filter."""
    close  = df["Close"]
    ema9   = close.ewm(span=9,  adjust=False).mean()
    ema21  = close.ewm(span=21, adjust=False).mean()
    ema50  = close.ewm(span=50, adjust=False).mean()

    position = False
    entry_price = 0.0
    entry_idx   = 0
    trades: list[dict] = []
    daily_ret = pd.Series(0.0, index=df.index)

    for i in range(50, len(df)):
        prev_cross = ema9.iloc[i-1] - ema21.iloc[i-1]
        curr_cross = ema9.iloc[i]   - ema21.iloc[i]
        if not position:
            if prev_cross < 0 and curr_cross > 0 and close.iloc[i] > ema50.iloc[i]:
                position    = True
                entry_price = close.iloc[i]
                entry_idx   = i
        else:
            daily_ret.iloc[i] = (close.iloc[i] - close.iloc[i-1]) / close.iloc[i-1]
            if prev_cross > 0 and curr_cross < 0:
                pnl = round((close.iloc[i] - entry_price) / entry_price * 100, 2)
                trades.append({
                    "entry":   str(df.index[entry_idx].date()),
                    "exit":    str(df.index[i].date()),
                    "entryPx": round(entry_price, 2),
                    "exitPx":  round(close.iloc[i], 2),
                    "pnl":     pnl,
                    "days":    i - entry_idx,
                    "reason":  "cross",
                })
                position = False

    return daily_ret[daily_ret != 0], trades


def _strat_rsi_momentum(df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
    """RSI(14) cross above 60 entry. Exit when RSI drops below 50."""
    close   = df["Close"]
    delta   = close.diff()
    gain    = delta.clip(lower=0).rolling(14).mean()
    loss    = (-delta.clip(upper=0)).rolling(14).mean()
    rs      = gain / loss.replace(0, np.nan)
    rsi     = 100 - (100 / (1 + rs))

    position = False
    entry_price = 0.0
    entry_idx   = 0
    trades: list[dict] = []
    daily_ret = pd.Series(0.0, index=df.index)

    for i in range(15, len(df)):
        if not position:
            if rsi.iloc[i-1] < 60 and rsi.iloc[i] >= 60:
                position    = True
                entry_price = close.iloc[i]
                entry_idx   = i
        else:
            daily_ret.iloc[i] = (close.iloc[i] - close.iloc[i-1]) / close.iloc[i-1]
            if rsi.iloc[i] < 50:
                pnl = round((close.iloc[i] - entry_price) / entry_price * 100, 2)
                trades.append({
                    "entry":   str(df.index[entry_idx].date()),
                    "exit":    str(df.index[i].date()),
                    "entryPx": round(entry_price, 2),
                    "exitPx":  round(close.iloc[i], 2),
                    "pnl":     pnl,
                    "days":    i - entry_idx,
                    "reason":  "rsi_exit",
                })
                position = False

    return daily_ret[daily_ret != 0], trades


def _strat_bollinger_bands(df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
    """Buy below lower band (−2σ), exit at middle band. Sell above upper band."""
    close = df["Close"]
    mid   = close.rolling(20).mean()
    std   = close.rolling(20).std()
    upper = mid + 2 * std
    lower = mid - 2 * std

    position = False
    entry_price = 0.0
    entry_idx   = 0
    trades: list[dict] = []
    daily_ret = pd.Series(0.0, index=df.index)

    for i in range(20, len(df)):
        if not position:
            if close.iloc[i] < lower.iloc[i]:
                position    = True
                entry_price = close.iloc[i]
                entry_idx   = i
        else:
            daily_ret.iloc[i] = (close.iloc[i] - close.iloc[i-1]) / close.iloc[i-1]
            if close.iloc[i] >= mid.iloc[i]:
                pnl = round((close.iloc[i] - entry_price) / entry_price * 100, 2)
                trades.append({
                    "entry":   str(df.index[entry_idx].date()),
                    "exit":    str(df.index[i].date()),
                    "entryPx": round(entry_price, 2),
                    "exitPx":  round(close.iloc[i], 2),
                    "pnl":     pnl,
                    "days":    i - entry_idx,
                    "reason":  "mid_band",
                })
                position = False

    return daily_ret[daily_ret != 0], trades


def _strat_zscore_reversion(df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
    """Z-score of 20-day returns. Enter long when z < −2, exit when z > −0.5."""
    close   = df["Close"]
    ret20   = close.pct_change(20)
    mu      = ret20.rolling(60).mean()
    sigma   = ret20.rolling(60).std()
    zscore  = (ret20 - mu) / sigma.replace(0, np.nan)

    position = False
    entry_price = 0.0
    entry_idx   = 0
    trades: list[dict] = []
    daily_ret = pd.Series(0.0, index=df.index)

    for i in range(80, len(df)):
        if not position:
            if zscore.iloc[i] < -2.0:
                position    = True
                entry_price = close.iloc[i]
                entry_idx   = i
        else:
            daily_ret.iloc[i] = (close.iloc[i] - close.iloc[i-1]) / close.iloc[i-1]
            if zscore.iloc[i] > -0.5:
                pnl = round((close.iloc[i] - entry_price) / entry_price * 100, 2)
                trades.append({
                    "entry":   str(df.index[entry_idx].date()),
                    "exit":    str(df.index[i].date()),
                    "entryPx": round(entry_price, 2),
                    "exitPx":  round(close.iloc[i], 2),
                    "pnl":     pnl,
                    "days":    i - entry_idx,
                    "reason":  "zscore_exit",
                })
                position = False

    return daily_ret[daily_ret != 0], trades


# ── public API ────────────────────────────────────────────────────────────────

STRAT_MAP = {
    "breakout_52w":     _strat_breakout_52w,
    "ema_crossover":    _strat_ema_crossover,
    "rsi_momentum":     _strat_rsi_momentum,
    "bollinger_bands":  _strat_bollinger_bands,
    "zscore_reversion": _strat_zscore_reversion,
}

STRAT_LABELS = {
    "breakout_52w":     "52-Week Breakout",
    "ema_crossover":    "EMA Crossover (9/21)",
    "rsi_momentum":     "RSI Momentum",
    "bollinger_bands":  "Bollinger Bands",
    "zscore_reversion": "Z-Score Reversion",
}


def run_backtest(symbol: str, strategy: str, years: int = PERIOD_YEARS) -> dict:
    """
    Run a single strategy backtest on a symbol.
    Returns metrics, equity curve, and trade log.
    """
    if strategy not in STRAT_MAP:
        raise ValueError(f"Unknown strategy: {strategy}")

    df              = _fetch(symbol, years)
    returns, trades = STRAT_MAP[strategy](df)
    metrics         = _metrics(returns, trades)
    equity          = _equity_curve(returns)

    # Buy-and-hold benchmark
    bh_ret    = df["Close"].pct_change().dropna()
    bh_total  = float((1 + bh_ret).prod() - 1) * 100
    bh_ann    = float((1 + bh_ret).prod() ** (252 / max(len(bh_ret), 1)) - 1) * 100

    return {
        "symbol":       symbol,
        "strategy":     strategy,
        "strategyName": STRAT_LABELS[strategy],
        "years":        years,
        "metrics":      metrics,
        "equityCurve":  equity,
        "trades":       trades[-50:],   # last 50 trades for the table
        "totalTrades":  len(trades),
        "benchmark": {
            "totalReturn": round(bh_total, 2),
            "annualReturn": round(bh_ann, 2),
            "label": f"{symbol} Buy & Hold",
        },
    }


def run_all_strategies(symbol: str, years: int = PERIOD_YEARS) -> list[dict]:
    """Run all 5 strategies on a symbol and return comparison list."""
    results = []
    df = _fetch(symbol, years)
    for key, fn in STRAT_MAP.items():
        try:
            returns, trades = fn(df)
            metrics         = _metrics(returns, trades)
            results.append({
                "strategy":     key,
                "strategyName": STRAT_LABELS[key],
                "metrics":      metrics,
                "totalTrades":  len(trades),
            })
        except Exception as e:
            results.append({
                "strategy":     key,
                "strategyName": STRAT_LABELS[key],
                "error":        str(e),
                "metrics":      {},
            })
    return results
