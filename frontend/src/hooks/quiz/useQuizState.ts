import { useState, useCallback } from 'react';
import { QuizData } from '@/types';
import { calculateScore, type Difficulty } from '@/utils/scoring';

const FEEDBACK_DELAY_MS = 3000;

export function useQuizState(initialQuizData: QuizData | null) {
  const [quizData] = useState<QuizData | null>(initialQuizData);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleNextBase = useCallback(
    (
      selectedOption: string | null,
      timeLeft: number,
      duration: number,
      onProgressUpdate?: (nextIndex: number, nextScore: number, isFinished: boolean) => void,
    ) => {
      if (!quizData) return;

      setShowFeedback(true);
      setSelectedAnswer(selectedOption);

      const isCorrect =
        !!selectedOption &&
        selectedOption === quizData.questions[currentQuestionIndex].correctAnswer;

      const difficulty = (quizData.difficulty || 'medium') as Difficulty;
      const gainedPoints = calculateScore(difficulty, timeLeft, duration, !!isCorrect);
      const nextScore = score + (isCorrect ? gainedPoints : 0);

      if (isCorrect) {
        setScore(nextScore);
        setCorrectAnswersCount((prev) => prev + 1);
      }

      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          const nextIndex = currentQuestionIndex + 1;
          const finished = nextIndex >= quizData.questions.length;

          if (!finished) {
            setCurrentQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setShowFeedback(false);
            setIsFadingOut(false);
          } else {
            setIsFinished(true);
          }

          if (onProgressUpdate) {
            onProgressUpdate(nextIndex, nextScore, finished);
          }
        }, 300);
      }, FEEDBACK_DELAY_MS);
    },
    [quizData, currentQuestionIndex, score],
  );

  const overrideState = useCallback((index: number, newScore: number) => {
    setCurrentQuestionIndex(index);
    setScore(newScore);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsFadingOut(false);
  }, []);

  return {
    quizData,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    selectedAnswer,
    setSelectedAnswer,
    score,
    setScore,
    correctAnswersCount,
    setCorrectAnswersCount,
    isFinished,
    setIsFinished,
    showFeedback,
    setShowFeedback,
    isFadingOut,
    setIsFadingOut,
    handleNextBase,
    overrideState,
  };
}
