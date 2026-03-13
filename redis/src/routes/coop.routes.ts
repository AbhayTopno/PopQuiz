import { Router, type Request, type Response } from 'express';
import type { RedisServiceFacade } from '../facade/RedisServiceFacade.js';
import type { CoopMember } from '../repositories/CoopRepository.js';

export const createCoopRouter = (facade: RedisServiceFacade): Router => {
  const router = Router();

  // ─── Score ────────────────────────────────────────────────────────────────

  router.get('/:id/score', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ score: await facade.getCoopScore(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.put('/:id/score', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const { score } = req.body as { score: number };
      await facade.setCoopScore(id, score);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // MUST be before /:id/score GET to avoid ambiguity — uses POST so it's fine
  router.post('/:id/score/increment', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const { points } = req.body as { points: number };
      res.json({ newScore: await facade.incrementCoopScore(id, points) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // ─── Members ──────────────────────────────────────────────────────────────

  router.get('/:id/members', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ members: await facade.getCoopMembers(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.put('/:id/members', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const { members } = req.body as { members: CoopMember[] };
      await facade.setCoopMembers(id, members);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post('/:id/members', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const member = req.body as CoopMember;
      const members = await facade.addCoopMember(id, member);
      res.status(201).json({ members });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
};
