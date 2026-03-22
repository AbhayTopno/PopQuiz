import express from 'express';
import {
  generateAndSaveQuiz,
  createQuiz,
  deleteQuiz,
  getQuizById,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/generate', generateAndSaveQuiz);

// Manually create a quiz — admin only
router.route('/').post(protect, admin, createQuiz);

// Read a quiz — public (the game fetches quiz data for any player during a match)
// Update / Delete a quiz — admin only
router
  .route('/:id')
  .get(getQuizById)
  .put(protect, admin, updateQuiz)
  .delete(protect, admin, deleteQuiz);

export default router;
