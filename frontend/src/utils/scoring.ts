/**
 * Scoring System for PopQuiz
 *
 * Base scoring multipliers by difficulty:
 * - Easy: 1x
 * - Medium: 1.5x
 * - Hard: 2x
 *
 * Final score = Base Points × Difficulty Multiplier × Time Bonus
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ScoringConfig {
  basePoints: number;
  difficultyMultipliers: Record<Difficulty, number>;
  maxTimeBonus: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  basePoints: 100, // Base points for a correct answer
  difficultyMultipliers: {
    easy: 1.0,
    medium: 1.5,
    hard: 2.0,
  },
  maxTimeBonus: 2.0, // Maximum time multiplier (if answered instantly)
};

/**
 * Calculate score for a single question
 *
 * @param difficulty - Question difficulty level
 * @param timeLeft - Time remaining when answered (in seconds)
 * @param totalTime - Total time allocated for the question (in seconds)
 * @param isCorrect - Whether the answer was correct
 * @param config - Optional custom scoring configuration
 * @returns Calculated score points
 */
export function calculateScore(
  difficulty: Difficulty,
  timeLeft: number,
  totalTime: number,
  isCorrect: boolean = true,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (!isCorrect) {
    return 0;
  }

  // Get difficulty multiplier
  const difficultyMultiplier = config.difficultyMultipliers[difficulty] || 1.0;

  // Calculate time bonus (0 to maxTimeBonus)
  // If answered instantly (timeLeft = totalTime), bonus = maxTimeBonus
  // If time runs out (timeLeft = 0), bonus = 0
  const timeRatio = Math.max(0, Math.min(1, timeLeft / totalTime));
  const timeBonus = timeRatio * (config.maxTimeBonus - 1) + 1;

  // Calculate final score
  const score = config.basePoints * difficultyMultiplier * timeBonus;

  return Math.round(score);
}

/**
 * Calculate total score for multiple questions
 *
 * @param answers - Array of answer results
 * @returns Total score
 */
export interface AnswerResult {
  difficulty: Difficulty;
  timeLeft: number;
  totalTime: number;
  isCorrect: boolean;
}

export function calculateTotalScore(
  answers: AnswerResult[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  return answers.reduce((total, answer) => {
    return (
      total +
      calculateScore(answer.difficulty, answer.timeLeft, answer.totalTime, answer.isCorrect, config)
    );
  }, 0);
}

/**
 * Get maximum possible score for a question
 *
 * @param difficulty - Question difficulty level
 * @param config - Optional custom scoring configuration
 * @returns Maximum possible score
 */
export function getMaxScore(
  difficulty: Difficulty,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  return Math.round(
    config.basePoints * config.difficultyMultipliers[difficulty] * config.maxTimeBonus,
  );
}

/**
 * Get score breakdown with details
 *
 * @param difficulty - Question difficulty level
 * @param timeLeft - Time remaining when answered (in seconds)
 * @param totalTime - Total time allocated for the question (in seconds)
 * @param isCorrect - Whether the answer was correct
 * @param config - Optional custom scoring configuration
 * @returns Detailed score breakdown
 */
export interface ScoreBreakdown {
  basePoints: number;
  difficultyMultiplier: number;
  timeBonus: number;
  totalScore: number;
  maxPossible: number;
}

export function getScoreBreakdown(
  difficulty: Difficulty,
  timeLeft: number,
  totalTime: number,
  isCorrect: boolean = true,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreBreakdown {
  const basePoints = config.basePoints;
  const difficultyMultiplier = config.difficultyMultipliers[difficulty];
  const timeRatio = Math.max(0, Math.min(1, timeLeft / totalTime));
  const timeBonus = timeRatio * (config.maxTimeBonus - 1) + 1;
  const totalScore = isCorrect ? Math.round(basePoints * difficultyMultiplier * timeBonus) : 0;
  const maxPossible = Math.round(basePoints * difficultyMultiplier * config.maxTimeBonus);

  return {
    basePoints,
    difficultyMultiplier,
    timeBonus: isCorrect ? timeBonus : 0,
    totalScore,
    maxPossible,
  };
}

/**
 * Format score with appropriate suffix (e.g., 1.2k, 3.5M)
 *
 * @param score - Score to format
 * @returns Formatted score string
 */
export function formatScore(score: number): string {
  if (score >= 1_000_000) {
    return `${(score / 1_000_000).toFixed(1)}M`;
  }
  if (score >= 1_000) {
    return `${(score / 1_000).toFixed(1)}k`;
  }
  return score.toString();
}
