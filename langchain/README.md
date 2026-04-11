# PopQuiz LangChain AI Service

The FastAPI + LangChain microservice that powers all quiz generation in PopQuiz. Give it a topic, a PDF, or an image -- it returns a structured quiz using Google Gemini AI.

---

## Architecture Overview

```
                    Backend (Express)
                         |
                    POST /api/v1/*
                         |
                         v
                  +------+------+
                  |   FastAPI   |
                  |   Router    |
                  +------+------+
                         |
                         v
                  +------+------+
                  | QuizService |   <-- picks the right chain
                  +------+------+
                    /    |     \
                   v     v      v
           +-------+ +-----+ +-------+
           | Topic | | RAG | | Image |
           | Chain | |Chain| | Chain |
           +---+---+ +--+--+ +---+---+
               |         |        |
               v         v        v
           +-------+ +-------+ +-------+
           |Gemini | |Qdrant | |Gemini |
           | LLM   | |Vector | |Vision |
           +-------+ |Store  | +-------+
                      +-------+
```

### How each chain works

**Topic Chain** -- the simple path:
```
"Black holes, hard, 5 questions"
        |
        v
  Persona prompt (easy/medium/hard)
  + JSON format instruction
        |
        v
  Gemini LLM call
        |
        v
  JSON parser (extract_quiz_json)
        |
        v
  { questions: [...] }
```

**RAG Chain** -- the document path:
```
  PDF/DOCX upload
        |
        v
  Stage 1: Load (PyPDFLoader / Docx2txtLoader)
        |
        v
  Stage 2: Split (RecursiveCharacterTextSplitter, 800 chars)
        |
        v
  Stage 3: Embed + Store (Qdrant ephemeral collection)
        |
        v
  Stage 4: Retrieve (vector similarity, fallback to lexical)
        |
        v
  Stage 5: Generate (Gemini with retrieved context)
        |
        v
  Cleanup (delete ephemeral Qdrant collection)
        |
        v
  { questions: [...] }
```

**Image Chain** -- the vision path:
```
  PNG/JPEG/WEBP upload
        |
        v
  Base64 encode image
        |
        v
  Gemini multimodal call (text + image_url)
        |
        v
  JSON parser
        |
        v
  { questions: [...] }
```

---

## Project Structure

```
langchain/
+-- app/
|   +-- main.py                  # FastAPI app factory + lifespan (wiring only)
|   +-- config.py                # Settings via pydantic-settings (.env)
|   +-- models.py                # Request/response Pydantic schemas
|   |
|   +-- interfaces/              # Abstract contracts (OCP, DIP)
|   |   +-- llm_provider.py      # ILLMProvider -- any LLM must implement this
|   |   +-- embedder.py          # IEmbedder -- any embedder must implement this
|   |   +-- vectorstore.py       # IVectorStoreProvider -- any vector DB
|   |
|   +-- providers/               # Concrete implementations (LSP)
|   |   +-- gemini_provider.py   # GeminiProvider + GeminiEmbedder
|   |   +-- qdrant_provider.py   # QdrantVectorStoreProvider (ephemeral collections)
|   |
|   +-- chains/                  # Business logic -- one chain per generation mode
|   |   +-- topic_chain.py       # Topic -> quiz (prompt + LLM)
|   |   +-- rag_chain.py         # Document -> quiz (load, split, embed, retrieve, generate)
|   |   +-- image_chain.py       # Image -> quiz (multimodal Gemini)
|   |
|   +-- services/
|   |   +-- quiz_service.py      # Orchestrator -- delegates to the right chain
|   |
|   +-- routers/
|   |   +-- quiz.py              # HTTP layer only -- no business logic
|   |
|   +-- utils/
|       +-- parser.py            # JSON extraction from raw LLM output
|
+-- docker/
|   +-- Dockerfile               # Multi-stage production build
|   +-- Dockerfile.dev           # Development with hot-reload
|
+-- .env.example                 # Environment variable template
+-- pyproject.toml               # Dependencies and project metadata
+-- uv.lock                      # Locked dependency versions
```

---

## API Reference

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/generate` | JSON: `{ topic, difficulty, count }` | Generate quiz from a topic |
| POST | `/api/v1/rag-generate` | Multipart: `file` + `difficulty` + `count` + `topic?` | Generate quiz from PDF/DOCX/image |
| GET | `/api/v1/health` | -- | Health check |
| GET | `/docs` | -- | Swagger UI (interactive API docs) |
| GET | `/redoc` | -- | ReDoc (alternative API docs) |

### POST `/api/v1/generate`

Generate a quiz from a topic string.

**Request:**
```json
{
  "topic": "Black holes",
  "difficulty": "hard",
  "count": 5
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `topic` | string | Yes | min 2 characters |
| `difficulty` | string | No | `easy`, `medium`, or `hard` (default: `medium`) |
| `count` | int | No | 1-20 (default: 5) |

**Response (200):**
```json
{
  "questions": [
    {
      "question": "What is the boundary around a black hole called?",
      "options": ["A: Photon sphere", "B: Event horizon", "C: Schwarzschild radius", "D: Singularity"],
      "answer": "B: Event horizon"
    }
  ]
}
```

### POST `/api/v1/rag-generate`

Generate a quiz from an uploaded file (PDF, DOCX, or image).

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF, DOCX, PNG, JPEG, or WEBP |
| `difficulty` | string | No | `easy`, `medium`, or `hard` (default: `medium`) |
| `count` | int | No | 1-20 (default: 5) |
| `topic` | string | No | Optional hint to focus questions on a subtopic |

```bash
# PDF example
curl -X POST http://localhost:8000/api/v1/rag-generate \
  -F "file=@chapter3.pdf" \
  -F "difficulty=medium" \
  -F "count=5"

# Image example
curl -X POST http://localhost:8000/api/v1/rag-generate \
  -F "file=@diagram.png" \
  -F "difficulty=easy" \
  -F "count=3" \
  -F "topic=cell biology"
```

**Supported file types:**

| Type | Extensions | How it works |
|------|-----------|-------------|
| PDF | `.pdf` | Text extraction -> chunking -> vector search -> LLM |
| Word | `.docx`, `.doc` | Text extraction -> chunking -> vector search -> LLM |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp` | Gemini multimodal vision -> LLM |

---

## SOLID Design Explained

The codebase follows SOLID principles so you can swap out any component without touching the rest:

```
                       +---------------------+
                       |    ILLMProvider      |  <-- abstract
                       +---------------------+
                       | + get_llm() -> LLM  |
                       +----------+----------+
                                  |
                    +-------------+-------------+
                    |                           |
            +-------+--------+         +-------+--------+
            | GeminiProvider |         | (Future: GPT)  |
            +----------------+         +----------------+

                       +---------------------+
                       |     IEmbedder       |  <-- abstract
                       +---------------------+
                       | + get_embeddings()  |
                       +----------+----------+
                                  |
                    +-------------+-------------+
                    |                           |
            +-------+--------+         +-------+--------+
            | GeminiEmbedder |         | (Future: Ada)  |
            +----------------+         +----------------+

                       +---------------------+
                       | IVectorStoreProvider |  <-- abstract
                       +---------------------+
                       | + build(docs)       |
                       | + cleanup(store)    |
                       +----------+----------+
                                  |
                    +-------------+-----------------+
                    |                               |
            +-------+---------+         +-----------+-------+
            | QdrantProvider  |         | (Future: Pinecone)|
            +-----------------+         +-------------------+
```

**Why this matters:**
- **Open/Closed Principle** -- add a new LLM (GPT-4, Claude) by creating one file. Zero changes to chains.
- **Dependency Inversion** -- chains depend on `ILLMProvider`, not on `GeminiProvider` directly.
- **Single Responsibility** -- each file does one thing: `parser.py` parses, `topic_chain.py` generates topic quizzes, `quiz.py` handles HTTP.

---

## Local Setup

### Prerequisites

- **Python** >= 3.12
- **[uv](https://docs.astral.sh/uv/)** (`pip install uv`) -- fast Python package manager
- **Google Gemini API key** -- free at [aistudio.google.com](https://aistudio.google.com/)
- **Qdrant** -- only needed for RAG (document upload) features

### Step 1: Install dependencies

```bash
cd langchain
uv sync
```

### Step 2: Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
GOOGLE_API_KEY=your_google_ai_studio_key_here    # required
GEMINI_MODEL=gemini-3-flash-preview               # or gemini-3.1-pro-preview
GEMINI_EMBED_MODEL=models/embedding-001
QDRANT_URL=http://localhost:6333                   # only for RAG features
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS_STR=http://localhost:3000,http://localhost:5000
```

> **No quotes around values.** `GOOGLE_API_KEY=AIza...` not `GOOGLE_API_KEY='AIza...'`

### Step 3: Start Qdrant (optional -- only for document/image uploads)

```bash
docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant:v1.17.1
```

### Step 4: Run the dev server

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the Swagger UI.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | Yes | -- | Google AI Studio API key |
| `GEMINI_MODEL` | Yes | -- | Gemini model name (e.g. `gemini-3-flash-preview`) |
| `GEMINI_EMBED_MODEL` | Yes | -- | Embedding model (e.g. `models/embedding-001`) |
| `QDRANT_URL` | Yes | -- | Qdrant server URL |
| `HOST` | Yes | -- | FastAPI bind host |
| `PORT` | Yes | -- | FastAPI bind port |
| `ALLOWED_ORIGINS_STR` | Yes | -- | Comma-separated CORS origins |
| `LANGCHAIN_TRACING_V2` | No | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | No | `""` | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | `popquiz-langchain` | LangSmith project name |
| `LANGCHAIN_ENDPOINT` | No | `https://api.smith.langchain.com` | LangSmith endpoint |

---

## Docker

### Standalone

```bash
docker build -f docker/Dockerfile -t popquiz-langchain:latest .

docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your_key \
  -e GEMINI_MODEL=gemini-3-flash-preview \
  -e GEMINI_EMBED_MODEL=models/embedding-001 \
  -e QDRANT_URL=http://host.docker.internal:6333 \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  -e ALLOWED_ORIGINS_STR=http://localhost:3000 \
  popquiz-langchain:latest
```

### Full stack (with Docker Compose)

```bash
cd docker-compose
cp .env.example.langchain .env.langchain
# Edit .env.langchain with your GOOGLE_API_KEY

docker compose -f dev.yml up --build
```

See [docker-compose/README.md](../docker-compose/README.md) for details.

### Dockerfile breakdown

The production Dockerfile uses a multi-stage build:

```
Stage 1 (builder):
  python:3.12-slim
  -> install uv
  -> install dependencies into .venv

Stage 2 (runtime):
  python:3.12-slim
  -> copy .venv from builder (no build tools in final image)
  -> copy app/ source code
  -> run uvicorn
```

---

## LangSmith Tracing (Optional)

LangSmith gives you full visibility into every LLM call, chain step, and token count.

### Setup

1. Create a free account at [smith.langchain.com](https://smith.langchain.com/)
2. Generate an API key
3. Add to your `.env`:

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_xxxxx
LANGCHAIN_PROJECT=popquiz-langchain
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

When the server starts you will see:
```
LangSmith tracing enabled -> project: popquiz-langchain
```

All chain runs (topic generation, RAG pipeline, image analysis) appear in your LangSmith dashboard with full traces, latencies, and token usage.

> To disable, set `LANGCHAIN_TRACING_V2=false` or remove the env vars.

---

## How It Connects to the Backend

The Express backend calls this service via HTTP. The flow:

```
Frontend
   |
   | POST /api/quiz/generate
   v
Backend (quiz.controller.ts)
   |
   | validates input
   v
quiz.service.ts
   |
   | calls aiService.ts
   v
aiService.ts
   |
   | POST http://langchain:8000/api/v1/generate
   | or   http://langchain:8000/api/v1/rag-generate
   v
This service (FastAPI)
   |
   | QuizService -> TopicChain / RAGChain / ImageChain
   v
Gemini AI generates quiz
   |
   | JSON response
   v
Backend saves to MongoDB
   |
   v
Frontend displays quiz
```

Inside Docker, the backend reaches this service at `http://langchain:8000` (Docker DNS).
Without Docker, the backend uses `LANGCHAIN_SERVICE_URL` from its `.env` (typically `http://localhost:8000`).

---

## Before You Push -- Pre-commit Checklist

```bash
# Format and lint check
uv run ruff check .
uv run ruff format --check .
```

**Auto-fix formatting:**
```bash
uv run ruff format .
```

**Auto-fix lint issues:**
```bash
uv run ruff check . --fix
```

> These must pass before pushing. The CI pipeline runs the same checks.

---

## Key Design Decisions

### Why ephemeral Qdrant collections?

Each RAG request creates a temporary collection (`rag_{uuid}`), embeds the document chunks, retrieves relevant ones, then deletes the collection. This means:
- No data persistence between requests -- each upload is independent
- No stale embeddings from old documents
- No collection management or naming conflicts

### Why lexical fallback in RAG?

If vector retrieval fails (Qdrant down, embedding errors), the RAG chain falls back to lexical/keyword matching against the document chunks. This ensures a quiz is always generated even when the vector store is unavailable.

### Why `extract_quiz_json` instead of LangChain output parsers?

LLMs sometimes wrap JSON in markdown fences or add commentary. The parser strips fences, finds the outermost `{...}`, and validates the `questions` array. This is more resilient than strict structured output parsing.

### Why separate chains instead of one big function?

Each chain (`TopicChain`, `RAGChain`, `ImageChain`) is a self-contained class. `QuizService` picks the right one. Adding a new generation mode (e.g. "quiz from YouTube video") means adding one new chain file -- zero changes to existing code.

---

## Switching LLM Provider

To swap Gemini for another model (GPT-4, Claude, etc.):

1. Create `app/providers/openai_provider.py` implementing `ILLMProvider`
2. In `main.py`, replace `GeminiProvider(settings)` with your new class
3. Update `config.py` with the new provider's env vars
4. Zero changes to any chain -- they depend only on `ILLMProvider`

---

## Production Considerations

| Concern | Recommendation |
|---------|---------------|
| LLM model | Switch `GEMINI_MODEL` to `gemini-3.1-pro-preview` for higher quality |
| Vector store | Consider Qdrant auth and snapshots for production |
| Auth | Add an API key header check in the router middleware |
| Scaling | Service is stateless -- scale horizontally behind a load balancer |
| Observability | Enable LangSmith tracing (see above) |
| Rate limiting | Add FastAPI rate limiting middleware for public deployments |