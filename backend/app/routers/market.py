import asyncio, json
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from app.services.data_fetcher import get_live_price, get_index

router = APIRouter()

# NSE and BSE index tickers
INDICES = {
    "NIFTY 50":   "^NSEI",
    "SENSEX":     "^BSESN",
    "NIFTY BANK": "^NSEBANK",
}

@router.get("/stream/prices")
async def stream_prices(symbols: str = "RELIANCE,TCS,INFY,HDFCBANK,ITC"):
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]

    async def generator():
        while True:
            batch = []
            for sym in symbol_list:
                try:
                    batch.append(get_live_price(sym))
                except Exception as e:
                    print(f"Error {sym}: {e}")
            yield {"event": "price_update", "data": json.dumps(batch)}
            await asyncio.sleep(5)

    return EventSourceResponse(generator())

@router.get("/stream/indices")
async def stream_indices():
    async def generator():
        while True:
            indices = []
            for name, ticker in INDICES.items():
                data = get_index(ticker)
                data["name"] = name
                indices.append(data)
            yield {"event": "index_update", "data": json.dumps(indices)}
            await asyncio.sleep(5)
    return EventSourceResponse(generator())

@router.get("/indices")
def get_indices():
    result = []
    for name, ticker in INDICES.items():
        data = get_index(ticker)
        data["name"] = name
        result.append(data)
    return result

# Both /quote/{symbol} and /price/{symbol} work — Watchlist uses /price/
@router.get("/quote/{symbol}")
@router.get("/price/{symbol}")
def get_quote(symbol: str, exchange: str = "NSE"):
    return get_live_price(symbol, exchange)
