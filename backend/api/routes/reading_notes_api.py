"""读书笔记相关API"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from rag.rag_pipeline import ReadingNotesRAG
from models.schemes import BookNote, AskRequest, AskResponse
from agents.reading_notes_agent import ReadingNotesAgent

import re

notes_router = APIRouter(prefix="/notes", tags=["读书笔记"])

rag_pipeline = ReadingNotesRAG(qdrant_path="/tmp/qdrant")
reading_notes_agent = ReadingNotesAgent(rag_pipeline=rag_pipeline)

@notes_router.post(path="/upload", 
                   summary="上传读书笔记", 
             description="上传读书笔记文件，仅支持 .md格式")
async def upload_reading_note(file: UploadFile = File(..., description="仅支持 .md")):
    print(f"📥 收到上传请求: {file.filename} ({file.content_type})")
    if file.content_type != "text/markdown":
        raise HTTPException(status_code=400, detail="仅支持上传 .md 格式文件")
    
    try:
        content = await file.read()
        text = content.decode("utf-8")

        book_note = BookNote()
        book_note.content = text
        # 仅检查前 8 行，避免大文件扫描开销
        head_lines = text.splitlines()[:8]
        full_head = "\n".join(head_lines)

        # 1️⃣ 提取书名：精准匹配《》
        title_match = re.search(r'《([^》]+)》', full_head)
        if title_match:
            book_note.title = title_match.group(1).strip()

        # 2️⃣ 提取作者：兼容 [国籍] 姓名 著 / 姓名 著 / by Author
        # 优先匹配含“著/译”的行，避免误抓正文人名
        author_match = re.search(r'(?:\[[^\]]*\]\s*)?([\u4e00-\u9fa5a-zA-Z·\s]+?)\s*[著译]', full_head)
        if author_match:
            author = author_match.group(1).strip()
            book_note.author = re.sub(r'\s+', ' ', author) 

        rag_pipeline.import_notes(user_id="laixiaoming", reading_notes=[book_note])
        print(f"✅ 上传成功: {book_note.title}")
        return {"filename": book_note.title, "content_length": len(text)}
    except Exception as e:
        print(f"❌ 上传失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"上传失败: {str(e)}"
        )


@notes_router.post(path="/ask",
                   summary="基于笔记问答",
                   response_model=AskResponse,
                   description="基于已上传的读书笔记内容，使用 LLM 回答用户问题")
async def ask_notes(request: AskRequest):
    print(f"💬 收到问答请求: user={request.user_id}, query={request.query[:50]}...")
    try:
        answer = reading_notes_agent.ask_notes(user_id=request.user_id, 
                                             query=request.query)
        return AskResponse(answer=answer)
    except Exception as e:
        print(f"❌ 问答失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"问答失败: {str(e)}"
        )