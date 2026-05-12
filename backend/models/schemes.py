from typing import List, Optional

from pydantic import BaseModel, Field


class BookNote(BaseModel):
    title: str = Field(default='', max_length=100)
    author: str = Field(default='', max_length=50)
    content: str = Field(default='')

class AskRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=50, description="用户ID")
    query: str = Field(..., min_length=1, max_length=1000, description="用户问题")
    book_filter: Optional[str] = Field(default=None, max_length=100, description="限定书名（可选）")

class AskResponse(BaseModel):
    answer: str = Field(..., description="LLM 生成的回答")