export interface AIQuestion {
  question: string;
  options: string[];
  answer: string;
}
// Player interface
export interface Player {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  currentQuestionIndex: number;
  answers: { questionIndex: number; answer: string; isCorrect: boolean; timestamp: number }[];
  isReady: boolean;
  joinedAt: number;
}

// Room interface
export interface Room {
  roomId: string;
  quizId: string;
  players: Map<string, Player>;
  messages: ChatMessage[];
  createdAt: number;
  gameStarted: boolean;
  gameFinished: boolean;
  mode?: string; // Game mode: '1v1' or '2v2'
}

// Chat message interface
export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  avatar?: string;
}

// Score update interface
export interface ScoreUpdate {
  playerId: string;
  username: string;
  score: number;
  currentQuestionIndex: number;
  totalQuestions: number;
}

// Answer submission interface
export interface AnswerSubmission {
  questionIndex: number;
  answer: string;
  isCorrect: boolean;
  timeSpent: number;
}
