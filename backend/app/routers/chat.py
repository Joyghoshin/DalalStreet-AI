from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_chat import chat, analyse_stock

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: list = []


class AnalyseRequest(BaseModel):
    symbol: str


@router.post("/")
def chat_endpoint(req: ChatRequest):
    reply = chat(req.message, req.history)
    return {"reply": reply}


@router.post("/analyse")
def analyse_endpoint(req: AnalyseRequest):
    reply = analyse_stock(req.symbol)
    return {"reply": reply}


@router.get("/suggestions")
def suggestions():
    """Quick-action prompt suggestions."""
    return {
        "suggestions": [
            "How is my portfolio doing today?",
            "Should I buy more RELIANCE?",
            "Which stock in my portfolio has the best momentum?",
            "Explain why INFY is falling today",
            "What is Nifty 50 outlook this week?",
            "Show me my biggest loss position",
            "Is ITC a good buy at current levels?",
            "Compare TCS vs INFY for long term",
        ]
    }
