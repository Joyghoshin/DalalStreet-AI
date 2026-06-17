"""
app/routers/backtest.py
REST endpoints for backtesting algo strategies.
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.backtest import run_backtest, run_all_strategies, STRAT_MAP

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

VALID_SYMBOLS = [
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ITC",
    "SBIN", "BHARTIARTL", "KOTAKBANK", "WIPRO", "TATAMOTORS",
    "BAJFINANCE", "HCLTECH", "ADANIENT", "ASIANPAINT", "MARUTI",
    "SUNPHARMA", "TITAN", "NESTLEIND", "ULTRACEMCO", "POWERGRID",
]


@router.get("/run")
async def backtest_single(
    symbol:   str = Query(..., description="NSE symbol e.g. RELIANCE"),
    strategy: str = Query(..., description="Strategy key"),
    years:    int = Query(5,   description="Years of history (1-5)"),
):
    """Run one strategy on one symbol. Returns metrics + equity curve + trade log."""
    symbol   = symbol.upper().strip()
    strategy = strategy.lower().strip()
    years    = max(1, min(5, years))

    if strategy not in STRAT_MAP:
        raise HTTPException(400, f"Unknown strategy. Valid: {list(STRAT_MAP.keys())}")

    try:
        result = run_backtest(symbol, strategy, years)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Backtest error: {e}")


@router.get("/compare")
async def backtest_compare(
    symbol: str = Query(..., description="NSE symbol e.g. RELIANCE"),
    years:  int = Query(5,  description="Years of history (1-5)"),
):
    """Run ALL 5 strategies on one symbol. Returns comparison table."""
    symbol = symbol.upper().strip()
    years  = max(1, min(5, years))

    try:
        results = run_all_strategies(symbol, years)
        return {"symbol": symbol, "years": years, "strategies": results}
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Backtest error: {e}")


@router.get("/symbols")
async def get_symbols():
    """Return list of supported symbols for the dropdown."""
    return {"symbols": VALID_SYMBOLS}
