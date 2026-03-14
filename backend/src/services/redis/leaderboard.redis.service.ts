import { getRedisClient } from '../../config/redis.js';
import { LEADERBOARD_KEY } from './redis.constants.js';
import { PlayerRedisService } from './player.redis.service.js';

export class LeaderboardRedisService {
  /**
   * Get leaderboard for a room (sorted by score descending)
   */
  static async getLeaderboard(roomId: string): Promise<Array<{ playerId: string; score: number }>> {
    const redis = getRedisClient();
    const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

    // Get all players sorted by score (descending)
    const leaderboard = await redis.zrevrange(leaderboardKey, 0, -1, 'WITHSCORES');

    const result: Array<{ playerId: string; score: number }> = [];
    for (let i = 0; i < leaderboard.length; i += 2) {
      result.push({
        playerId: leaderboard[i],
        score: parseInt(leaderboard[i + 1], 10),
      });
    }

    return result;
  }

  /**
   * Update player score
   */
  static async updatePlayerScore(roomId: string, playerId: string, score: number): Promise<void> {
    const redis = getRedisClient();
    const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

    await redis.zadd(leaderboardKey, score, playerId);
    await PlayerRedisService.updatePlayer(roomId, playerId, { score });
  }
}
