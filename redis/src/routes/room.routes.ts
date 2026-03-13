import { Router, type Request, type Response } from 'express';
import type { RedisServiceFacade } from '../facade/RedisServiceFacade.js';

export const createRoomRouter = (facade: RedisServiceFacade): Router => {
  const router = Router();

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomId, quizId, createdAt, mode } = req.body as {
        roomId: string; quizId: string; createdAt: number; mode?: string;
      };
      await facade.createRoom({ roomId, quizId, createdAt, mode });
      res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({ roomIds: await facade.getAllRoomIds() });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post('/cleanup', async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({ cleaned: await facade.cleanupEmptyRooms() });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const room = await facade.getRoom(id);
      if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
      res.json({ room });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/:id/exists', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ exists: await facade.roomExists(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const { gameStarted, gameFinished } = req.body as { gameStarted?: boolean; gameFinished?: boolean };
      await facade.updateRoomStatus(id, { gameStarted, gameFinished });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await facade.deleteRoom(id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
};
