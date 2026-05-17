import sqlite3
import os
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "reading_assistant.db"


def get_db() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS reading_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            book_title  TEXT NOT NULL DEFAULT '',
            author      TEXT NOT NULL DEFAULT '',
            filename    TEXT NOT NULL,
            content_md  TEXT NOT NULL DEFAULT '',
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            title       TEXT NOT NULL DEFAULT '',
            book_filter TEXT DEFAULT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS conversation_messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content         TEXT NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_reading_history_user ON reading_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON conversation_messages(conversation_id);
    """)

    conn.commit()
    conn.close()
    print(f"✅ 数据库初始化完成: {DB_PATH}")


def insert_reading_history(user_id: str, book_title: str, author: str, filename: str, content_md: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO reading_history (user_id, book_title, author, filename, content_md) VALUES (?, ?, ?, ?, ?)",
        (user_id, book_title, author, filename, content_md),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_reading_history(user_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, user_id, book_title, author, filename, uploaded_at FROM reading_history WHERE user_id = ? ORDER BY uploaded_at DESC",
        (user_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_reading_history_by_id(history_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reading_history WHERE id = ?", (history_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_reading_history(history_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reading_history WHERE id = ?", (history_id,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0


def create_conversation(user_id: str, title: str, book_filter: str | None = None) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (user_id, title, book_filter) VALUES (?, ?, ?)",
        (user_id, title, book_filter),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def add_conversation_message(conversation_id: int, role: str, content: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, role, content),
    )
    cursor.execute(
        "UPDATE conversations SET updated_at = datetime('now', 'localtime') WHERE id = ?",
        (conversation_id,),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_conversations(user_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT c.id, c.user_id, c.title, c.book_filter, c.created_at, c.updated_at,
               COUNT(cm.id) AS message_count
        FROM conversations c
        LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        """,
        (user_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_conversation_detail(conversation_id: int):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
    conv_row = cursor.fetchone()
    if not conv_row:
        conn.close()
        return None

    cursor.execute(
        "SELECT id, role, content, created_at FROM conversation_messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    )
    msg_rows = cursor.fetchall()
    conn.close()

    return {
        "conversation": dict(conv_row),
        "messages": [dict(row) for row in msg_rows],
    }


def delete_conversation(conversation_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0