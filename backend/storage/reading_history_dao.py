
from storage.sqlite_api import get_db


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
