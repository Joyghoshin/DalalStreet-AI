from fastapi import APIRouter
from pydantic import BaseModel
from app.services.trade_engine import (
    buy, sell, get_holdings, get_orders, get_cash, reset_portfolio
)
from app.services.data_fetcher import get_live_price

router = APIRouter()

class TradeRequest(BaseModel):
    symbol:   str
    qty:      int
    exchange: str = "NSE"

@router.post("/buy")
def place_buy(req: TradeRequest):
    live  = get_live_price(req.symbol, req.exchange)
    return buy(req.symbol, req.qty, live["price"])

@router.post("/sell")
def place_sell(req: TradeRequest):
    live  = get_live_price(req.symbol, req.exchange)
    return sell(req.symbol, req.qty, live["price"])

@router.get("/holdings")
def holdings():
    rows = get_holdings()
    enriched = []
    for h in rows:
        live     = get_live_price(h["symbol"])
        ltp      = live["price"]
        invested = round(h["avg_price"] * h["qty"], 2)
        current  = round(ltp * h["qty"], 2)
        pnl      = round(current - invested, 2)
        pnl_pct  = round((pnl / invested) * 100, 2) if invested else 0
        enriched.append({**h, "ltp": ltp, "invested": invested,
                         "current": current, "pnl": pnl, "pnl_pct": pnl_pct})
    return enriched

@router.get("/orders")
def orders(limit: int = 20):
    return get_orders(limit)

@router.get("/summary")
def summary():
    rows      = get_holdings()
    cash      = get_cash()
    invested  = sum(h["qty"] * h["avg_price"] for h in rows)
    current   = sum(get_live_price(h["symbol"])["price"] * h["qty"] for h in rows)
    total_pnl = round(current - invested, 2)
    return {
        "cash":        round(cash, 2),
        "invested":    round(invested, 2),
        "current_val": round(current, 2),
        "total_pnl":   total_pnl,
        "pnl_pct":     round((total_pnl / invested) * 100, 2) if invested else 0,
        "total_value": round(cash + current, 2),
    }

@router.post("/reset")
def reset():
    return reset_portfolio()
