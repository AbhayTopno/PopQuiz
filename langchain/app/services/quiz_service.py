"""
QuizService — orchestrates the two chain types.
Follows SRP: this class decides WHICH chain to invoke; chains handle HOW.
Follows DIP: depends on ILLMProvider and IEmbedder, not on concrete providers.
"""

from app.chains.rag_chain import RAGChain
from app.chains.topic_chain import TopicChain
from app.interfaces.embedder import IEmbedder
from app.interfaces.llm_provider import ILLMProvider
from app.models import QuizQuestion, QuizResponse


class QuizService:
    """High-level service that delegates to the appropriate chain."""

    def __init__(self, llm_provider: ILLMProvider, embedder: IEmbedder) -> None:
        self._topic_chain = TopicChain(llm_provider)
        self._rag_chain = RAGChain(llm_provider, embedder)

    async def generate_from_topic(
        self, topic: str, difficulty: str, count: int
    ) -> QuizResponse:
        """Generate a quiz purely from a text topic."""
        raw = await self._topic_chain.run(topic, difficulty, count)
        return self._to_response(raw)

    async def generate_from_document(
        self,
        file_bytes: bytes,
        filename: str,
        difficulty: str,
        count: int,
    ) -> QuizResponse:
        """Generate a RAG-grounded quiz from an uploaded document."""
        raw = await self._rag_chain.run(file_bytes, filename, difficulty, count)
        return self._to_response(raw)

    # ── Private ────────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(raw: dict) -> QuizResponse:
        """Map raw LLM dict to the validated QuizResponse schema."""
        questions = [
            QuizQuestion(
                question=q["question"],
                options=q["options"],
                answer=q["answer"],
            )
            for q in raw["questions"]
        ]
        return QuizResponse(questions=questions)
