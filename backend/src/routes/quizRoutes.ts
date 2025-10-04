import express from 'express';
import {
  generateAndSaveQuiz,
  createQuiz,
  deleteQuiz,
  getQuizById,
  updateQuiz,
} from '../controllers/quiz.controller.ts';

const router = express.Router();

// Route to generate a quiz using AI and save it to the database
router.post('/generate', generateAndSaveQuiz);

// Route for manual quiz creation
router.route('/').post(createQuiz);

// Routes for fetching, updating, and deleting a specific quiz by its ID
router.route('/:id').get(getQuizById).put(updateQuiz).delete(deleteQuiz);

export default router;
