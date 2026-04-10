# ─────────────────────────────────────────────────────────────────────────────
# PopQuiz LangChain AI Service
# FastAPI + LangChain microservice — topic-based and RAG quiz generation
# Uses Google Gemini (free tier) for LLM and embeddings
# ─────────────────────────────────────────────────────────────────────────────

## Overview

Two endpoints:
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/generate` | POST | Quiz from a topic (JSON body) |
| `/api/v1/rag-generate` | POST | Quiz from uploaded PDF/DOCX (multipart) |
| `/api/v1/health` | GET | Health check |
| `/docs` | GET | Swagger UI |

## Architecture (SOLID)

```
app/
├── main.py                      # FastAPI wiring (app factory + lifespan)
├── config.py                    # Settings — pydantic-settings (SRP)
├── models.py                    # Request/response schemas (SRP)
├── interfaces/
│   ├── llm_provider.py          # ILLMProvider — abstract (OCP, DIP)
│   └── embedder.py              # IEmbedder — abstract (OCP, DIP)
├── providers/
│   └── gemini_provider.py       # GeminiProvider, GeminiEmbedder (LSP)
├── chains/
│   ├── topic_chain.py           # Topic quiz LCEL chain (SRP)
│   └── rag_chain.py             # RAG pipeline: load→split→embed→retrieve→generate (SRP)
├── services/
│   └── quiz_service.py          # Orchestrator — picks the right chain (SRP, DIP)
├── routers/
│   └── quiz.py                  # HTTP layer only — no business logic (SRP)
└── utils/
    └── parser.py                # JSON extraction from LLM output (SRP)
```

## Prerequisites

- Python ≥ 3.12
- [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- A free **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/)

## Local Setup

```bash
# 1. Clone into the repo root (already done if you're here)
cd langchain

# 2. Create .env from template
cp .env.example .env
# Edit .env and set GOOGLE_API_KEY=your_key_here

# 3. Install dependencies
uv sync

# 4. Run the dev server
uv run uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> to see the Swagger UI.

## Example Requests

### Topic-based quiz
```bash
curl -X POST http://localhost:8000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Black holes", "difficulty": "hard", "count": 5}'
```

### RAG quiz from PDF
```bash
curl -X POST http://localhost:8000/api/v1/rag-generate \
  -F "file=@/path/to/your/document.pdf" \
  -F "difficulty=medium" \
  -F "count=5"
```

## Docker (Standalone)

```bash
# Build
docker build -t popquiz-langchain:latest .

# Run
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your_key \
  popquiz-langchain:latest
```

## Docker Compose (Full Stack)

```bash
# From the docker-compose/ directory — create .env.langchain first
cp .env.example ../docker-compose/.env.langchain

# Then spin up everything
docker compose -f docker-compose/dev.yml up --build
```

## Production Considerations

| Concern | Recommendation |
|---|---|
| LLM model | Switch `GEMINI_MODEL` to `gemini-1.5-pro` for higher quality |
| Vector store | Qdrant runs in Docker with persistent volume — consider auth and snapshots for production |
| Auth | Add an API key header check in the router middleware |
| Scaling | The service is stateless — scale horizontally behind a load balancer |
| Observability | Add LangSmith tracing: set `LANGCHAIN_API_KEY` + `LANGCHAIN_TRACING_V2=true` |

## Switching LLM Provider (for the future)

1. Add a new file `app/providers/openai_provider.py` implementing `ILLMProvider`
2. In `main.py`, replace `GeminiProvider` with your new class
3. Zero other changes needed — chains depend only on the interface.
