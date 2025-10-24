import { getRedisClient } from '../config/redis.js';
import type { ChatMessage, Player, Room } from '../types/index.js';

/**
 * Redis Service for managing quiz battle room data
 * Handles chat messages, player scores, and room state
 */

// Redis Key Prefixes
const ROOM_KEY = 'room:';
const CHAT_KEY = 'chat:';
const PLAYERS_KEY = 'players:';
const LEADERBOARD_KEY = 'leaderboard:';

// TTL (Time To Live) in seconds
const ROOM_TTL = 24 * 60 * 60; // 24 hours
const CHAT_TTL = 24 * 60 * 60; // 24 hours

/**
 * Store room metadata
 */
export const createRoom = async (roomData: {
  roomId: string;
  quizId: string;
  createdAt: number;
}): Promise<void> => {
  const redis = getRedisClient();
  const roomKey = `${ROOM_KEY}${roomData.roomId}`;

  await redis.hmset(roomKey, {
    roomId: roomData.roomId,
    quizId: roomData.quizId,
    createdAt: roomData.createdAt.toString(),
    gameStarted: 'false',
    gameFinished: 'false',
  });

  await redis.expire(roomKey, ROOM_TTL);
};

/**
 * Get room metadata
 */
export const getRoom = async (roomId: string): Promise<Partial<Room> | null> => {
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
  };
};

/**
 * Update room game status
 */
export const updateRoomStatus = async (
  roomId: string,
  status: { gameStarted?: boolean; gameFinished?: boolean },
): Promise<void> => {
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
};

/**
 * Check if room exists
 */
export const roomExists = async (roomId: string): Promise<boolean> => {
  const redis = getRedisClient();
  const roomKey = `${ROOM_KEY}${roomId}`;
  const exists = await redis.exists(roomKey);
  return exists === 1;
};

/**
 * Add a player to a room
 */
export const addPlayer = async (roomId: string, player: Player): Promise<void> => {
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
};

/**
 * Get a specific player from a room
 */
export const getPlayer = async (roomId: string, playerId: string): Promise<Player | null> => {
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
};

/**
 * Get all players in a room
 */
export const getAllPlayers = async (roomId: string): Promise<Player[]> => {
  const redis = getRedisClient();
  const playersKey = `${PLAYERS_KEY}${roomId}`;

  const allPlayersData = await redis.hgetall(playersKey);

  if (!allPlayersData || Object.keys(allPlayersData).length === 0) {
    return [];
  }

  return (Object.values(allPlayersData) as string[]).map((playerStr) => {
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
};

/**
 * Update player data
 */
export const updatePlayer = async (
  roomId: string,
  playerId: string,
  updates: Partial<Player>,
): Promise<void> => {
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
};

/**
 * Remove a player from a room
 */
export const removePlayer = async (roomId: string, playerId: string): Promise<void> => {
  const redis = getRedisClient();
  const playersKey = `${PLAYERS_KEY}${roomId}`;
  const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

  await redis.hdel(playersKey, playerId);
  await redis.zrem(leaderboardKey, playerId);
};

/**
 * Get player count in a room
 */
export const getPlayerCount = async (roomId: string): Promise<number> => {
  const redis = getRedisClient();
  const playersKey = `${PLAYERS_KEY}${roomId}`;
  return await redis.hlen(playersKey);
};

/**
 * Add a chat message to a room
 */
export const addChatMessage = async (roomId: string, message: ChatMessage): Promise<void> => {
  const redis = getRedisClient();
  const chatKey = `${CHAT_KEY}${roomId}`;

  const messageData = JSON.stringify(message);

  // Use Redis LIST to store messages in order
  await redis.rpush(chatKey, messageData);
  await redis.expire(chatKey, CHAT_TTL);

  // Keep only last 100 messages to prevent memory issues
  await redis.ltrim(chatKey, -100, -1);
};

/**
 * Get all chat messages for a room
 */
export const getChatMessages = async (roomId: string): Promise<ChatMessage[]> => {
  const redis = getRedisClient();
  const chatKey = `${CHAT_KEY}${roomId}`;

  const messages = await redis.lrange(chatKey, 0, -1);

  return messages.map((msg: string) => JSON.parse(msg) as ChatMessage);
};

/**
 * Get recent chat messages (last N messages)
 */
export const getRecentChatMessages = async (
  roomId: string,
  count: number = 50,
): Promise<ChatMessage[]> => {
  const redis = getRedisClient();
  const chatKey = `${CHAT_KEY}${roomId}`;

  const messages = await redis.lrange(chatKey, -count, -1);

  return messages.map((msg: string) => JSON.parse(msg) as ChatMessage);
};

/**
 * Get leaderboard for a room (sorted by score descending)
 */
export const getLeaderboard = async (
  roomId: string,
): Promise<Array<{ playerId: string; score: number }>> => {
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
};

/**
 * Update player score
 */
export const updatePlayerScore = async (
  roomId: string,
  playerId: string,
  score: number,
): Promise<void> => {
  const redis = getRedisClient();
  const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

  await redis.zadd(leaderboardKey, score, playerId);
  await updatePlayer(roomId, playerId, { score });
};

/**
 * Delete a room and all associated data
 */
export const deleteRoom = async (roomId: string): Promise<void> => {
  const redis = getRedisClient();

  const roomKey = `${ROOM_KEY}${roomId}`;
  const chatKey = `${CHAT_KEY}${roomId}`;
  const playersKey = `${PLAYERS_KEY}${roomId}`;
  const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

  await redis.del(roomKey, chatKey, playersKey, leaderboardKey);
};

/**
 * Get all active room IDs
 */
export const getAllRoomIds = async (): Promise<string[]> => {
  const redis = getRedisClient();
  const keys = await redis.keys(`${ROOM_KEY}*`);

  return keys.map((key: string) => key.replace(ROOM_KEY, ''));
};

/**
 * Clean up empty rooms (rooms with no players)
 */
export const cleanupEmptyRooms = async (): Promise<number> => {
  const roomIds = await getAllRoomIds();
  let cleanedCount = 0;

  for (const roomId of roomIds) {
    const playerCount = await getPlayerCount(roomId);
    if (playerCount === 0) {
      const room = await getRoom(roomId);
      if (room && room.createdAt && Date.now() - room.createdAt > 5 * 60 * 1000) {
        // 5 minutes
        await deleteRoom(roomId);
        cleanedCount++;
      }
    }
  }

  return cleanedCount;
};
