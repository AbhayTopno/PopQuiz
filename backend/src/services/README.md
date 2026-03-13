# Services Overview

This document explains how the real-time services in this directory work together to power PopQuiz multiplayer game modes.

## `redisService.ts`

The Redis service is the persistence layer for transient multiplayer state. It wraps a shared Redis client and exposes typed helpers for rooms, players, chat, leaderboards, and team metadata.

### Key Responsibilities

- **Room lifecycle**: create, fetch, and delete room metadata (`room:*`) with TTL enforcement to clean up inactive rooms automatically.
- **Player state**: add/update/remove player snapshots per room (`players:*`) and keep leaderboard scores in sorted sets (`leaderboard:*`).
- **Chat history**: maintain ordered message streams in Redis lists (`chat:*`) while trimming to the most recent 100 messages.
- **Team coordination**: store both socket-based and username-based team assignments (`team-assignments:*`, `team_usernames:*`) as well as shared team scores (`team-score:*`).
- **Housekeeping**: list active rooms, count players, and periodically prune rooms that have been empty for more than five minutes.

### Notable Details

- **TTL management**: room-wide keys expire after 24 hours, ensuring stale data is discarded even if cleanup jobs fail.
- **Type conversions**: data saved in Redis is stringified; helper methods handle parsing and casting back to `Room`, `Player`, and `ChatMessage` shapes.
- **Leaderboard**: scores are stored in a sorted set per room, enabling rapid rank queries via `zrevrange`.
- **Team scores**: cooperative modes increment shared team counters atomically to avoid race conditions when multiple players submit answers concurrently.

## `socketio.ts`

The Socket.IO service wires the HTTP server into real-time multiplayer features. It authenticates sockets, enforces CORS, and marshals user actions to the Redis layer.

### Initialization

- Builds a permissive or whitelisted CORS validator based on `CORS_ORIGIN`.
- Configures Socket.IO with websocket/polling transports, heartbeat settings, and JWT-aware middleware (`socketAuthMiddleware`).
- Starts an hourly cleanup task that delegates to `redisService.cleanupEmptyRooms()`.

### Core Connection Flow

1. **Room join**: validates capacity, creates rooms on demand via `redisService.createRoom()`, stores the player snapshot, and emits the current room state (players, chat history, team assignments, and game flags).
2. **State broadcast**: most socket handlers follow the pattern of reading data from Redis, mutating it, and emitting the updated state to the current room (e.g., `player-joined`, `chat-message`, `score-update-broadcast`).
3. **Disconnection handling**: on `disconnect`, the service walks all rooms to remove the departing player, updates counts, and shares system notifications.

### Gameplay Modes & Events

- **Shared utilities**: readiness toggles, answer submissions, question progression, quiz completion, typing indicators, reactions, and kicking players.
- **1v1 Versus**: countdowns, incremental score updates, and duel completion logic that checks both players' readiness before announcing winners.
- **2v2 Arena**: maintains team assignments across reconnects (socket IDs + usernames), syncs shared team scores, and ensures teammates advance questions together.
- **Custom Mode**: extends 2v2 mechanics to flexible team sizes up to ten players per room.
- **Co-op Mode**: stores progress markers via helper functions (`getCoopData`/`setCoopData`) and coordinates shared timers and scoring across the entire group.
- **Free-For-All (FFA)**: manages per-player scoring, completion broadcasts, and real-time leaderboards for larger lobbies.

### Collaboration with `redisService`

- Every event handler reads or writes through the Redis helpers to keep socket state stateless across node instances.
- Player and room data remain durable during reconnects, enabling features like username-based team persistence.
- Shared scoring uses atomic Redis operations (`incrby`, sorted sets) to maintain consistency when multiple sockets emit simultaneously.

## Development Tips

- When adding a new game mode, start by designing the Redis key schema in `redisService.ts`, then create matching socket events that call into those helpers.
- Keep emitted payloads minimal; the room join flow already hydrates clients with the complete state snapshot.
- If you add new Redis structures, remember to include them in `deleteRoom()` so stale data is purged when rooms close.
