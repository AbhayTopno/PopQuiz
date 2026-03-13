import { Router, type Request, type Response } from 'express';
import type { RedisServiceFacade } from '../facade/RedisServiceFacade.js';
import type { ChatMessage } from '../types/index.js';

export const createChatRouter = (facade: RedisServiceFacade): Router => {
  const router = Router({ mergeParams: true });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await facade.addChatMessage(id, req.body as ChatMessage);
      res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/recent', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const count = req.query['count'] ? parseInt(req.query['count'] as string, 10) : 50;
      res.json({ messages: await facade.getRecentChatMessages(id, count) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ messages: await facade.getChatMessages(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
};
