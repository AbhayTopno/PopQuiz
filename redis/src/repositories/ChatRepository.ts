import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { IRedisRepository } from '../interfaces/IRedisRepository.js';
import type { ChatMessage } from '../types/index.js';

/**
 * ChatRepository — SRP
 *
 * Responsible exclusively for Chat message persistence.
 * Shared across ALL game modes (1v1, 2v2, FFA, coop, custom).
 *
 * Keys managed:
 *   chat:{roomId} → LIST (newest at tail, capped at 100 messages)
 */

const CHAT_KEY = 'chat:';
const CHAT_TTL = 24 * 60 * 60;
const MAX_MESSAGES = 100;

export class ChatRepository implements IRedisRepository {
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

  /** Append a message to the room list, keep only the last 100, reset TTL. */
  async addChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    const key = `${CHAT_KEY}${roomId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, -MAX_MESSAGES, -1);
    await this.redis.expire(key, CHAT_TTL);
  }

  /** Return all chat messages for a room (oldest → newest). */
  async getChatMessages(roomId: string): Promise<ChatMessage[]> {
    const raw = await this.redis.lrange(`${CHAT_KEY}${roomId}`, 0, -1);
    return raw.map((m: string) => JSON.parse(m) as ChatMessage);
  }

  /** Return the last `count` messages for a room (default 50). */
  async getRecentChatMessages(roomId: string, count = 50): Promise<ChatMessage[]> {
    const raw = await this.redis.lrange(`${CHAT_KEY}${roomId}`, -count, -1);
    return raw.map((m: string) => JSON.parse(m) as ChatMessage);
  }

  /** Remove all chat messages for a room (called on room deletion). */
  async deleteRoomChat(roomId: string): Promise<void> {
    await this.redis.del(`${CHAT_KEY}${roomId}`);
  }
}
