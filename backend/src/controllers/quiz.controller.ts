import { asyncHandler } from '../middlewares/asyncHandler.js';
import { QuizService } from '../services/quiz.service.js';
import type { Request, Response } from 'express';

const generateAndSaveQuiz = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { topic, difficulty, count } = req.body;
    const savedQuiz = await QuizService.generateAndSaveQuiz(topic, difficulty, count);
    res.status(201).json({ quizId: savedQuiz._id, savedQuiz });
  } catch (error: any) {
    res.status(400);
    throw new Error(error.message);
  }
});

const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  try {
    const savedQuiz = await QuizService.createQuiz(req.body);
    res.status(201).json(savedQuiz);
  } catch (error: any) {
    res.status(400);
    throw new Error(error.message);
  }
});

const getQuizById = asyncHandler(async (req: Request, res: Response) => {
  try {
    const quiz = await QuizService.getQuizById(req.params.id);
    res.status(200).json(quiz);
  } catch (error: any) {
    res.status(404);
    throw new Error(error.message);
  }
});

const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
  try {
    const updatedQuiz = await QuizService.updateQuiz(req.params.id, req.body);
    res.status(200).json(updatedQuiz);
  } catch (error: any) {
    res.status(404);
    throw new Error(error.message);
  }
});

const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  try {
    await QuizService.deleteQuiz(req.params.id);
    res.status(200).json({ message: 'Quiz deleted successfully.' });
  } catch (error: any) {
    res.status(404);
    throw new Error(error.message);
  }
});

export { generateAndSaveQuiz, createQuiz, getQuizById, updateQuiz, deleteQuiz };
