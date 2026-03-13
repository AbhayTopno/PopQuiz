import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { IRedisRepository } from '../interfaces/IRedisRepository.js';
import type { Room } from '../types/index.js';

/**
 * RoomRepository — SRP
 *
 * Responsible exclusively for Room entity persistence.
 * Used by ALL game modes (1v1, 2v2, FFA, coop, custom).
 *
 * Keys managed:
 *   room:{roomId}  → HASH (roomId, quizId, createdAt, gameStarted, gameFinished, mode)
 */

const ROOM_KEY = 'room:';
const ROOM_TTL = 24 * 60 * 60; // 24 hours

export class RoomRepository implements IRedisRepository {
  private get redis(): Redis {
    return getRedisClient();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /** Create a new room hash entry with a 24-hour TTL. */
  async createRoom(roomData: {
    roomId: string;
    quizId: string;
    createdAt: number;
    mode?: string;
  }): Promise<void> {
    const key = `${ROOM_KEY}${roomData.roomId}`;
    await this.redis.hmset(key, {
      roomId: roomData.roomId,
      quizId: roomData.quizId,
      createdAt: roomData.createdAt.toString(),
      gameStarted: 'false',
      gameFinished: 'false',
      mode: roomData.mode ?? '1v1',
    });
    await this.redis.expire(key, ROOM_TTL);
  }

  /** Retrieve a room by ID. Returns null if not found. */
  async getRoom(roomId: string): Promise<Partial<Room> | null> {
    const data = await this.redis.hgetall(`${ROOM_KEY}${roomId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      roomId: data.roomId,
      quizId: data.quizId,
      createdAt: parseInt(data.createdAt, 10),
      gameStarted: data.gameStarted === 'true',
      gameFinished: data.gameFinished === 'true',
      mode: data.mode ?? '1v1',
    };
  }

  /** Patch a room's gameStarted / gameFinished flags. */
  async updateRoomStatus(
    roomId: string,
    status: { gameStarted?: boolean; gameFinished?: boolean },
  ): Promise<void> {
    const updates: Record<string, string> = {};
    if (status.gameStarted !== undefined) updates.gameStarted = status.gameStarted.toString();
    if (status.gameFinished !== undefined) updates.gameFinished = status.gameFinished.toString();
    await this.redis.hmset(`${ROOM_KEY}${roomId}`, updates);
  }

  /** Returns true if the room hash key exists in Redis. */
  async roomExists(roomId: string): Promise<boolean> {
    return (await this.redis.exists(`${ROOM_KEY}${roomId}`)) === 1;
  }

  /** Hard-delete a room key (players/chat/leaderboard keys are cleaned up by their repos). */
  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(`${ROOM_KEY}${roomId}`);
  }

  /** Return all room IDs currently tracked in Redis. */
  async getAllRoomIds(): Promise<string[]> {
    const keys = await this.redis.keys(`${ROOM_KEY}*`);
    return keys.map((k) => k.replace(ROOM_KEY, ''));
  }
}
