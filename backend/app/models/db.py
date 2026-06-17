import sqlite3
from pathlib import Path

DB_PATH = Path("data/portfolio.db")

def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS portfolio (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol    TEXT NOT NULL UNIQUE,
            exchange  TEXT DEFAULT 'NSE',
            qty       INTEGER NOT NULL,
            avg_price REAL NOT NULL,
            bought_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS orders (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol    TEXT NOT NULL,
            side      TEXT NOT NULL,
            qty       INTEGER NOT NULL,
            price     REAL NOT NULL,
            status    TEXT DEFAULT 'FILLED',
            placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS cash (
            id      INTEGER PRIMARY KEY CHECK (id = 1),
            balance REAL NOT NULL DEFAULT 1000000.0
        );
        INSERT OR IGNORE INTO cash (id, balance) VALUES (1, 1000000.0);
    """)
    conn.commit()
    conn.close()

init_db()
