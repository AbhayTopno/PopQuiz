import { Router, type Request, type Response } from 'express';
import type { RedisServiceFacade } from '../facade/RedisServiceFacade.js';
import type { Player } from '../types/index.js';

export const createPlayerRouter = (facade: RedisServiceFacade): Router => {
  const router = Router({ mergeParams: true });

  // MUST be before /:pid to avoid conflict
  router.get('/count', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ count: await facade.getPlayerCount(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ players: await facade.getAllPlayers(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await facade.addPlayer(id, req.body as Player);
      res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/:pid', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const pid = req.params['pid'] as string;
      const player = await facade.getPlayer(id, pid);
      if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
      res.json({ player });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.patch('/:pid/score', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const pid = req.params['pid'] as string;
      const { score } = req.body as { score: number };
      await facade.updatePlayerScore(id, pid, score);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.patch('/:pid', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const pid = req.params['pid'] as string;
      await facade.updatePlayer(id, pid, req.body as Partial<Player>);
      res.json({ success: true });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      res.status(500).json({ error: msg });
    }
  });

  router.delete('/:pid', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const pid = req.params['pid'] as string;
      await facade.removePlayer(id, pid);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
};
