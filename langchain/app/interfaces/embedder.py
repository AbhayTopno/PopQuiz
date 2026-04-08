"""
Abstract interface for embedding providers.
Follows OCP + DIP: the RAG chain depends on this, not on a concrete embedder.
"""

from abc import ABC, abstractmethod

from langchain_core.embeddings import Embeddings


class IEmbedder(ABC):
    """Contract every concrete embedder must satisfy."""

    @abstractmethod
    def get_embeddings(self) -> Embeddings:
        """Return a LangChain-compatible embeddings instance."""
        ...
