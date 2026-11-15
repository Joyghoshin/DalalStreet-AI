from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import logging

from app.routers import market, portfolio, chat
from app.routers import backtest_router
from app.routers import chart_router

app = FastAPI(title="DalalStreet AI API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://dalal-street-ai-pmpn.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = int((time.perf_counter() - start_time) * 1000)
    response.headers["X-Process-Time"] = str(process_time_ms)
    if process_time_ms > 500:
        logging.warning(f"Slow endpoint: {request.method} {request.url.path} took {process_time_ms}ms")
    return response

app.include_router(market.router,          prefix="/api/market",    tags=["Market"])
app.include_router(portfolio.router,       prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(chat.router,            prefix="/api/chat",      tags=["AI Chat"])
app.include_router(backtest_router.router, prefix="/api/backtest",  tags=["Backtest"])
app.include_router(chart_router.router)    # prefix already set to /api/chart inside

@app.get("/")
def root():
    return {"status": "DalalStreet AI Backend Running 🇮🇳", "version": "2.0"}
