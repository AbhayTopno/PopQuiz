import express from 'express';
import multer from 'multer';
import {
  generateAndSaveQuiz,
  createQuiz,
  deleteQuiz,
  getQuizById,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/generate', apiLimiter, upload.single('file'), generateAndSaveQuiz);

// Manually create a quiz — admin only
router.route('/').post(apiLimiter, protect, admin, createQuiz);

// Read a quiz — public (the game fetches quiz data for any player during a match)
// Update / Delete a quiz — admin only
router
  .route('/:id')
  .get(getQuizById)
  .put(apiLimiter, protect, admin, updateQuiz)
  .delete(apiLimiter, protect, admin, deleteQuiz);

export default router;
