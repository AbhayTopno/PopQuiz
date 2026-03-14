import { getRedisClient } from '../../config/redis.js';
import { TEAM_ASSIGNMENTS_KEY, ROOM_TTL } from './redis.constants.js';

export class TeamRedisService {
  /**
   * Set team assignments for a 2v2 room (by username, not socket ID)
   */
  static async setTeamAssignmentsByUsername(
    roomId: string,
    teamAssignments: { teamA: string[]; teamB: string[] },
  ): Promise<void> {
    const redis = getRedisClient();
    const teamKey = `team_usernames:${roomId}`;

    // Deduplicate team arrays
    const deduplicatedAssignments = {
      teamA: [...new Set(teamAssignments.teamA)],
      teamB: [...new Set(teamAssignments.teamB)],
    };

    await redis.set(teamKey, JSON.stringify(deduplicatedAssignments));
    await redis.expire(teamKey, ROOM_TTL);
  }

  /**
   * Get team assignments by username for a 2v2 room
   */
  static async getTeamAssignmentsByUsername(
    roomId: string,
  ): Promise<{ teamA: string[]; teamB: string[] } | null> {
    const redis = getRedisClient();
    const teamKey = `team_usernames:${roomId}`;
    const data = await redis.get(teamKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Set team assignments for a 2v2 room (by socket ID)
   */
  static async setTeamAssignments(
    roomId: string,
    teamAssignments: { teamA: string[]; teamB: string[] },
  ): Promise<void> {
    const redis = getRedisClient();
    const teamKey = `${TEAM_ASSIGNMENTS_KEY}${roomId}`;

    // Deduplicate team arrays to prevent duplicate player IDs
    const deduplicatedAssignments = {
      teamA: [...new Set(teamAssignments.teamA)],
      teamB: [...new Set(teamAssignments.teamB)],
    };

    await redis.set(teamKey, JSON.stringify(deduplicatedAssignments));
    await redis.expire(teamKey, ROOM_TTL);
  }

  /**
   * Get team assignments for a 2v2 room
   */
  static async getTeamAssignments(
    roomId: string,
  ): Promise<{ teamA: string[]; teamB: string[] } | null> {
    const redis = getRedisClient();
    const teamKey = `${TEAM_ASSIGNMENTS_KEY}${roomId}`;

    const data = await redis.get(teamKey);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing team assignments:', error);
      return null;
    }
  }

  /**
   * Set team score (shared score for the whole team)
   */
  static async setTeamScore(
    roomId: string,
    teamId: 'teamA' | 'teamB',
    score: number,
  ): Promise<void> {
    const redis = getRedisClient();
    const teamScoreKey = `team-score:${roomId}:${teamId}`;
    await redis.set(teamScoreKey, score.toString());
    await redis.expire(teamScoreKey, ROOM_TTL);
  }

  /**
   * Get team score (shared score for the whole team)
   */
  static async getTeamScore(roomId: string, teamId: 'teamA' | 'teamB'): Promise<number> {
    const redis = getRedisClient();
    const teamScoreKey = `team-score:${roomId}:${teamId}`;
    const score = await redis.get(teamScoreKey);
    return score ? parseInt(score, 10) : 0;
  }

  /**
   * Increment team score (add points to shared team score)
   */
  static async incrementTeamScore(
    roomId: string,
    teamId: 'teamA' | 'teamB',
    points: number,
  ): Promise<number> {
    const redis = getRedisClient();
    const teamScoreKey = `team-score:${roomId}:${teamId}`;
    const newScore = await redis.incrby(teamScoreKey, points);
    await redis.expire(teamScoreKey, ROOM_TTL);
    return newScore;
  }
}
