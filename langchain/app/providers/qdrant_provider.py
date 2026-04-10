"""
Concrete Qdrant implementation of IVectorStoreProvider.
Creates ephemeral collections per request and cleans them up after retrieval.
"""

import uuid

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from app.config import Settings
from app.interfaces.embedder import IEmbedder
from app.interfaces.vectorstore import IVectorStoreProvider


class QdrantVectorStoreProvider(IVectorStoreProvider):
    """Builds ephemeral Qdrant collections for per-request RAG pipelines."""

    def __init__(self, embedder: IEmbedder, settings: Settings) -> None:
        self._embeddings = embedder.get_embeddings()
        self._qdrant_url = settings.qdrant_url
        self._client = QdrantClient(url=settings.qdrant_url)

    def build(self, documents: list[Document]) -> QdrantVectorStore:
        collection_name = f"rag_{uuid.uuid4().hex}"
        return QdrantVectorStore.from_documents(
            documents,
            embedding=self._embeddings,
            url=self._qdrant_url,
            collection_name=collection_name,
            force_recreate=True,
        )

    def cleanup(self, vectorstore: VectorStore) -> None:
        if isinstance(vectorstore, QdrantVectorStore):
            self._client.delete_collection(vectorstore.collection_name)
