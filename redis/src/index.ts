import 'dotenv/config';
import express from 'express';
import { connectRedis } from './config/redis.js';
import { createFacade } from './facade/RedisServiceFacade.js';
import { createRoomRouter } from './routes/room.routes.js';
import { createPlayerRouter } from './routes/player.routes.js';
import { createChatRouter } from './routes/chat.routes.js';
import { createTeamRouter } from './routes/team.routes.js';
import { createCoopRouter } from './routes/coop.routes.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function bootstrap(): Promise<void> {
  // Initialise Redis connection
  await connectRedis();

  // Wire repositories → facade
  const facade = createFacade();

  const app = express();
  app.use(express.json());

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const ok = await facade.healthCheck();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error' });
  });

  // ─── Leaderboard (convenience route outside /rooms/:id/players) ───────────
  app.get('/rooms/:id/leaderboard', async (req, res) => {
    try {
      const leaderboard = await facade.getLeaderboard(req.params.id);
      res.json({ leaderboard });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ─── Room lifecycle (all modes) ───────────────────────────────────────────
  app.use('/rooms', createRoomRouter(facade));

  // ─── Players (1v1, 2v2, FFA, coop, custom) ───────────────────────────────
  app.use('/rooms/:id/players', createPlayerRouter(facade));

  // ─── Chat (all modes) ─────────────────────────────────────────────────────
  app.use('/rooms/:id/chat', createChatRouter(facade));

  // ─── Teams (2v2, custom) ─────────────────────────────────────────────────
  app.use('/rooms/:id/teams', createTeamRouter(facade));

  // ─── Co-op (coop mode only) ───────────────────────────────────────────────
  app.use('/coop', createCoopRouter(facade));

  app.listen(PORT, () => {
    console.log(`🚀 Redis Microservice running on http://localhost:${PORT}`);
    console.log(`   Modes supported: 1v1 · 2v2 · FFA · Coop · Custom`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start Redis Microservice:', err);
  process.exit(1);
});
