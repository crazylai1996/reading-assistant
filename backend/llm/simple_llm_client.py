from config import get_settings
from langchain_openai import ChatOpenAI

def create_llm_client() -> ChatOpenAI:
    """创建LLM客户端实例"""
    settings = get_settings()
    llm_client = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        streaming=False,
        timeout=settings.llm_timeout,
        extra_body={
            "tool_choice": "auto"
        }
    )
    return llm_client


