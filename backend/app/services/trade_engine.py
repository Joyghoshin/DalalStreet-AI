from app.models.db import get_conn


def get_cash() -> float:
    conn = get_conn()
    row  = conn.execute("SELECT balance FROM cash WHERE id=1").fetchone()
    conn.close()
    return row["balance"] if row else 0.0


def buy(symbol: str, qty: int, price: float) -> dict:
    cost = round(qty * price, 2)
    conn = get_conn()
    cash = conn.execute(
        "SELECT balance FROM cash WHERE id=1"
    ).fetchone()["balance"]

    if cash < cost:
        conn.close()
        return {"error": f"Insufficient cash. Need ₹{cost:,.2f}, have ₹{cash:,.2f}"}

    conn.execute("UPDATE cash SET balance = balance - ? WHERE id=1", (cost,))

    existing = conn.execute(
        "SELECT * FROM portfolio WHERE symbol=?", (symbol,)
    ).fetchone()

    if existing:
        new_qty = existing["qty"] + qty
        new_avg = round(
            (existing["qty"] * existing["avg_price"] + cost) / new_qty, 2
        )
        conn.execute(
            "UPDATE portfolio SET qty=?, avg_price=? WHERE symbol=?",
            (new_qty, new_avg, symbol),
        )
    else:
        conn.execute(
            "INSERT INTO portfolio (symbol, qty, avg_price) VALUES (?,?,?)",
            (symbol, qty, round(price, 2)),
        )

    conn.execute(
        "INSERT INTO orders (symbol,side,qty,price) VALUES (?,?,?,?)",
        (symbol, "BUY", qty, round(price, 2)),
    )
    conn.commit()
    conn.close()
    return {
        "status":  "FILLED",
        "side":    "BUY",
        "symbol":  symbol,
        "qty":     qty,
        "price":   round(price, 2),
        "total":   cost,
    }


def sell(symbol: str, qty: int, price: float) -> dict:
    conn     = get_conn()
    holding  = conn.execute(
        "SELECT * FROM portfolio WHERE symbol=?", (symbol,)
    ).fetchone()

    if not holding or holding["qty"] < qty:
        conn.close()
        avail = holding["qty"] if holding else 0
        return {"error": f"Not enough shares. Have {avail}, selling {qty}"}

    proceeds = round(qty * price, 2)
    conn.execute(
        "UPDATE cash SET balance = balance + ? WHERE id=1", (proceeds,)
    )

    new_qty = holding["qty"] - qty
    if new_qty == 0:
        conn.execute("DELETE FROM portfolio WHERE symbol=?", (symbol,))
    else:
        conn.execute(
            "UPDATE portfolio SET qty=? WHERE symbol=?", (new_qty, symbol)
        )

    conn.execute(
        "INSERT INTO orders (symbol,side,qty,price) VALUES (?,?,?,?)",
        (symbol, "SELL", qty, round(price, 2)),
    )
    conn.commit()
    conn.close()
    return {
        "status":   "FILLED",
        "side":     "SELL",
        "symbol":   symbol,
        "qty":      qty,
        "price":    round(price, 2),
        "proceeds": proceeds,
    }


def get_holdings() -> list:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM portfolio").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_orders(limit: int = 50) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM orders ORDER BY placed_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def reset_portfolio() -> dict:
    """Reset to fresh state — useful for demo."""
    conn = get_conn()
    conn.execute("DELETE FROM portfolio")
    conn.execute("DELETE FROM orders")
    conn.execute("UPDATE cash SET balance=1000000.0 WHERE id=1")
    conn.commit()
    conn.close()
    return {"status": "reset", "cash": 1000000.0}
