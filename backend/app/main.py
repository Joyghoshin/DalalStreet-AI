from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app.include_router(market.router,          prefix="/api/market",    tags=["Market"])
app.include_router(portfolio.router,       prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(chat.router,            prefix="/api/chat",      tags=["AI Chat"])
app.include_router(backtest_router.router, prefix="/api/backtest",  tags=["Backtest"])
app.include_router(chart_router.router)    # prefix already set to /api/chart inside

@app.get("/")
def root():
    return {"status": "DalalStreet AI Backend Running 🇮🇳", "version": "2.0"}
