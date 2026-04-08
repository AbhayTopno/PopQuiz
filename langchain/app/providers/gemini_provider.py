"""
Concrete Gemini implementation of ILLMProvider and IEmbedder.
Follows LSP: substitutable wherever the abstract interfaces are expected.
Follows SRP: handles ONLY the construction of Gemini objects.
"""

from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from app.config import Settings
from app.interfaces.embedder import IEmbedder
from app.interfaces.llm_provider import ILLMProvider


class GeminiProvider(ILLMProvider):
    """Builds and caches a ChatGoogleGenerativeAI instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @lru_cache(maxsize=1)  # type: ignore[misc]
    def get_llm(self) -> ChatGoogleGenerativeAI:
        return ChatGoogleGenerativeAI(
            model=self._settings.gemini_model,
            google_api_key=self._settings.google_api_key,
            temperature=0.3,
            convert_system_message_to_human=True,
        )


class GeminiEmbedder(IEmbedder):
    """Builds and caches a GoogleGenerativeAIEmbeddings instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @lru_cache(maxsize=1)  # type: ignore[misc]
    def get_embeddings(self) -> GoogleGenerativeAIEmbeddings:
        return GoogleGenerativeAIEmbeddings(
            model=self._settings.gemini_embed_model,
            google_api_key=self._settings.google_api_key,
        )
