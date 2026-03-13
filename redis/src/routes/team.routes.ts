import { Router, type Request, type Response } from 'express';
import type { RedisServiceFacade } from '../facade/RedisServiceFacade.js';
import type { TeamAssignment } from '../types/index.js';

export const createTeamRouter = (facade: RedisServiceFacade): Router => {
  const router = Router({ mergeParams: true });

  // ─── Username-based assignments (MUST be before /:tid to avoid conflict) ──

  router.put('/usernames', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await facade.setTeamAssignmentsByUsername(id, req.body as TeamAssignment);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/usernames', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ assignments: await facade.getTeamAssignmentsByUsername(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // ─── Socket-ID based assignments ─────────────────────────────────────────

  router.put('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      await facade.setTeamAssignments(id, req.body as TeamAssignment);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      res.json({ assignments: await facade.getTeamAssignments(id) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // ─── Shared team scores (2v2 / custom) ───────────────────────────────────

  router.put('/:tid/score', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const teamId = req.params['tid'] as 'teamA' | 'teamB';
      const { score } = req.body as { score: number };
      await facade.setTeamScore(id, teamId, score);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.get('/:tid/score', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const teamId = req.params['tid'] as 'teamA' | 'teamB';
      res.json({ score: await facade.getTeamScore(id, teamId) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  router.post('/:tid/score/increment', async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const teamId = req.params['tid'] as 'teamA' | 'teamB';
      const { points } = req.body as { points: number };
      res.json({ newScore: await facade.incrementTeamScore(id, teamId, points) });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  return router;
};
