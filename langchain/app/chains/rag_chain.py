"""
RAG-based quiz generation chain.
"""

import re
import tempfile
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.vectorstores import VectorStore

from app.interfaces.llm_provider import ILLMProvider
from app.interfaces.vectorstore import IVectorStoreProvider
from app.utils.parser import extract_quiz_json

_RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a professional quiz master.

Rules:
1) If material_status is "present", use ONLY the provided document context as syllabus.
    Do NOT use outside knowledge.
2) If topic_hint is provided and material_status is "present", prioritize content relevant
    to topic_hint, but still stay strictly within the context.
3) If material_status is "missing", the uploaded material has no readable text.
    In that case, generate a random general-knowledge quiz.

Material status: {material_status}
Topic hint: {topic_hint}

Context:
{context}

Generate exactly {count} '{difficulty}' difficulty quiz questions based on the
context above. Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "questions": [
    {{
      "question": "Question text",
      "options": ["A: Answer A", "B: Answer B", "C: Answer C", "D: Answer D"],
      "answer": "B: Answer B"
    }}
  ]
}}""",
        ),
        ("human", "Generate the quiz now."),
    ]
)

_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)


class RAGChain:
    """
    Orchestrates the full RAG pipeline for custom document-based quiz generation.
    Pipeline: Load → Split → Embed → Retrieve → Generate.
    """

    def __init__(self, llm_provider: ILLMProvider, vs_provider: IVectorStoreProvider) -> None:
        self._llm = llm_provider.get_llm()
        self._vs_provider = vs_provider

    # ── Stage 1: Load ──────────────────────────────────────────────────────────

    def _load_documents(self, file_bytes: bytes, filename: str) -> list[Document]:
        """Detect file type and load with the appropriate LangChain loader."""
        suffix = Path(filename).suffix.lower()

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        if suffix == ".pdf":
            loader = PyPDFLoader(tmp_path)
        elif suffix in (".docx", ".doc"):
            loader = Docx2txtLoader(tmp_path)
        else:
            raise ValueError(
                f"Unsupported file type '{suffix}'. Supported: .pdf, .docx"
            )

        docs = loader.load()
        Path(tmp_path).unlink(missing_ok=True)
        return docs

    # ── Stage 2: Split ─────────────────────────────────────────────────────────

    def _split(self, documents: list[Document]) -> list[Document]:
        return _SPLITTER.split_documents(documents)

    # ── Stage 3: Embed + Store (ephemeral Qdrant collection) ───────────────────

    def _build_vectorstore(self, chunks: list[Document]) -> VectorStore:
        return self._vs_provider.build(chunks)

    # ── Stage 4: Retrieve ──────────────────────────────────────────────────────

    def _retrieve(self, vectorstore: VectorStore, query: str, k: int = 4) -> list[Document]:
        retriever = vectorstore.as_retriever(search_kwargs={"k": k})
        return retriever.invoke(query)

    def _retrieve_lexical(
        self, chunks: list[Document], query: str, k: int = 4
    ) -> list[Document]:
        """
        Fallback retrieval when embedding models are unavailable.
        Uses lightweight token overlap scoring.
        """
        query_tokens = {
            t for t in re.findall(r"[a-zA-Z0-9]+", query.lower()) if len(t) > 2
        }

        scored: list[tuple[int, int, Document]] = []
        for index, doc in enumerate(chunks):
            text = (doc.page_content or "").lower()
            if not text.strip():
                continue

            if not query_tokens:
                score = 0
            else:
                score = sum(1 for token in query_tokens if token in text)

            scored.append((score, -index, doc))

        if not scored:
            return []

        scored.sort(reverse=True)
        top = [doc for _, _, doc in scored[:k]]
        return top or chunks[:k]

    @staticmethod
    def _build_query(topic: str | None) -> str:
        hint = (topic or "").strip()
        if hint:
            return f"quiz questions about {hint} based strictly on document text"
        return "quiz questions based strictly on document text"

    @staticmethod
    def _is_meaningful_text(value: str) -> bool:
        cleaned = re.sub(r"\s+", " ", value).strip()
        return len(cleaned) >= 40 and bool(re.search(r"[A-Za-z0-9]", cleaned))

    # ── Stage 5: Generate ──────────────────────────────────────────────────────

    async def _generate(
        self,
        context: str,
        difficulty: str,
        count: int,
        topic: str | None,
        material_status: str,
    ) -> dict:
        chain = _RAG_PROMPT | self._llm
        response = await chain.ainvoke(
            {
                "context": context,
                "difficulty": difficulty,
                "count": count,
                "topic_hint": (topic or "").strip() or "none",
                "material_status": material_status,
            }
        )
        raw_text: str = (
            response.content if hasattr(response, "content") else str(response)
        )
        return extract_quiz_json(raw_text)

    # ── Public entry point ─────────────────────────────────────────────────────

    async def run(
        self,
        file_bytes: bytes,
        filename: str,
        difficulty: str,
        count: int,
        topic: str | None = None,
    ) -> dict:
        """Execute the full RAG pipeline and return structured quiz JSON."""
        docs = self._load_documents(file_bytes, filename)
        chunks = self._split(docs)
        query = self._build_query(topic)

        if not chunks:
            return await self._generate(
                context="",
                difficulty=difficulty,
                count=count,
                topic=topic,
                material_status="missing",
            )

        relevant: list[Document]
        vectorstore: VectorStore | None = None
        try:
            vectorstore = self._build_vectorstore(chunks)
            relevant = self._retrieve(vectorstore, query)
        except Exception:
            relevant = self._retrieve_lexical(chunks, query)
        finally:
            if vectorstore is not None:
                try:
                    self._vs_provider.cleanup(vectorstore)
                except Exception:
                    pass  # best-effort cleanup

        context = "\n\n".join(doc.page_content for doc in relevant if doc.page_content)
        if not context.strip():
            context = "\n\n".join(
                doc.page_content for doc in chunks[:4] if doc.page_content
            )

        material_status = "present" if self._is_meaningful_text(context) else "missing"

        return await self._generate(
            context=context,
            difficulty=difficulty,
            count=count,
            topic=topic,
            material_status=material_status,
        )
