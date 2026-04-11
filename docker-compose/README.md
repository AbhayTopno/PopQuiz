# PopQuiz — Docker Compose

Three ready-to-use compose files for running the entire PopQuiz stack locally. Pick the one that matches your workflow.

---

## Which file should I use?

| File | When to use | Builds from | Hot reload? |
|------|-------------|-------------|-------------|
| `dev.yml` | Day-to-day development | Source code (`Dockerfile.dev`) | Yes |
| `staging.yml` | Test production builds locally | Production `Dockerfile` | No |
| `production.yml` | Deploy pre-built images | Docker Hub images | No |

---

## Service Architecture

All three compose files spin up the same 5 services:

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                                                             │
│  ┌───────────┐    ┌───────────┐    ┌───────────────┐        │
│  │ Frontend  │───►│  Backend  │───►│   LangChain   │        │
│  │ :3000     │    │  :5000    │    │   :8000       │        │
│  │ (Next.js) │    │ (Express) │    │   (FastAPI)   │        │
│  └───────────┘    └─────┬─────┘    └───────┬───────┘        │
│                         │                  │                │
│                    ┌────▼────┐        ┌────▼────┐           │
│                    │  Redis  │        │  Qdrant │           │
│                    │  :6379  │        │  :6333  │           │
│                    └─────────┘        └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Service dependency chain

```
Frontend  → depends on → Backend
Backend   → depends on → Redis, LangChain
LangChain → depends on → Qdrant
```

Docker Compose starts them in the right order automatically.

---

## Quick Start (Development)

### 1. Set up environment files

From the `docker-compose/` directory:

```bash
# Backend
cp .env.example.backend.development .env.backend

# Frontend
cp .env.example.frontend.development .env.frontend

# LangChain
cp .env.example.langchain .env.langchain
```

Then edit `.env.langchain` and add your **Google AI Studio API key** (free at [aistudio.google.com](https://aistudio.google.com/)).

> **Important**: `.env` files must NOT have quotes around values.
> - `GOOGLE_API_KEY=AIza...` — correct
> - `GOOGLE_API_KEY='AIza...'` — **wrong**, the quotes become part of the value

Edit `.env.backend` and add your **MongoDB URI** (MongoDB Atlas free tier or local instance).

### 2. Start everything

```bash
docker compose -f dev.yml up --build
```

### 3. Open in browser

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| LangChain API | http://localhost:8000 |
| LangChain Docs | http://localhost:8000/docs |
| Qdrant Dashboard | http://localhost:6333/dashboard |

### 4. Develop

Edit source files in `backend/`, `frontend/`, or `langchain/` — changes are reflected immediately thanks to volume mounts and hot-reload.

### 5. Stop

```bash
docker compose -f dev.yml down
```

Add `-v` to also wipe volumes (Qdrant data, node_modules):

```bash
docker compose -f dev.yml down -v
```

---

## Environment Files Reference

### Backend (`.env.backend`)

| Variable | Dev default | Production | Description |
|----------|-------------|------------|-------------|
| `MONGO_URI` | — | — | MongoDB connection string (required) |
| `PORT` | `5000` | `5000` | Server port |
| `NODE_ENV` | `development` | `production` | Express environment |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://your-domain.com` | Allowed CORS origin |
| `JWT_SECRET` | — | — | JWT signing secret (min 32 chars) |
| `COOKIE_SECURE` | `false` | `true` | HTTPS-only cookies |
| `REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | Redis connection URL |
| `LANGCHAIN_SERVICE_URL` | `http://langchain:8000` | `http://langchain:8000` | LangChain service URL |

> Inside Docker, use service names (`redis`, `langchain`) as hostnames — Docker DNS resolves them automatically.

### Frontend (`.env.frontend`)

| Variable | Dev default | Description |
|----------|-------------|-------------|
| `NODE_ENV` | `development` | App environment |
| `NEXT_PUBLIC_API_URL` | `http://backend:5000` | API URL (client-side) |
| `NEXT_PUBLIC_SOCKET_URL` | `http://backend:5000` | Socket.IO URL (client-side) |
| `INTERNAL_API_URL` | `http://backend:5000` | API URL (server-side rendering) |

### LangChain (`.env.langchain`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | — | Google AI Studio API key (required) |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | Gemini model for quiz generation |
| `GEMINI_EMBED_MODEL` | `models/embedding-001` | Embedding model for RAG |
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant vector store URL |
| `HOST` | `0.0.0.0` | FastAPI bind host |
| `PORT` | `8000` | FastAPI bind port |
| `ALLOWED_ORIGINS_STR` | `http://localhost:3000,...` | Comma-separated CORS origins |
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | — | LangSmith API key (optional) |
| `LANGCHAIN_PROJECT` | `popquiz-langchain` | LangSmith project name |

---

## Staging

Builds from production Dockerfiles but runs locally — useful for testing the final Docker image before pushing:

```bash
# Set up env files (use production templates)
cp .env.example.backend .env.backend
cp .env.example.frontend .env.frontend
cp .env.example.langchain .env.langchain
# Fill in real values...

docker compose -f staging.yml up --build
```

---

## Production

Uses pre-built images from Docker Hub (`abhaytopno/popquiz-*`). No build step needed:

```bash
docker compose -f production.yml up -d
```

To update to newer images:

```bash
docker compose -f production.yml pull
docker compose -f production.yml up -d
```

---

## Common Commands

```bash
# View logs (all services)
docker compose -f dev.yml logs -f

# View logs (single service)
docker compose -f dev.yml logs -f backend

# Restart a single service
docker compose -f dev.yml restart backend

# Rebuild a single service (after adding new dependencies)
docker compose -f dev.yml up --build backend

# Shell into a running container
docker compose -f dev.yml exec backend sh

# Check what's running
docker compose -f dev.yml ps
```

---

## Troubleshooting

### Port already in use

Another process is using ports 3000/5000/6379/6333/8000. Either stop the conflicting process or change the port mapping in the compose file:

```yaml
ports:
  - '4001:5000'  # maps host:4001 → container:5000
```

### MongoDB connection refused

MongoDB is **not** included in Docker Compose — it needs to be running externally (Atlas, local install, or add a mongo service to the compose file). Make sure `MONGO_URI` in `.env.backend` points to a reachable MongoDB instance.

### LangChain service fails to start

Usually means `GOOGLE_API_KEY` is missing or invalid in `.env.langchain`. Check with:

```bash
docker compose -f dev.yml logs langchain
```

### Frontend can't reach backend (CORS errors)

Verify that `CORS_ORIGIN` in `.env.backend` matches the origin the browser is using (e.g., `http://localhost:3000`).

### Changes not reflecting (dev mode)

Make sure you're using `dev.yml` — only this file has volume mounts for hot-reload. If you changed `package.json` or `pyproject.toml`, you need to rebuild:

```bash
docker compose -f dev.yml up --build
```

### Redis connection error in backend logs

Redis container might still be starting. The backend retries automatically (exponential backoff). If it persists, check:

```bash
docker compose -f dev.yml exec redis redis-cli ping
# Should output: PONG
```
