"""笔记 RAG"""

import torch
import sys

from typing import List, Optional, Dict, Any
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers.document_compressors.cross_encoder_rerank import CrossEncoderReranker
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse, RetrievalMode
from qdrant_client import models, QdrantClient
from langchain_core.documents import Document


from config import get_settings
from models.schemes import BookNote

class ReadingNotesRAG:
    """读书笔记导入和搜索"""
    def __init__(self, qdrant_path: str, top_n: int = 5):
        self.collection_name = "reading_notes"
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.top_n = top_n
        print(f"🚀 使用设备: {self.device}")

        # 向量和重排模型
        self.embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-m3", 
                                                model_kwargs={"device": self.device})
        # 设置稀疏向量模型，用于替代传统的 BM25
        self.sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25")
        self.rerank_model = HuggingFaceCrossEncoder(model_name = "BAAI/bge-reranker-v2-m3", 
                                                    model_kwargs={"device": self.device})
        self.compressor = CrossEncoderReranker(model=self.rerank_model, top_n=top_n)
        print("✅ 向量和重排模型加载完成！")

        # 初始化 Qdrant 客户端 (启用 FastEmbed 稀疏向量)
        self.client = QdrantClient(path=qdrant_path)
        self._init_collection()
        print("✅ Qdrant 集合初始化完成！")

        # 初始化支持混合检索的 VectorStore
        self.vector_store = QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
            embedding=self.embeddings,           # 稠密
            sparse_embedding=self.sparse_embeddings,  # 稀疏 ← 必须传入
            retrieval_mode=RetrievalMode.HYBRID,      # ← 关键参数
            vector_name="dense",
            sparse_vector_name="sparse",
        )

    def _init_collection(self):
        if not self.client.collection_exists(self.collection_name):
            # 创建集合：同时定义稠密和稀疏向量配置
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config={
                    "dense": models.VectorParams(size=1024, distance=models.Distance.COSINE)
                },
                sparse_vectors_config={
                    "sparse": models.SparseVectorParams(index=models.SparseIndexParams(full_scan_threshold=1000))
                }
            )
            # 建立过滤索引
            self.client.create_payload_index(self.collection_name, "metadata.user_id", models.PayloadSchemaType.KEYWORD)
            self.client.create_payload_index(self.collection_name, "metadata.title", models.PayloadSchemaType.KEYWORD)
    def import_notes(self, user_id: str, reading_notes: List[BookNote]):
        """导入读书笔记"""
        splitter = MarkdownHeaderTextSplitter([("##", "H2"), ("###", "H3")])
        all_docs = []
        for note in reading_notes:

            self._delete_note(user_id, note.title)

            chunks = splitter.split_text(note.content)
            for chunk in chunks:
                chunk.metadata.update({
                    "user_id": user_id,
                    "title": note.title,
                    "author": note.author
                })
                # 增强文本：把标题带入正文，对稀疏向量（关键词检索）极有帮助
                h_context = f"{chunk.metadata.get('H2', '')} {chunk.metadata.get('H3', '')}"
                chunk.page_content = f"书名: {note.title} 上下文: {h_context}\n 内容: {chunk.page_content}"
                all_docs.append(chunk)
        
        if all_docs:
            # 内部会自动调用 set_sparse_model 设定的模型生成稀疏向量
            self.vector_store.add_documents(all_docs)

    def _delete_note(self, user_id: str, title: str):
        """删除用户的同名笔记（如果存在）"""
        self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.Filter(
                    must=[
                        models.FieldCondition(key="metadata.user_id", match=models.MatchValue(value=user_id)),
                        models.FieldCondition(key="metadata.title", match=models.MatchValue(value=title)),
                    ]
                ),
            )

    def search_notes(self, user_id: str, query: str, book_title: Optional[str] = None) -> List[Document]:
        """搜索读书笔记"""
        print(f"🔍 搜索笔记: user_id={user_id}, query={query[:30]}..., book_title={book_title}")
        # 1. 构造 Qdrant 原生过滤器
        conditions = [models.FieldCondition(key="metadata.user_id", match=models.MatchValue(value=user_id))]
        if book_title:
            conditions.append(models.FieldCondition(key="metadata.title", match=models.MatchValue(value=book_title)))
        
        search_filter = models.Filter(must=conditions)

        # 2. 构造基础检索器（通过 search_type="mmr" 或默认，但指定检索参数）
        # QdrantVectorStore 识别到配置了 sparse_vector_name 后会自动执行混合检索
        base_retriever = self.vector_store.as_retriever(
            search_kwargs={
                "filter": search_filter,
                "k": 20  # 初步召回较多数量，交给 Reranker 过滤
            }
        )

        # 3. 封装重排逻辑
        retriever = ContextualCompressionRetriever(
            base_compressor=self.compressor,
            base_retriever=base_retriever
        )

        return retriever.invoke(query)
    
# logging.basicConfig(level=logging.DEBUG)
if __name__ == "__main__":
    try:
        rag = ReadingNotesRAG(qdrant_path="./qdrant_data")
        print("📚 读书笔记 RAG 系统初始化完成！")
        with open("../examples/《Python深度学习（第2版）》.md", "r") as f:
            sample_notes = f.read() 
        print("📖 读书笔记示例加载成功！")
        # 示例导入
        book_note = BookNote(title="Python深度学习（第2版）", author="unknown", content=sample_notes)
        rag.import_notes(
            user_id="user123",
            reading_notes=[book_note]
        )
        print("✅ 读书笔记导入成功！")
        # 示例搜索
        search_results = rag.search_notes(user_id="user123", query="什么是损失函数", book_title="Python深度学习（第2版）")
        print("🔍 搜索结果:")
        for res in search_results:
            print("-"*50)
            print(f"标题: {res.metadata.get('title', 'N/A')}")
            print(res.page_content)  # 只显示前200字符
    except Exception as e:
        print(f"\n💥 运行时发生未捕获异常:", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)