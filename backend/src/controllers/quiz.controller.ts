import { asyncHandler } from '../middlewares/asyncHandler.js';
import { Quiz } from '../models/quiz.js';
import { generateQuiz as generateQuizFromAI } from '../services/aiService.js';
import type { Request, Response } from 'express';

const generateAndSaveQuiz = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic, difficulty, count } = req.body;

    if (!topic || !difficulty || !count) {
      res.status(400);
      throw new Error('Please provide topic, difficulty, and count');
    }

    // 1. Generate quiz content from the AI service
    const generatedData = await generateQuizFromAI(topic, difficulty, count);

    // 2. Map the AI response fields (question, answer) to match your schema (questionText, correctAnswer)
    const mappedQuestions = generatedData.questions.map((q: any) => ({
      questionText: q.question,
      options: q.options,
      correctAnswer: q.answer,
    }));

    // 3. Create and save the new quiz
    const newQuiz = new Quiz({
      topic,
      difficulty,
      numberOfQuestions: count,
      questions: mappedQuestions,
      hostedBy: 'AI Generated', // Set a specific host for these quizzes
    });

    const savedQuiz = await newQuiz.save();
    res.status(201).json({ quizId: savedQuiz._id, savedQuiz });
  }
);

/**
 * @desc    Create a quiz manually (e.g., from an admin dashboard)
 * @route   POST /api/quizzes
 * @access  Private/Admin
 */
const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { hostedBy, topic, difficulty, numberOfQuestions, questions } =
    req.body;

  if (!topic || !difficulty || !numberOfQuestions || !questions) {
    res.status(400);
    throw new Error('Please provide all required fields for manual creation.');
  }

  const newQuiz = new Quiz({
    hostedBy,
    topic,
    difficulty,
    numberOfQuestions,
    questions,
  });
  const savedQuiz = await newQuiz.save();

  res.status(201).json(savedQuiz);
});

/**
 * @desc    Fetch a single quiz by its ID
 * @route   GET /api/quizzes/:id
 * @access  Public
 */
const getQuizById = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await Quiz.findById(req.params.id);

  if (quiz) {
    res.status(200).json(quiz);
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

/**
 * @desc    Update a quiz's metadata
 * @route   PUT /api/quizzes/:id
 * @access  Private/Admin
 */
const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { topic, difficulty, hostedBy } = req.body;
  const updateData = { topic, difficulty, hostedBy };

  const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (updatedQuiz) {
    res.status(200).json(updatedQuiz);
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

/**
 * @desc    Delete a quiz
 * @route   DELETE /api/quizzes/:id
 * @access  Private/Admin
 */
const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);

  if (deletedQuiz) {
    res.status(200).json({ message: 'Quiz deleted successfully.' });
  } else {
    res.status(404);
    throw new Error('Quiz not found.');
  }
});

export { generateAndSaveQuiz, createQuiz, getQuizById, updateQuiz, deleteQuiz };
