"""
RAG-based quiz generation chain.
Follows SRP: each method handles exactly one stage of the RAG pipeline.
Follows DIP: depends on ILLMProvider and IEmbedder abstractions.
"""

import io
import tempfile
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

from app.interfaces.embedder import IEmbedder
from app.interfaces.llm_provider import ILLMProvider
from app.utils.parser import extract_quiz_json

_RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a professional quiz master. Use ONLY the following context extracted
from a document to create a quiz. Do NOT use outside knowledge.

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

    def __init__(self, llm_provider: ILLMProvider, embedder: IEmbedder) -> None:
        self._llm = llm_provider.get_llm()
        self._embeddings = embedder.get_embeddings()

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

    # ── Stage 3: Embed + Store (ephemeral, in-memory) ──────────────────────────

    def _build_vectorstore(self, chunks: list[Document]) -> Chroma:
        return Chroma.from_documents(chunks, embedding=self._embeddings)

    # ── Stage 4: Retrieve ──────────────────────────────────────────────────────

    def _retrieve(self, vectorstore: Chroma, k: int = 4) -> list[Document]:
        retriever = vectorstore.as_retriever(search_kwargs={"k": k})
        return retriever.invoke("quiz questions based on document content")

    # ── Stage 5: Generate ──────────────────────────────────────────────────────

    async def _generate(
        self, relevant_docs: list[Document], difficulty: str, count: int
    ) -> dict:
        context = "\n\n".join(doc.page_content for doc in relevant_docs)
        chain = _RAG_PROMPT | self._llm
        response = await chain.ainvoke(
            {"context": context, "difficulty": difficulty, "count": count}
        )
        raw_text: str = (
            response.content if hasattr(response, "content") else str(response)
        )
        return extract_quiz_json(raw_text)

    # ── Public entry point ─────────────────────────────────────────────────────

    async def run(
        self, file_bytes: bytes, filename: str, difficulty: str, count: int
    ) -> dict:
        """Execute the full RAG pipeline and return structured quiz JSON."""
        docs = self._load_documents(file_bytes, filename)
        chunks = self._split(docs)
        vectorstore = self._build_vectorstore(chunks)
        relevant = self._retrieve(vectorstore)
        return await self._generate(relevant, difficulty, count)
