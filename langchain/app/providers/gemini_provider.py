"""
Concrete Gemini implementation of ILLMProvider and IEmbedder.
"""

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from app.config import Settings
from app.interfaces.embedder import IEmbedder
from app.interfaces.llm_provider import ILLMProvider


class GeminiProvider(ILLMProvider):
    """Builds and caches a ChatGoogleGenerativeAI instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._llm = None

    def get_llm(self) -> ChatGoogleGenerativeAI:
        if self._llm is None:
            self._llm = ChatGoogleGenerativeAI(
                model=self._settings.gemini_model,
                google_api_key=self._settings.google_api_key,
                temperature=0.3,
                convert_system_message_to_human=True,
            )
        return self._llm


class GeminiEmbedder(IEmbedder):
    """Builds and caches a GoogleGenerativeAIEmbeddings instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._embeddings = None

    @staticmethod
    def _resolve_embedding_model(model_name: str) -> str:
        """Normalize known-invalid model names to a broadly supported fallback."""
        normalized = model_name.strip()
        fallback_model = "models/embedding-001"

        alias_map = {
            "text-embedding-004": fallback_model,
            "models/text-embedding-004": fallback_model,
            "gemini-embedding-001": fallback_model,
            "models/gemini-embedding-001": fallback_model,
        }

        return alias_map.get(normalized, normalized or fallback_model)

    def get_embeddings(self) -> GoogleGenerativeAIEmbeddings:
        if self._embeddings is None:
            resolved_model = self._resolve_embedding_model(
                self._settings.gemini_embed_model
            )
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model=resolved_model,
                google_api_key=self._settings.google_api_key,
            )
        return self._embeddings
