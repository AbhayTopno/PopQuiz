import { Quiz } from '../models/quiz.js';
import { generateQuiz as generateQuizFromAI, generateQuizFromFile } from './aiService.js';
import type { AIQuestion } from '../types/index.js';

export class QuizService {
  private static mapAIQuestions(questions: AIQuestion[]) {
    return questions.map((q: AIQuestion) => ({
      questionText: q.question,
      options: q.options,
      correctAnswer: q.answer,
    }));
  }

  private static deriveTopicFromFilename(filename: string) {
    const trimmed = filename.trim();
    const withoutExtension = trimmed.replace(/\.[^/.]+$/, '');
    return withoutExtension || 'Uploaded Source';
  }

  static async generateAndSaveAIQuiz(topic: string, difficulty: string, count: number) {
    const generatedData = await generateQuizFromAI(topic, difficulty, count);
    const mappedQuestions = this.mapAIQuestions(generatedData.questions as AIQuestion[]);

    const newQuiz = new Quiz({
      topic,
      difficulty,
      numberOfQuestions: count,
      questions: mappedQuestions,
      hostedBy: 'AI Generated',
    });

    return await newQuiz.save();
  }

  static async generateAndSaveAIQuizFromFile(params: {
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
    difficulty: string;
    count: number;
    topic?: string;
  }) {
    const generatedData = await generateQuizFromFile(
      params.fileBuffer,
      params.filename,
      params.mimeType,
      params.difficulty,
      params.count,
      params.topic,
    );

    const mappedQuestions = this.mapAIQuestions(generatedData.questions as AIQuestion[]);
    const resolvedTopic =
      params.topic?.trim() || QuizService.deriveTopicFromFilename(params.filename);

    const newQuiz = new Quiz({
      topic: resolvedTopic,
      difficulty: params.difficulty,
      numberOfQuestions: params.count,
      questions: mappedQuestions,
      hostedBy: 'AI Generated',
    });

    return await newQuiz.save();
  }

  static async createManualQuiz(data: {
    hostedBy: string;
    topic: string;
    difficulty: string;
    numberOfQuestions: number;
    questions: unknown[];
  }) {
    const newQuiz = new Quiz({
      hostedBy: data.hostedBy,
      topic: data.topic,
      difficulty: data.difficulty,
      numberOfQuestions: data.numberOfQuestions,
      questions: data.questions,
    });
    return await newQuiz.save();
  }

  static async getQuizById(id: string) {
    return await Quiz.findById(id);
  }

  static async updateQuiz(id: string, updateData: Record<string, unknown>) {
    return await Quiz.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  static async deleteQuiz(id: string) {
    return await Quiz.findByIdAndDelete(id);
  }
}
