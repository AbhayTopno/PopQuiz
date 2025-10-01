import express from 'express';
import { generateQuiz } from '../services/aiService.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { topic, difficulty, count } = req.body;
  try {
    const quiz = await generateQuiz(topic, difficulty, count);
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

export default router;
