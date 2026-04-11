# PopQuiz Frontend

The Next.js 15 frontend for PopQuiz. A cinematic, animation-rich quiz hosting UI with real-time multiplayer rooms, GSAP animations, and Socket.IO integration.

---

## Architecture Overview

```
+-------------------+       +-------------------+       +------------------+
|     Browser       |       |   Next.js (SSR)   |       |     Backend      |
|                   | <---> |   :3000           | <---> |   (Express)      |
|  React + GSAP     |       |   layout.tsx      |       |   :5000          |
|  Socket.IO Client |       |   Server Comps    |       |   REST + WS      |
+-------------------+       +-------------------+       +------------------+
```

### How the pages connect

```
Landing Page (page.tsx)
    |
    +-> Navbar (auth popups: login/signup/profile)
    +-> Hero (animated intro, "Generate Quiz" CTA)
    +-> Features (game mode cards -> quiz generation popup)
    +-> About / Story / Contact / Footer
    |
    v
QuizPopup (topic/file upload, difficulty, count)
    |
    | POST /api/quiz/generate
    v
Waiting Room (/waiting-room?roomId=...)
    |
    +-> Chat (real-time messages)
    +-> Player list (join/leave/kick)
    +-> Settings (topic, difficulty, timer)
    +-> Team management (2v2 mode: drag-drop)
    |
    | Host clicks "Start"
    v
Arena Pages (game modes):
    /1v1arena    -> 1v1 competitive
    /2v2arena    -> 2v2 team battle
    /cooparena   -> cooperative
    /customarena -> custom rules
    /ffaarena    -> free-for-all
    /quiz/[id]   -> solo quiz
    |
    +-> Live questions with timer bar
    +-> Real-time score updates (Socket.IO)
    +-> Compact leaderboard
    |
    v
Game Over -> Final leaderboard
```

### How multiplayer flows (Socket.IO)

```
Player opens app
      |
      v
AuthContext loads user from localStorage + verifies via /api/auth/me
      |
      v
getSocket() creates singleton Socket.IO client
      (auth: JWT from localStorage)
      |
      v
useSocketConnection() hook manages connect/disconnect
      |
      v
useWaitingRoomSocket() -> room events (join, leave, kick, settings, chat)
      |
      v
useArenaSocket() / useCoopSocket() / useFFASocket() / useTeamArenaSocket()
      -> game events (start, submit-answer, score-update, game-finished)
```

---

## Project Structure

```
frontend/
+-- src/
|   +-- app/
|   |   +-- layout.tsx            # Root layout (AuthProvider, runtime env config)
|   |   +-- page.tsx              # Landing page (Hero, Features, About, etc.)
|   |   +-- globals.css           # Global styles + GSAP + Tailwind
|   |   |
|   |   +-- waiting-room/
|   |   |   +-- page.tsx          # Server component (reads query params)
|   |   |   +-- WaitingRoom.tsx   # Client component (Socket.IO, chat, settings)
|   |   |
|   |   +-- 1v1arena/
|   |   |   +-- page.tsx          # 1v1 competitive mode
|   |   |   +-- ArenaClient.tsx   # Game logic + UI
|   |   +-- 2v2arena/             #  (same pattern)
|   |   +-- cooparena/            #  CoopArenaClient.tsx
|   |   +-- customarena/          #  CustomArenaClient.tsx
|   |   +-- ffaarena/             #  FFAArenaClient.tsx
|   |   +-- quiz/[roomName]/      #  Solo quiz (SSR fetches quiz data)
|   |       +-- page.tsx
|   |       +-- QuizClient.tsx
|   |
|   +-- components/
|   |   +-- Navbar.tsx            # Top nav with auth/profile/join-room popups
|   |   +-- Hero.tsx              # Animated landing hero (GSAP)
|   |   +-- About.tsx             # About section with tilt cards
|   |   +-- Features.tsx          # Game mode cards (1v1, 2v2, coop, etc.)
|   |   +-- Story.tsx             # Parallax story section
|   |   +-- Contact.tsx           # Contact section
|   |   +-- Footer.tsx            # Footer with links
|   |   +-- AuthPopup.tsx         # Login/signup modal
|   |   +-- ProfilePopup.tsx      # Profile edit modal
|   |   +-- QuizPopup.tsx         # Quiz generation form (topic/file/difficulty)
|   |   +-- JoinRoomPopup.tsx     # Join existing room modal
|   |   +-- AnimatedTitle.tsx     # GSAP-animated text
|   |   +-- Button.tsx            # Reusable animated button
|   |   +-- VideoPreview.tsx      # Video/image preview component
|   |   +-- TimerBar.tsx          # Animated countdown bar for quiz questions
|   |   +-- CompactLeaderboard.tsx # In-game score display
|   |   +-- waiting-room/
|   |       +-- ChatBox.tsx       # Real-time chat
|   |       +-- PlayersList.tsx   # Player list with kick controls
|   |       +-- SettingsPanel.tsx # Quiz settings (host only)
|   |       +-- SettingsDrawer.tsx # Mobile settings drawer
|   |       +-- TeamManagement.tsx # 2v2 drag-and-drop team builder
|   |       +-- StartButton.tsx   # Start game (validates teams/settings)
|   |       +-- CountdownOverlay.tsx # 3-2-1 countdown before game
|   |       +-- KickConfirmModal.tsx  # Confirm player kick
|   |       +-- KickedMessageModal.tsx # "You were kicked" message
|   |
|   +-- contexts/
|   |   +-- AuthContext.tsx       # Auth state (login, signup, logout, profile)
|   |
|   +-- hooks/
|   |   +-- useSocketConnection.ts   # Singleton socket connect/disconnect
|   |   +-- arena/
|   |   |   +-- useArenaSocket.ts    # 1v1 game events
|   |   |   +-- useTeamArenaSocket.ts # 2v2 game events
|   |   |   +-- useCoopSocket.ts     # Co-op game events
|   |   |   +-- useFFASocket.ts      # Free-for-all game events
|   |   +-- quiz/
|   |   |   +-- useQuizState.ts      # Quiz question navigation state
|   |   |   +-- useQuizTimer.ts      # Per-question countdown timer
|   |   +-- waiting-room/
|   |       +-- useWaitingRoomSocket.ts # Room management events
|   |
|   +-- lib/
|   |   +-- config.ts            # Runtime URL resolution (SSR vs client)
|   |
|   +-- types/
|   |   +-- index.ts             # All TypeScript interfaces (253 lines)
|   |
|   +-- utils/
|       +-- socket.ts            # Socket.IO singleton factory
|       +-- gameModes.ts         # Game mode routing config
|       +-- scoring.ts           # Score calculation (base x difficulty x time bonus)
|
+-- public/
|   +-- audio/loop.mp3           # Background music
|   +-- fonts/                   # Custom fonts (zentry, general, robert, circular-web)
|   +-- img/                     # Landing page assets
|
+-- docker/
|   +-- Dockerfile               # Multi-stage production build (standalone)
|   +-- Dockerfile.dev           # Development with hot-reload
|
+-- .env.example
+-- package.json
+-- tsconfig.json
+-- next.config.ts
+-- tailwind.config.js
+-- eslint.config.mjs
+-- prettier.config.js
+-- postcss.config.js
```

---

## Game Modes

| Mode | Route | Players | Description |
|------|-------|---------|-------------|
| **Solo** | `/quiz/[quizId]` | 1 | Play alone, no Socket.IO needed |
| **1v1** | `/1v1arena` | 2 | Head-to-head competitive |
| **2v2** | `/2v2arena` | 4 | Team battle (drag-drop team assignment) |
| **Co-op** | `/cooparena` | 2+ | Collaborative -- shared score |
| **FFA** | `/ffaarena` | 2+ | Free-for-all competitive |
| **Custom** | `/customarena` | 2+ | Custom rules and settings |

Each mode has its own arena client component and socket hook that handle mode-specific events.

---

## Scoring System

```
Score = Base Points x Difficulty Multiplier x Time Bonus

Base Points: 100 per correct answer

Difficulty Multipliers:
  Easy:   1.0x  (100 pts max base)
  Medium: 1.5x  (150 pts max base)
  Hard:   2.0x  (200 pts max base)

Time Bonus: 1.0x to 2.0x
  Answered instantly -> 2.0x
  Time ran out      -> 1.0x

Max possible per question:
  Easy:   200 pts (100 x 1.0 x 2.0)
  Medium: 300 pts (100 x 1.5 x 2.0)
  Hard:   400 pts (100 x 2.0 x 2.0)
```

---

## Local Setup

### Prerequisites

- **Node.js** v22+ (LTS recommended)
- **pnpm** v10+ (`npm install -g pnpm`)
- The backend must be running for API and Socket.IO

### Step 1: Install dependencies

```bash
cd frontend
pnpm install
```

### Step 2: Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> `NEXT_PUBLIC_API_URL` is the backend URL. If running the backend locally without Docker, it defaults to `http://localhost:5000`.

### Step 3: Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000. The landing page loads with GSAP animations. You need the backend running to use auth, quiz generation, or multiplayer.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5000` | Backend API URL (client-side) |
| `NEXT_PUBLIC_SOCKET_URL` | No | Same as API URL | Socket.IO server URL |
| `INTERNAL_API_URL` | No | Same as API URL | Backend URL for SSR (server-side rendering) |
| `API_URL` | No | Same as API URL | Fallback API URL |
| `SOCKET_URL` | No | Same as API URL | Fallback Socket.IO URL |

### How URL resolution works

The app resolves API/Socket URLs differently on server vs client:

```
Server-side (SSR):
  INTERNAL_API_URL -> API_URL -> NEXT_PUBLIC_API_URL -> localhost:5000

Client-side (browser):
  window.__ENV__.API_URL -> NEXT_PUBLIC_API_URL -> localhost:5000
  + auto-rewrites internal hostnames (backend, localhost) to window.location.hostname
```

This means the same Docker image works in any environment without rebuilding -- the layout injects `window.__ENV__` at render time.

---

## Scripts Reference

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server with hot-reload |
| `pnpm build` | Production build (outputs standalone) |
| `pnpm start` | Run production build (`next start`) |
| `pnpm lint` | ESLint on all source files (zero warnings allowed) |
| `pnpm format:check` | Prettier format check |
| `pnpm check` | Run both lint + format check (use before committing!) |

---

## Before You Push -- Pre-commit Checklist

Always run this before committing:

```bash
pnpm check
```

This runs `pnpm lint` (ESLint, zero warnings) and `pnpm format:check` (Prettier) in sequence. If either fails, fix the issues before pushing.

**Auto-fix formatting:**
```bash
pnpm prettier --write "src/**/*.{js,jsx,ts,tsx,json,md,css,scss}"
```

**Auto-fix lint issues (where possible):**
```bash
pnpm eslint "src/**/*.{js,jsx,ts,tsx}" --fix
```

---

## Docker

### Production Dockerfile

Multi-stage build using Next.js standalone output:

```
Stage 1 (builder):
  node:22-alpine
  -> pnpm install --frozen-lockfile
  -> pnpm run build (generates .next/standalone)

Stage 2 (runtime):
  node:22-alpine
  -> copy standalone server + static assets + public
  -> node server.js
```

Final image has no pnpm, no node_modules, no source code -- just the compiled standalone server.

### Dev Dockerfile

Single-stage with hot-reload:
```
node:22-alpine -> pnpm install -> pnpm run dev
```

Used by `docker-compose/dev.yml` with volume mounts for live editing.

---

## Key Design Decisions

### Why `window.__ENV__` instead of just `NEXT_PUBLIC_*`?

`NEXT_PUBLIC_*` variables are baked in at build time. In Docker/K8s, you want to change API URLs without rebuilding the image. The root layout injects runtime env vars into `window.__ENV__`, and `lib/config.ts` reads from there on the client side.

### Why a singleton socket?

`utils/socket.ts` creates one Socket.IO connection per browser tab. All hooks (`useArenaSocket`, `useWaitingRoomSocket`, etc.) share the same socket instance. This prevents duplicate connections and ensures events are not missed.

### Why separate arena hooks per game mode?

Each mode has different Socket.IO events and state management:
- 1v1 tracks opponent score
- 2v2 tracks team scores and team assignments
- Co-op has a shared score pool
- FFA tracks all players independently

Separate hooks keep each mode self-contained and testable.

### Why GSAP instead of CSS animations?

The landing page uses timeline-based animations (scroll-triggered reveals, parallax, tilt effects) that need frame-level control. GSAP provides `ScrollTrigger`, `useGSAP` hook, and GPU-accelerated transforms that CSS alone cannot coordinate.

### Why custom fonts from `/public/fonts/`?

The landing page uses a game-inspired design with custom typefaces (zentry, robert, circular-web). These are loaded via `@font-face` in `globals.css` and registered in `tailwind.config.js` for use as utility classes (`font-zentry`, `font-robert-medium`, etc.).