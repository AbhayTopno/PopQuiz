import { getRedisClient } from '../../config/redis.js';
import { PLAYERS_KEY, LEADERBOARD_KEY, ROOM_TTL } from './redis.constants.js';
import type { Player } from '../../types/index.js';

export class PlayerRedisService {
  /**
   * Add a player to a room
   */
  static async addPlayer(roomId: string, player: Player): Promise<void> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;

    const playerData = {
      id: player.id,
      username: player.username,
      avatar: player.avatar || '',
      score: player.score.toString(),
      currentQuestionIndex: player.currentQuestionIndex.toString(),
      isReady: player.isReady.toString(),
      joinedAt: player.joinedAt.toString(),
      answers: JSON.stringify(player.answers),
    };

    await redis.hset(playersKey, player.id, JSON.stringify(playerData));
    await redis.expire(playersKey, ROOM_TTL);

    // Initialize player score in sorted set (leaderboard)
    const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;
    await redis.zadd(leaderboardKey, player.score, player.id);
    await redis.expire(leaderboardKey, ROOM_TTL);
  }

  /**
   * Get a specific player from a room
   */
  static async getPlayer(roomId: string, playerId: string): Promise<Player | null> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;

    const playerStr = await redis.hget(playersKey, playerId);

    if (!playerStr) {
      return null;
    }

    const playerData = JSON.parse(playerStr);

    return {
      id: playerData.id,
      username: playerData.username,
      avatar: playerData.avatar || undefined,
      score: parseInt(playerData.score, 10),
      currentQuestionIndex: parseInt(playerData.currentQuestionIndex, 10),
      isReady: playerData.isReady === 'true',
      joinedAt: parseInt(playerData.joinedAt, 10),
      answers: JSON.parse(playerData.answers),
    };
  }

  /**
   * Get all players in a room
   */
  static async getAllPlayers(roomId: string): Promise<Player[]> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;

    const allPlayersData = await redis.hgetall(playersKey);

    if (!allPlayersData || Object.keys(allPlayersData).length === 0) {
      return [];
    }

    return Object.values(allPlayersData).map((playerStr: string) => {
      const playerData = JSON.parse(playerStr);
      return {
        id: playerData.id,
        username: playerData.username,
        avatar: playerData.avatar || undefined,
        score: parseInt(playerData.score, 10),
        currentQuestionIndex: parseInt(playerData.currentQuestionIndex, 10),
        isReady: playerData.isReady === 'true',
        joinedAt: parseInt(playerData.joinedAt, 10),
        answers: JSON.parse(playerData.answers),
      };
    });
  }

  /**
   * Update player data
   */
  static async updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<Player>,
  ): Promise<void> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;

    const existingPlayerStr = await redis.hget(playersKey, playerId);
    if (!existingPlayerStr) {
      throw new Error('Player not found');
    }

    const existingPlayer = JSON.parse(existingPlayerStr);

    const updatedPlayer = {
      ...existingPlayer,
      ...(updates.username && { username: updates.username }),
      ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      ...(updates.score !== undefined && { score: updates.score.toString() }),
      ...(updates.currentQuestionIndex !== undefined && {
        currentQuestionIndex: updates.currentQuestionIndex.toString(),
      }),
      ...(updates.isReady !== undefined && { isReady: updates.isReady.toString() }),
      ...(updates.answers && { answers: JSON.stringify(updates.answers) }),
    };

    await redis.hset(playersKey, playerId, JSON.stringify(updatedPlayer));

    // Update leaderboard if score changed
    if (updates.score !== undefined) {
      const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;
      await redis.zadd(leaderboardKey, updates.score, playerId);
    }
  }

  /**
   * Remove a player from a room
   */
  static async removePlayer(roomId: string, playerId: string): Promise<void> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;
    const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

    await redis.hdel(playersKey, playerId);
    await redis.zrem(leaderboardKey, playerId);
  }

  /**
   * Get player count in a room
   */
  static async getPlayerCount(roomId: string): Promise<number> {
    const redis = getRedisClient();
    const playersKey = `${PLAYERS_KEY}${roomId}`;
    return await redis.hlen(playersKey);
  }
}
