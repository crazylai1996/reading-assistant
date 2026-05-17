"""阅读历史与对话历史 API"""

from fastapi import APIRouter, Query, HTTPException

from storage.database import (
    get_reading_history,
    get_reading_history_by_id,
    delete_reading_history,
    get_conversations,
    get_conversation_detail,
    delete_conversation,
)
from models.schemes import (
    ReadingHistoryItem,
    ReadingHistoryList,
    ReadingHistoryDetail,
    ConversationItem,
    ConversationDetail,
    ConversationList,
)

history_router = APIRouter(prefix="/history", tags=["历史记录"])


@history_router.get("/reading", response_model=ReadingHistoryList, summary="阅读历史列表")
async def list_reading_history(user_id: str = Query(..., min_length=1, description="用户ID")):
    items = get_reading_history(user_id)
    return ReadingHistoryList(
        items=[ReadingHistoryItem(**item) for item in items],
        total=len(items),
    )


@history_router.get("/reading/{history_id}", response_model=ReadingHistoryDetail, summary="阅读历史详情")
async def get_reading_detail(history_id: int):
    item = get_reading_history_by_id(history_id)
    if not item:
        raise HTTPException(status_code=404, detail="记录不存在")
    return ReadingHistoryDetail(**item)


@history_router.delete("/reading/{history_id}", summary="删除阅读历史")
async def delete_reading(history_id: int):
    if not delete_reading_history(history_id):
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"detail": "已删除"}


@history_router.get("/conversations", response_model=ConversationList, summary="对话列表")
async def list_conversations(user_id: str = Query(..., min_length=1, description="用户ID")):
    items = get_conversations(user_id)
    return ConversationList(
        items=[ConversationItem(**item) for item in items],
        total=len(items),
    )


@history_router.get("/conversations/{conversation_id}", response_model=ConversationDetail, summary="对话详情")
async def get_conversation(conversation_id: int):
    detail = get_conversation_detail(conversation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="对话不存在")
    return ConversationDetail(
        conversation=ConversationItem(**detail["conversation"]),
        messages=detail["messages"],
    )


@history_router.delete("/conversations/{conversation_id}", summary="删除对话")
async def delete_conversation_endpoint(conversation_id: int):
    if not delete_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="对话不存在")
    return {"detail": "已删除"}