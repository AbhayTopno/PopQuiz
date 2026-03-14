import { getRedisClient } from '../../config/redis.js';
import { ROOM_KEY, CHAT_KEY, PLAYERS_KEY, LEADERBOARD_KEY, ROOM_TTL } from './redis.constants.js';
import { PlayerRedisService } from './player.redis.service.js';
import type { Room } from '../../types/index.js';

export class RoomRedisService {
  /**
   * Store room metadata
   */
  static async createRoom(roomData: {
    roomId: string;
    quizId: string;
    createdAt: number;
    mode?: string;
  }): Promise<void> {
    const redis = getRedisClient();
    const roomKey = `${ROOM_KEY}${roomData.roomId}`;

    await redis.hmset(roomKey, {
      roomId: roomData.roomId,
      quizId: roomData.quizId,
      createdAt: roomData.createdAt.toString(),
      gameStarted: 'false',
      gameFinished: 'false',
      mode: roomData.mode || '1v1',
    });

    await redis.expire(roomKey, ROOM_TTL);
  }

  /**
   * Get room metadata
   */
  static async getRoom(roomId: string): Promise<Partial<Room> | null> {
    const redis = getRedisClient();
    const roomKey = `${ROOM_KEY}${roomId}`;

    const roomData = await redis.hgetall(roomKey);

    if (!roomData || Object.keys(roomData).length === 0) {
      return null;
    }

    return {
      roomId: roomData.roomId,
      quizId: roomData.quizId,
      createdAt: parseInt(roomData.createdAt, 10),
      gameStarted: roomData.gameStarted === 'true',
      gameFinished: roomData.gameFinished === 'true',
      mode: roomData.mode || '1v1',
    };
  }

  /**
   * Update room game status
   */
  static async updateRoomStatus(
    roomId: string,
    status: { gameStarted?: boolean; gameFinished?: boolean },
  ): Promise<void> {
    const redis = getRedisClient();
    const roomKey = `${ROOM_KEY}${roomId}`;

    const updates: Record<string, string> = {};
    if (status.gameStarted !== undefined) {
      updates.gameStarted = status.gameStarted.toString();
    }
    if (status.gameFinished !== undefined) {
      updates.gameFinished = status.gameFinished.toString();
    }

    await redis.hmset(roomKey, updates);
  }

  /**
   * Check if room exists
   */
  static async roomExists(roomId: string): Promise<boolean> {
    const redis = getRedisClient();
    const roomKey = `${ROOM_KEY}${roomId}`;
    const exists = await redis.exists(roomKey);
    return exists === 1;
  }

  /**
   * Delete a room and all associated data
   */
  static async deleteRoom(roomId: string): Promise<void> {
    const redis = getRedisClient();

    const roomKey = `${ROOM_KEY}${roomId}`;
    const chatKey = `${CHAT_KEY}${roomId}`;
    const playersKey = `${PLAYERS_KEY}${roomId}`;
    const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

    await redis.del(roomKey, chatKey, playersKey, leaderboardKey);
  }

  /**
   * Get all active room IDs
   */
  static async getAllRoomIds(): Promise<string[]> {
    const redis = getRedisClient();
    const keys = await redis.keys(`${ROOM_KEY}*`);

    return keys.map((key: string) => key.replace(ROOM_KEY, ''));
  }

  /**
   * Clean up empty rooms (rooms with no players)
   */
  static async cleanupEmptyRooms(): Promise<number> {
    const roomIds = await RoomRedisService.getAllRoomIds();
    let cleanedCount = 0;

    for (const roomId of roomIds) {
      const playerCount = await PlayerRedisService.getPlayerCount(roomId);
      if (playerCount === 0) {
        const room = await RoomRedisService.getRoom(roomId);
        if (room && room.createdAt && Date.now() - room.createdAt > 5 * 60 * 1000) {
          // 5 minutes
          await RoomRedisService.deleteRoom(roomId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }
}
