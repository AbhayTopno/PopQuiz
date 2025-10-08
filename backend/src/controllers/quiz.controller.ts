import { asyncHandler } from "../middlewares/asyncHandler.js";
import { Quiz } from "../models/quiz.js";
import { generateQuiz as generateQuizFromAI } from "../services/aiService.js";
import type { Request, Response } from "express";
import type { AIQuestion } from "../types/index.js";

const generateAndSaveQuiz = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic, difficulty, count } = req.body;

    if (!topic || !difficulty || !count) {
      res.status(400);
      throw new Error("Please provide topic, difficulty, and count");
    }

    // 1. Generate quiz content from the AI service
    const generatedData = await generateQuizFromAI(topic, difficulty, count);

    // 2. Map the AI response fields to match your schema
    const mappedQuestions = generatedData.questions.map((q: AIQuestion) => ({
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
      hostedBy: "AI Generated",
    });

    const savedQuiz = await newQuiz.save();
    res.status(201).json({ quizId: savedQuiz._id, savedQuiz });
  },
);

// Rest of the code remains unchanged
const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { hostedBy, topic, difficulty, numberOfQuestions, questions } =
    req.body;

  if (!topic || !difficulty || !numberOfQuestions || !questions) {
    res.status(400);
    throw new Error("Please provide all required fields for manual creation.");
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

const getQuizById = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await Quiz.findById(req.params.id);

  if (quiz) {
    res.status(200).json(quiz);
  } else {
    res.status(404);
    throw new Error("Quiz not found.");
  }
});

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
    throw new Error("Quiz not found.");
  }
});

const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);

  if (deletedQuiz) {
    res.status(200).json({ message: "Quiz deleted successfully." });
  } else {
    res.status(404);
    throw new Error("Quiz not found.");
  }
});

export { generateAndSaveQuiz, createQuiz, getQuizById, updateQuiz, deleteQuiz };
