# PopQuiz Backend

The Express.js + TypeScript API server that powers PopQuiz. Handles authentication, quiz CRUD, AI generation (via the LangChain microservice), and real-time multiplayer rooms over WebSockets.

---

## Architecture Overview

```
┌───────────────┐       ┌──────────────┐       ┌──────────────┐
│   Frontend    │◄─────►│   Backend    │◄─────►│  LangChain   │
│  (Next.js)    │ REST  │  (Express)   │ REST  │  (FastAPI)   │
│  :3000        │ + WS  │  :5000       │       │  :8000       │
└───────────────┘       └──────┬───────┘       └──────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               ┌────▼───┐  ┌───▼────┐ ┌───▼────┐
               │MongoDB │  │ Redis  │ │ Qdrant │
               │(Atlas) │  │ :6379  │ │ :6333  │
               └────────┘  └────────┘ └────────┘
```

### How a quiz request flows

```
User clicks "Generate Quiz"
        │
        ▼
  Frontend (POST /api/quiz/generate)
        │
        ▼
  Backend — quiz.controller.ts
    validates input (difficulty, count, topic/file)
        │
        ▼
  quiz.service.ts
    calls aiService.ts
        │
        ▼
  aiService.ts
    forwards to LangChain microservice
    (POST http://langchain:8000/api/v1/generate)
        │
        ▼
  LangChain returns quiz JSON
        │
        ▼
  quiz.service.ts
    maps AI response → Mongoose schema
    saves to MongoDB
        │
        ▼
  Returns { quizId, savedQuiz } to frontend
```

### How multiplayer works (Socket.IO)

```
Player A                    Backend (Socket.IO)              Player B
   │                              │                              │
   ├──── create-room ────────────►│                              │
   │◄─── room-created ────────────┤                              │
   │                              │◄──── join-room ──────────────┤
   │◄─── player-joined ───────────┤──── player-joined ──────────►│
   │                              │                              │
   ├──── start-game ─────────────►│                              │
   │◄─── game-started ────────────┤──── game-started ───────────►│
   │                              │                              │
   ├──── submit-answer ──────────►│                              │
   │◄─── score-update ────────────┤──── score-update ───────────►│
   │                              │                              │
   │◄─── game-finished ───────────┤──── game-finished ──────────►│
```

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Entry point — starts HTTP + Socket.IO server
│   ├── app.ts                   # Express app — CORS, JSON parser, routes
│   │
│   ├── config/
│   │   ├── db.ts                # MongoDB (Mongoose) connection
│   │   └── redis.ts             # Redis (ioredis) connection + helpers
│   │
│   ├── models/
│   │   ├── user.ts              # User schema (email, username, bcrypt hash)
│   │   └── quiz.ts              # Quiz schema (topic, difficulty, questions[])
│   │
│   ├── routes/
│   │   ├── userRoutes.ts        # /api/auth/* — signup, login, logout, profile
│   │   └── quizRoutes.ts        # /api/quiz/* — generate, CRUD
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts   # Handles auth HTTP requests
│   │   └── quiz.controller.ts   # Handles quiz HTTP requests
│   │
│   ├── services/
│   │   ├── auth.service.ts      # Signup/login business logic (bcrypt)
│   │   ├── user.service.ts      # Profile updates, user lookups
│   │   ├── quiz.service.ts      # Quiz CRUD + AI generation orchestrator
│   │   ├── aiService.ts         # HTTP client → LangChain microservice
│   │   ├── socketio.ts          # Socket.IO server initialization
│   │   └── redis/
│   │       ├── index.ts         # Barrel export
│   │       ├── redis.constants.ts  # Key prefixes & TTLs
│   │       ├── room.redis.service.ts    # Room lifecycle (create/delete/cleanup)
│   │       ├── player.redis.service.ts  # Player state in rooms
│   │       ├── chat.redis.service.ts    # In-game chat history
│   │       ├── leaderboard.redis.service.ts  # Score tracking
│   │       └── team.redis.service.ts    # 2v2 team assignments
│   │
│   ├── sockets/
│   │   └── handlers/
│   │       ├── room.handler.ts   # create-room, join-room, leave-room
│   │       ├── game.handler.ts   # start-game, submit-answer, game-finished
│   │       ├── chat.handler.ts   # send-message (in-room chat)
│   │       └── team.handler.ts   # 2v2 team assignment events
│   │
│   ├── middlewares/
│   │   ├── asyncHandler.ts       # Wraps async route handlers (error catching)
│   │   ├── authMiddleware.ts     # JWT verification (protect, admin)
│   │   ├── rateLimiter.ts        # express-rate-limit configs
│   │   └── socketAuthMiddleware.ts  # JWT verification for Socket.IO
│   │
│   ├── types/
│   │   └── index.ts              # Shared interfaces (Player, Room, etc.)
│   │
│   └── utils/
│       └── createToken.ts        # JWT generation helper
│
├── docker/
│   ├── Dockerfile                # Multi-stage production build
│   └── Dockerfile.dev            # Development with hot-reload
│
├── .env.example                  # Template for environment variables
├── package.json
├── tsconfig.json
├── eslint.config.ts
└── prettier.config.cjs
```

---

## API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/auth/signup` | No | 5/15min | Create account |
| POST | `/api/auth/login` | No | 5/15min | Login, returns JWT |
| POST | `/api/auth/logout` | No | — | Logout |
| GET | `/api/auth/me` | Bearer | 100/15min | Get current user |
| PUT | `/api/auth/profile` | Bearer | 100/15min | Update username/password |
| GET | `/api/auth/getUser/:id` | No | 100/15min | Get user by ID |
| GET | `/api/auth/getAllUsers` | No | 100/15min | List all users |

### Quiz (`/api/quiz`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/quiz/generate` | No | AI-generate quiz (topic JSON or file upload) |
| POST | `/api/quiz/` | Admin | Manually create a quiz |
| GET | `/api/quiz/:id` | No | Get quiz by ID |
| PUT | `/api/quiz/:id` | Admin | Update quiz |
| DELETE | `/api/quiz/:id` | Admin | Delete quiz |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `create-room` | Client → Server | Create a multiplayer room |
| `join-room` | Client → Server | Join an existing room |
| `leave-room` | Client → Server | Leave current room |
| `player-joined` | Server → Clients | Broadcast when someone joins |
| `start-game` | Client → Server | Host starts the game |
| `game-started` | Server → Clients | Broadcast game start |
| `submit-answer` | Client → Server | Submit answer for a question |
| `score-update` | Server → Clients | Broadcast updated scores |
| `game-finished` | Server → Clients | Broadcast final results |
| `send-message` | Client → Server | Send chat message in room |
| `new-message` | Server → Clients | Broadcast chat message |

---

## Local Setup

### Prerequisites

- **Node.js** v22+ (LTS recommended)
- **pnpm** v10+ (`npm install -g pnpm`)
- **MongoDB** — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier works)
- **Redis** — local instance or cloud (e.g., [Upstash](https://upstash.com/))

### Step 1: Install dependencies

```bash
cd backend
pnpm install
```

### Step 2: Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/popquiz     # or your Atlas connection string
JWT_SECRET=your_jwt_secret_here                 # min 32 characters, keep it random
NODE_ENV=development
REDIS_URL=redis://localhost:6379
LANGCHAIN_SERVICE_URL=http://localhost:8000      # LangChain microservice URL
CORS_ORIGIN=http://localhost:3000                # Frontend URL
```

### Step 3: Run the dev server

```bash
pnpm dev
```

The server starts at `http://localhost:4000` with hot-reload via `tsx watch`.

---

## Scripts Reference

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server with hot-reload (`tsx watch`) |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run production build (`node dist/index.js`) |
| `pnpm lint` | Run ESLint on all source files |
| `pnpm format:check` | Check Prettier formatting |
| `pnpm check` | Run both lint + format check (use before committing!) |

---

## Before You Push — Pre-commit Checklist

Always run this before committing:

```bash
pnpm check
```

This runs `pnpm lint` (ESLint) and `pnpm format:check` (Prettier) in sequence. If either fails, fix the issues before pushing.

**To auto-fix formatting:**
```bash
pnpm prettier --write "src/**/*.{js,ts,json,md}"
```

**To auto-fix lint issues (where possible):**
```bash
pnpm eslint "src/**/*.{js,ts}" --fix
```

---

## Key Design Decisions

### Why a separate LangChain microservice?

The AI logic (prompts, RAG pipeline, embeddings, vector store) lives in a Python FastAPI service ([langchain/](../langchain/)). The backend simply forwards requests via `aiService.ts`. This separation means:

- **Independent scaling** — AI service can scale separately from the API
- **Language flexibility** — Python's ML ecosystem is far richer than Node's
- **Hot-swappable** — swap Gemini for GPT-4 or Claude without touching the backend

### Why Redis for rooms instead of MongoDB?

- **Speed** — room state changes on every answer submission (sub-millisecond reads)
- **TTL** — rooms auto-expire after 24 hours, no manual cleanup needed
- **Pub/Sub ready** — Redis supports pub/sub for future multi-instance Socket.IO scaling

### Why `asyncHandler` instead of try/catch everywhere?

The `asyncHandler` wrapper catches rejected promises from async route handlers and forwards errors to Express's error pipeline. Without it, unhandled rejections would crash the process or silently fail.

---

## Security

- **Passwords** hashed with `bcryptjs` (10 salt rounds)
- **JWT** tokens in Bearer header, 7-day expiry
- **Rate limiting** on auth routes (5 req/15min) and API routes (100 req/15min)
- **CORS** whitelist from `CORS_ORIGIN` env var
- **Socket.IO auth** — JWT verified on connection handshake
- **File uploads** capped at 10MB via `multer`
- **Input validation** in controllers before hitting services
