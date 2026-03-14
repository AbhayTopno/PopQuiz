import { getRedisClient } from '../../config/redis.js';
import { CHAT_KEY, CHAT_TTL } from './redis.constants.js';
import type { ChatMessage } from '../../types/index.js';

export class ChatRedisService {
  /**
   * Add a chat message to a room
   */
  static async addChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    const redis = getRedisClient();
    const chatKey = `${CHAT_KEY}${roomId}`;

    const messageData = JSON.stringify(message);

    // Use Redis LIST to store messages in order
    await redis.rpush(chatKey, messageData);
    await redis.expire(chatKey, CHAT_TTL);

    // Keep only last 100 messages to prevent memory issues
    await redis.ltrim(chatKey, -100, -1);
  }

  /**
   * Get all chat messages for a room
   */
  static async getChatMessages(roomId: string): Promise<ChatMessage[]> {
    const redis = getRedisClient();
    const chatKey = `${CHAT_KEY}${roomId}`;

    const messages = await redis.lrange(chatKey, 0, -1);

    return messages.map((msg: string) => JSON.parse(msg) as ChatMessage);
  }

  /**
   * Get recent chat messages (last N messages)
   */
  static async getRecentChatMessages(roomId: string, count: number = 50): Promise<ChatMessage[]> {
    const redis = getRedisClient();
    const chatKey = `${CHAT_KEY}${roomId}`;

    const messages = await redis.lrange(chatKey, -count, -1);

    return messages.map((msg: string) => JSON.parse(msg) as ChatMessage);
  }
}
