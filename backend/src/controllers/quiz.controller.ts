import { asyncHandler } from '../middlewares/asyncHandler.js';
import { QuizService } from '../services/quiz.service.js';
import type { Request, Response } from 'express';

const generateAndSaveQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { topic, difficulty, count } = req.body;

  if (!topic || !difficulty || !count) {
    res.status(400);
    throw new Error('Please provide topic, difficulty, and count');
  }

  try {
    const savedQuiz = await QuizService.generateAndSaveAIQuiz(topic, difficulty, count);
    res.status(201).json({ quizId: savedQuiz._id, savedQuiz });
  } catch (error: unknown) {
    res.status(500);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI quiz';
    throw new Error(errorMessage);
  }
});

const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { hostedBy, topic, difficulty, numberOfQuestions, questions } = req.body;

  if (!topic || !difficulty || !numberOfQuestions || !questions) {
    res.status(400);
    throw new Error('Please provide all required fields for manual creation.');
  }

  const savedQuiz = await QuizService.createManualQuiz({
    hostedBy,
    topic,
    difficulty,
    numberOfQuestions,
    questions,
  });

  res.status(201).json(savedQuiz);
});

const getQuizById = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await QuizService.getQuizById(req.params.id);

  if (quiz) {
    res.status(200).json(quiz);
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { topic, difficulty, hostedBy } = req.body;
  const updateData = { topic, difficulty, hostedBy };

  const updatedQuiz = await QuizService.updateQuiz(req.params.id, updateData);

  if (updatedQuiz) {
    res.status(200).json(updatedQuiz);
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  const deletedQuiz = await QuizService.deleteQuiz(req.params.id);

  if (deletedQuiz) {
    res.status(200).json({ message: 'Quiz deleted successfully.' });
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

export { generateAndSaveQuiz, createQuiz, getQuizById, updateQuiz, deleteQuiz };
