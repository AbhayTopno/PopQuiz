import { Quiz } from '../models/quiz.js';
import { generateQuiz as generateQuizFromAI } from './aiService.js';
import type { AIQuestion } from '../types/index.js';

export class QuizService {
  static async generateAndSaveQuiz(topic: string, difficulty: string, count: number) {
    if (!topic || !difficulty || !count) {
      throw new Error('Please provide topic, difficulty, and count');
    }

    // 1. Generate quiz content from the AI service
    const generatedData = await generateQuizFromAI(topic, difficulty, count);

    // 2. Map the AI response fields to match the schema
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
      hostedBy: 'AI Generated',
    });

    return await newQuiz.save();
  }

  static async createQuiz(data: {
    hostedBy?: string;
    topic?: string;
    difficulty?: string;
    numberOfQuestions?: number;
    questions?: unknown[];
  }) {
    const { hostedBy, topic, difficulty, numberOfQuestions, questions } = data;

    if (!topic || !difficulty || !numberOfQuestions || !questions) {
      throw new Error('Please provide all required fields for manual creation.');
    }

    const newQuiz = new Quiz({
      hostedBy,
      topic,
      difficulty,
      numberOfQuestions,
      questions,
    });

    return await newQuiz.save();
  }

  static async getQuizById(id: string) {
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      throw new Error('Quiz not found');
    }
    return quiz;
  }

  static async updateQuiz(
    id: string,
    data: { topic?: string; difficulty?: string; hostedBy?: string },
  ) {
    const { topic, difficulty, hostedBy } = data;
    const updateData = { topic, difficulty, hostedBy };

    const updatedQuiz = await Quiz.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedQuiz) {
      throw new Error('Quiz not found');
    }
    return updatedQuiz;
  }

  static async deleteQuiz(id: string) {
    const deletedQuiz = await Quiz.findByIdAndDelete(id);
    if (!deletedQuiz) {
      throw new Error('Quiz not found');
    }
    return deletedQuiz;
  }
}
