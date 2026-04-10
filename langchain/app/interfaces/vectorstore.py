"""
Abstract interface for vector-store providers.
"""

from abc import ABC, abstractmethod

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore


class IVectorStoreProvider(ABC):
    """Contract every concrete vector-store provider must satisfy."""

    @abstractmethod
    def build(self, documents: list[Document]) -> VectorStore:
        """Create and populate a vector store from document chunks."""
        ...

    @abstractmethod
    def cleanup(self, vectorstore: VectorStore) -> None:
        """Release resources held by the vector store (e.g. drop ephemeral collections)."""
        ...
