from typing import List, Optional

from pydantic import BaseModel, Field


class BookNote(BaseModel):
    title: str = Field(default='', max_length=100)
    author: str = Field(default='', max_length=50)
    content: str = Field(default='')

class BookUploadResult(BaseModel):
    title: str = Field(..., description="书名")
    id: int = Field(..., description="阅读历史记录ID")

class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000, description="用户问题")
    book_filter: Optional[str] = Field(default=None, max_length=100, description="限定书名（可选）")
    conversation_id: Optional[int] = Field(default=None, description="对话ID（可选，用于续接已有对话）")

class AskResponse(BaseModel):
    answer: str = Field(..., description="LLM 生成的回答")
    conversation_id: Optional[int] = Field(default=None, description="对话ID")

class ReadingHistoryItem(BaseModel):
    id: int
    user_id: str
    book_title: str
    author: str
    filename: str
    uploaded_at: str

class ReadingHistoryList(BaseModel):
    items: List[ReadingHistoryItem]
    total: int

class ReadingHistoryDetail(ReadingHistoryItem):
    content_md: str = ''

class ConversationItem(BaseModel):
    id: int
    user_id: str
    title: str
    book_filter: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int = 0

class ConversationMessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

class ConversationDetail(BaseModel):
    conversation: ConversationItem
    messages: List[ConversationMessageItem]

class ConversationList(BaseModel):
    items: List[ConversationItem]
    total: int