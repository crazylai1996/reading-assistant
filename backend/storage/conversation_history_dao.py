
from storage.sqlite_api import get_db

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