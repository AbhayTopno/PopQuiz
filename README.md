# PopQuiz - AI-Powered Quiz Hosting Platform

![PopQuiz Banner](https://img.shields.io/badge/PopQuiz-AI%20Quiz%20Hosting-7e22ce?style=for-the-badge&logo=appveyor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

PopQuiz lets you **generate and host interactive quizzes on any topic using Google Gemini AI**. Upload a PDF or type a topic -- the AI creates a quiz in seconds. Then host it in a multiplayer room with real-time scoring over WebSockets.

---

## Key Features

- **AI Quiz Generation** -- provide a topic or upload a PDF/DOCX, pick difficulty and count, get a quiz instantly
- **Multiplayer Rooms** -- 1v1, 2v2, co-op, free-for-all, and custom arena modes with live scoring
- **RAG Pipeline** -- upload documents and generate quizzes grounded in your content (LangChain + Qdrant)
- **Real-time** -- Socket.IO for live game events, chat, scores, and team assignments
- **Cloud-Native** -- Kubernetes manifests (base, blue-green, canary, Helm), Terraform for GCP
- **Dockerized** -- one-command setup with 3 compose profiles (dev, staging, production)
- **LangSmith Observability** -- optional tracing for the AI pipeline

---

## Architecture

```
+---------------+       +--------------+       +------------------+
|   Frontend    |<----->|   Backend    |<----->|    LangChain     |
|  (Next.js)    | REST  |  (Express)   | REST  |    (FastAPI)     |
|  :3000        | + WS  |  :5000       |       |    :8000         |
+---------------+       +------+-------+       +--------+---------+
                               |                        |
                    +----------+---------+        +-----v----+
                    |          |         |        |  Qdrant  |
               +----v---+ +---v----+     |        |  :6333   |
               |MongoDB | | Redis  |     |        +----------+
               |(Atlas) | | :6379  |     |
               +--------+ +--------+     |
                                         |
                                    +----v--------+
                                    |  LangSmith  |
                                    |  (optional) |
                                    +-------------+
```

| Service | Role | Port |
|---------|------|------|
| **Frontend** | Next.js 15 UI -- quiz creation, multiplayer lobbies, game screens | 3000 |
| **Backend** | Express 5 API -- auth, quiz CRUD, Socket.IO rooms, Redis state | 5000 |
| **LangChain** | FastAPI -- Gemini LLM, topic chains, RAG pipeline, Qdrant vectors | 8000 |
| **Redis** | In-memory store for rooms, players, scores, chat, teams | 6379 |
| **Qdrant** | Vector database for RAG document embeddings | 6333 |
| **MongoDB** | Persistent storage for users and quizzes (external -- Atlas or local) | 27017 |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) ![GSAP](https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white) |
| **Backend** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) ![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white) |
| **AI / ML** | ![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white) ![Google Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white) ![Qdrant](https://img.shields.io/badge/Qdrant-DC382D?style=for-the-badge) |
| **Database** | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) |
| **Infra** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white) ![Helm](https://img.shields.io/badge/Helm-0F1689?style=for-the-badge&logo=helm&logoColor=white) ![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white) ![GCP](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) |
| **Observability** | ![LangSmith](https://img.shields.io/badge/LangSmith-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white) |
| **Package Manager** | ![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white) ![uv](https://img.shields.io/badge/uv-DE5FE9?style=for-the-badge&logo=uv&logoColor=white) |

---

## Project Structure

```
PopQuiz/
+-- frontend/          # Next.js 15 frontend (TypeScript, TailwindCSS, GSAP)
+-- backend/           # Express 5 API + Socket.IO (TypeScript)
+-- langchain/         # FastAPI AI service (LangChain, Gemini, Qdrant)
+-- docker-compose/    # dev.yml, staging.yml, production.yml + env templates
+-- k8s/               # Kubernetes manifests
|   +-- base/          # Standard deployment
|   +-- blue-green/    # Blue-green deployment
|   +-- canary/        # Canary deployment
|   +-- helm/          # Helm chart (popquiz-chart)
|   +-- autoscaling/   # HPA, VPA, cluster autoscaler
+-- terraform/         # GCP infrastructure (GKE cluster, VPC, IAM)
```

> Each sub-folder has its own README with detailed setup instructions.

---

## Quick Start (Docker)

The fastest way to get everything running:

### 1. Clone and set up env files

```bash
git clone https://github.com/your-username/popquiz.git
cd popquiz/docker-compose

# Copy env templates
cp .env.example.backend.development .env.backend
cp .env.example.frontend.development .env.frontend
cp .env.example.langchain .env.langchain
```

### 2. Fill in required values

Edit `.env.backend`:
```env
MONGO_URI=mongodb://localhost:27017/popquiz
JWT_SECRET=your-random-secret-key-at-least-32-characters
```

Edit `.env.langchain`:
```env
GOOGLE_API_KEY=your_google_ai_studio_key   # free at https://aistudio.google.com/
```

> **No quotes around values** in `.env` files. `KEY=value` not `KEY='value'`.

### 3. Start all services

```bash
docker compose -f dev.yml up --build
```

### 4. Open

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| LangChain Swagger | http://localhost:8000/docs |
| Qdrant Dashboard | http://localhost:6333/dashboard |

See the [docker-compose README](docker-compose/README.md) for staging, production, and troubleshooting.

---

## Quick Start (Without Docker)

### Prerequisites

- Node.js v22+ and pnpm v10+ (`npm install -g pnpm`)
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- MongoDB (local or Atlas)
- Redis

### Backend

```bash
cd backend
pnpm install
cp .env.example .env    # edit with your values
pnpm dev                # -> http://localhost:4000
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env    # edit with your values
pnpm dev                # -> http://localhost:3000
```

### LangChain service

```bash
cd langchain
uv sync
cp .env.example .env    # add GOOGLE_API_KEY
uv run uvicorn app.main:app --reload --port 8000
```

---

## Kubernetes Deployment

PopQuiz ships with production-ready K8s manifests in the `popquiz` namespace. All resources follow `popquiz-{service}` naming.

### Deployment strategies

| Strategy | Command | Use case |
|----------|---------|----------|
| **Base** | `kubectl apply -f k8s/base/` | Simple single-version deploy |
| **Blue-Green** | `kubectl apply -f k8s/blue-green/` | Instant rollback, zero-downtime |
| **Canary** | `kubectl apply -f k8s/canary/` | Gradual traffic shift (90/10 -> 100) |
| **Helm** | `helm install popquiz k8s/helm/popquiz-chart/` | Templated, parameterised deploys |

### What's included

- HPA (Horizontal Pod Autoscaler) -- scale on CPU/memory
- VPA (Vertical Pod Autoscaler) -- right-size resource requests
- Cluster Autoscaler -- scale GKE node pool
- NGINX Ingress with WebSocket support
- Security contexts and resource limits on all pods

See the [k8s README](k8s/README.md) and [GKE guide](k8s/GKE.md) for full details.

---

## Terraform Infrastructure

Provisions a GKE cluster on Google Cloud:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in project ID, region, etc.
terraform init
terraform plan
terraform apply
```

Provisions: GKE cluster, VPC, firewall rules, service accounts, IAM roles. See the [terraform README](terraform/README.md).

---

## Contributing

We welcome contributions. Here is the workflow:

### 1. Fork and branch

```bash
git clone https://github.com/your-username/popquiz.git
cd popquiz
git checkout -b feature/your-feature-name
```

### 2. Make your changes

Follow existing patterns. Each service has its own linting rules.

### 3. Run checks before committing

**Backend and Frontend (Node.js services):**

```bash
cd backend   # or cd frontend
pnpm check   # runs ESLint + Prettier check
```

**LangChain (Python):**

```bash
cd langchain
uv run ruff check .
```

> `pnpm check` **must pass** before you push. The CI pipeline will reject PRs with lint or formatting errors.

### 4. Commit and push

```bash
git add .
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

### Branch naming conventions

| Prefix | Purpose |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |

---

## API Key Notes

- A **Google AI Studio** API key is required for quiz generation (free at [aistudio.google.com](https://aistudio.google.com/))
- Never commit `.env` files -- they are in `.gitignore`
- If a key is leaked, revoke it immediately from the [Google AI Studio console](https://aistudio.google.com/)

---

## Sub-project Documentation

| Folder | README |
|--------|--------|
| Backend | [backend/README.md](backend/README.md) |
| Frontend | [frontend/README.md](frontend/README.md) |
| LangChain | [langchain/README.md](langchain/README.md) |
| Docker Compose | [docker-compose/README.md](docker-compose/README.md) |
| Kubernetes | [k8s/README.md](k8s/README.md) |
| Terraform | [terraform/README.md](terraform/README.md) |

---

## License

[MIT](LICENSE)