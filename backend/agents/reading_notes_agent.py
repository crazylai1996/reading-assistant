"""读书笔记问答Agent"""

from typing import Optional, List, Any
from langchain_core.documents import Document
from langchain.agents import create_agent
from langchain.tools import ToolRuntime
from dataclasses import dataclass
from pydantic import BaseModel
from langchain_core.tools.structured import StructuredTool

from models.schemes import AskRequest
from rag.rag_pipeline import ReadingNotesRAG
from llm.simple_llm_client import create_llm_client

@dataclass
class UserContext:
    """agent工具运行时的用户上下文，包含用户标识等信息"""
    user_id: str

class SearchInput(BaseModel):
    """search_notes工具的输入参数"""
    query: str
    book_title: Optional[str] = None

SYSTEM_PROMPT = """
你是读书笔记助手。请严格基于以下要求回答用户问题。
要求：
1. 使用用户已有的读书笔记内容来回答问题，可通过 search_notes 工具获取相关笔记内容
2. 引用具体书名和章节标题来佐证你的回答
3. 如果笔记中找不到相关信息，请明确说明
4. 使用中文回答，保持简洁清晰
"""
class ReadingNotesAgent:
    """读书笔记问答代理"""
    def __init__(self, rag_pipeline: ReadingNotesRAG):
        self.rag_pipeline = rag_pipeline
        self.llm = create_llm_client()

        search_tool = StructuredTool.from_function(
            func=self.search_notes,
            name="search_notes",
            description="根据关键词和书名搜索读书笔记，返回相关内容",
            args_schema=SearchInput
        )

        self.agent = create_agent(model=self.llm, 
                                  tools=[search_tool], 
                                  system_prompt=SYSTEM_PROMPT,
                                  context_schema=UserContext)

    def search_notes(self, runtime: ToolRuntime[UserContext], query: str, book_title: Optional[str] = None) -> str:
        """工具方法：根据关键词和书名搜索该用户的读书笔记，返回相关内容"""
        user_id = runtime.context.user_id
        docs = self.rag_pipeline.search_notes(user_id=user_id, query=query, book_title=book_title)
        return self._format_context(docs)

    def ask_notes(self, user_id: str, ask_request: AskRequest) -> str:
        """基于读书笔记回答问题"""
        query = self._build_query(ask_request=ask_request)
        response = self.agent.invoke({"messages": [{"role": "user", "content": query}]}, 
                                     context=UserContext(user_id=user_id), )
        return self._get_final_response(response)
    def _build_query(self, ask_request: AskRequest) -> str:
        query = f"""
           用户提问：{ask_request.query}
           { "书名: " + ask_request.book_filter if ask_request.book_filter else ""}
        """
        return query
    def _get_final_response(self, response: dict[str, Any]) -> str:
        """从智能体响应中提取最终回复内容"""
        return response["messages"][-1].content if response["messages"] else ""
    def _format_context(self, docs: List[Document]) -> str:
        """将检索到的文档格式化为 Prompt 上下文"""
        if not docs:
            return "未找到相关笔记内容，请尝试更换问题或上传更多笔记。"
        parts = []
        for i, doc in enumerate(docs, 1):
            title = doc.metadata.get("title", "未知")
            h2 = doc.metadata.get("H2", "")
            h3 = doc.metadata.get("H3", "")
            header = f"{title}"
            if h2:
                header += f" > {h2}"
            if h3:
                header += f" > {h3}"
            parts.append(f"[{i}] {header}\n{doc.page_content}")
        return "\n\n---\n\n".join(parts)