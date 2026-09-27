import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "database.db")
SCHEMA = os.path.join(BASE_DIR, "schema.sql")


def get_db():
    """Open a connection to the SQLite database.

    Use it as `with closing(get_db()) as conn, conn:` so the connection
    is closed and the transaction is committed (or rolled back on error).
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # access columns by name
    # SQLite ignores FOREIGN KEY constraints unless each connection opts in.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create any missing tables from schema.sql."""
    conn = get_db()
    try:
        with open(SCHEMA, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
    finally:
        conn.close()
