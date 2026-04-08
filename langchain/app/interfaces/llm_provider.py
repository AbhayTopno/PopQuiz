"""
Abstract interface for LLM providers.
Follows OCP + DIP: chains depend on this abstraction, not on any concrete LLM.
"""

from abc import ABC, abstractmethod

from langchain_core.language_models import BaseChatModel


class ILLMProvider(ABC):
    """Contract that every concrete LLM provider must satisfy."""

    @abstractmethod
    def get_llm(self) -> BaseChatModel:
        """Return a LangChain-compatible chat model instance."""
        ...
