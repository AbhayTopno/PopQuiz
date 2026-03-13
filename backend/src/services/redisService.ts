import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { ChatMessage, Player, Room } from '../types/index.js';

// Keys
const ROOM_KEY = 'room:';
const PLAYERS_KEY = 'players:';
const LEADERBOARD_KEY = 'leaderboard:';
const CHAT_KEY = 'chat:';
const TEAM_ASSIGNMENTS_KEY = 'team-assignments:';
const TEAM_A_SCORE_KEY = 'teamA-score:';
const TEAM_B_SCORE_KEY = 'teamB-score:';

const ROOM_TTL = 24 * 60 * 60; // 24 hours

// Helper
const getRedis = (): Redis => getRedisClient();

// ─────────────────────────────────────────────────────────────────────────────
// Rooms
// ─────────────────────────────────────────────────────────────────────────────

export const createRoom = async (roomData: {
  roomId: string;
  quizId: string;
  createdAt: number;
  mode?: string;
}): Promise<void> => {
  const redis = getRedis();
  const key = `${ROOM_KEY}${roomData.roomId}`;
  await redis.hmset(key, {
    roomId: roomData.roomId,
    quizId: roomData.quizId,
    createdAt: roomData.createdAt.toString(),
    gameStarted: 'false',
    gameFinished: 'false',
    mode: roomData.mode ?? '1v1',
  });
  await redis.expire(key, ROOM_TTL);
};

export const getRoom = async (roomId: string): Promise<Partial<Room> | null> => {
  const data = await getRedis().hgetall(`${ROOM_KEY}${roomId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    roomId: data.roomId,
    quizId: data.quizId,
    createdAt: parseInt(data.createdAt, 10),
    gameStarted: data.gameStarted === 'true',
    gameFinished: data.gameFinished === 'true',
    mode: data.mode ?? '1v1',
  };
};

export const updateRoomStatus = async (
  roomId: string,
  status: { gameStarted?: boolean; gameFinished?: boolean },
): Promise<void> => {
  const updates: Record<string, string> = {};
  if (status.gameStarted !== undefined) updates.gameStarted = status.gameStarted.toString();
  if (status.gameFinished !== undefined) updates.gameFinished = status.gameFinished.toString();
  await getRedis().hmset(`${ROOM_KEY}${roomId}`, updates);
};

export const roomExists = async (roomId: string): Promise<boolean> => {
  return (await getRedis().exists(`${ROOM_KEY}${roomId}`)) === 1;
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  const redis = getRedis();
  await redis.del(`${ROOM_KEY}${roomId}`);
  await redis.del(`${PLAYERS_KEY}${roomId}`);
  await redis.del(`${LEADERBOARD_KEY}${roomId}`);
  await redis.del(`${CHAT_KEY}${roomId}`);
  await redis.del(`${TEAM_ASSIGNMENTS_KEY}${roomId}`);
  await redis.del(`${TEAM_ASSIGNMENTS_KEY}${roomId}:usernames`);
  await redis.del(`${TEAM_A_SCORE_KEY}${roomId}`);
  await redis.del(`${TEAM_B_SCORE_KEY}${roomId}`);
};

export const getAllRoomIds = async (): Promise<string[]> => {
  const keys = await getRedis().keys(`${ROOM_KEY}*`);
  return keys.map((k) => k.replace(ROOM_KEY, ''));
};

export const cleanupEmptyRooms = async (): Promise<number> => {
  const roomIds = await getAllRoomIds();
  let cleanedCount = 0;
  for (const id of roomIds) {
    const pCount = await getPlayerCount(id);
    if (pCount === 0) {
      await deleteRoom(id);
      cleanedCount++;
    }
  }
  return cleanedCount;
};

// ─────────────────────────────────────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────────────────────────────────────

const deserializePlayer = (playerStr: string): Player => {
  const d = JSON.parse(playerStr) as Record<string, string>;
  return {
    id: d.id,
    username: d.username,
    avatar: d.avatar || undefined,
    score: parseInt(d.score, 10),
    currentQuestionIndex: parseInt(d.currentQuestionIndex, 10),
    isReady: d.isReady === 'true',
    joinedAt: parseInt(d.joinedAt, 10),
    answers: JSON.parse(d.answers) as Player['answers'],
  };
};

export const addPlayer = async (roomId: string, player: Player): Promise<void> => {
  const redis = getRedis();
  const playersKey = `${PLAYERS_KEY}${roomId}`;
  const leaderboardKey = `${LEADERBOARD_KEY}${roomId}`;

  const serialized = {
    id: player.id,
    username: player.username,
    avatar: player.avatar ?? '',
    score: player.score.toString(),
    currentQuestionIndex: player.currentQuestionIndex.toString(),
    isReady: player.isReady.toString(),
    joinedAt: player.joinedAt.toString(),
    answers: JSON.stringify(player.answers),
  };

  await redis.hset(playersKey, player.id, JSON.stringify(serialized));
  await redis.expire(playersKey, ROOM_TTL);
  await redis.zadd(leaderboardKey, player.score, player.id);
  await redis.expire(leaderboardKey, ROOM_TTL);
};

export const getPlayer = async (roomId: string, playerId: string): Promise<Player | null> => {
  const raw = await getRedis().hget(`${PLAYERS_KEY}${roomId}`, playerId);
  if (!raw) return null;
  return deserializePlayer(raw);
};

export const getAllPlayers = async (roomId: string): Promise<Player[]> => {
  const all = await getRedis().hgetall(`${PLAYERS_KEY}${roomId}`);
  if (!all || Object.keys(all).length === 0) return [];
  return (Object.values(all) as string[]).map(deserializePlayer);
};

export const updatePlayer = async (
  roomId: string,
  playerId: string,
  updates: Partial<Player>,
): Promise<void> => {
  const redis = getRedis();
  const playersKey = `${PLAYERS_KEY}${roomId}`;
  const raw = await redis.hget(playersKey, playerId);
  if (!raw) return;

  const existing = JSON.parse(raw) as Record<string, string>;
  const updated = {
    ...existing,
    ...(updates.username !== undefined && { username: updates.username }),
    ...(updates.avatar !== undefined && { avatar: updates.avatar ?? '' }),
    ...(updates.score !== undefined && { score: updates.score.toString() }),
    ...(updates.currentQuestionIndex !== undefined && {
      currentQuestionIndex: updates.currentQuestionIndex.toString(),
    }),
    ...(updates.isReady !== undefined && { isReady: updates.isReady.toString() }),
    ...(updates.answers !== undefined && { answers: JSON.stringify(updates.answers) }),
  };

  await redis.hset(playersKey, playerId, JSON.stringify(updated));

  if (updates.score !== undefined) {
    await redis.zadd(`${LEADERBOARD_KEY}${roomId}`, updates.score, playerId);
  }
};

export const updatePlayerScore = async (
  roomId: string,
  playerId: string,
  score: number,
): Promise<void> => {
  const redis = getRedis();
  await redis.zadd(`${LEADERBOARD_KEY}${roomId}`, score, playerId);
  await updatePlayer(roomId, playerId, { score });
};

export const removePlayer = async (roomId: string, playerId: string): Promise<void> => {
  const redis = getRedis();
  await redis.hdel(`${PLAYERS_KEY}${roomId}`, playerId);
  await redis.zrem(`${LEADERBOARD_KEY}${roomId}`, playerId);
};

export const getPlayerCount = async (roomId: string): Promise<number> => {
  return await getRedis().hlen(`${PLAYERS_KEY}${roomId}`);
};

export const getLeaderboard = async (
  roomId: string,
): Promise<Array<{ playerId: string; score: number }>> => {
  const raw = await getRedis().zrevrange(`${LEADERBOARD_KEY}${roomId}`, 0, -1, 'WITHSCORES');
  const result: { playerId: string; score: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    result.push({ playerId: raw[i], score: parseInt(raw[i + 1], 10) });
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

export const addChatMessage = async (roomId: string, message: ChatMessage): Promise<void> => {
  const redis = getRedis();
  const key = `${CHAT_KEY}${roomId}`;
  await redis.rpush(key, JSON.stringify(message));
  await redis.ltrim(key, -100, -1);
  await redis.expire(key, ROOM_TTL);
};

export const getChatMessages = async (roomId: string): Promise<ChatMessage[]> => {
  const msgs = await getRedis().lrange(`${CHAT_KEY}${roomId}`, 0, -1);
  return msgs.map((m) => JSON.parse(m) as ChatMessage);
};

export const getRecentChatMessages = async (roomId: string, count = 50): Promise<ChatMessage[]> => {
  const msgs = await getRedis().lrange(`${CHAT_KEY}${roomId}`, -count, -1);
  return msgs.map((m) => JSON.parse(m) as ChatMessage);
};

// ─────────────────────────────────────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────────────────────────────────────

export const setTeamAssignments = async (
  roomId: string,
  teamAssignments: { teamA: string[]; teamB: string[] },
): Promise<void> => {
  await getRedis().set(
    `${TEAM_ASSIGNMENTS_KEY}${roomId}`,
    JSON.stringify(teamAssignments),
    'EX',
    ROOM_TTL,
  );
};

export const getTeamAssignments = async (
  roomId: string,
): Promise<{ teamA: string[]; teamB: string[] } | null> => {
  const data = await getRedis().get(`${TEAM_ASSIGNMENTS_KEY}${roomId}`);
  return data ? JSON.parse(data) : null;
};

export const setTeamAssignmentsByUsername = async (
  roomId: string,
  teamAssignments: { teamA: string[]; teamB: string[] },
): Promise<void> => {
  await getRedis().set(
    `${TEAM_ASSIGNMENTS_KEY}${roomId}:usernames`,
    JSON.stringify(teamAssignments),
    'EX',
    ROOM_TTL,
  );
};

export const getTeamAssignmentsByUsername = async (
  roomId: string,
): Promise<{ teamA: string[]; teamB: string[] } | null> => {
  const data = await getRedis().get(`${TEAM_ASSIGNMENTS_KEY}${roomId}:usernames`);
  return data ? JSON.parse(data) : null;
};

export const setTeamScore = async (
  roomId: string,
  teamId: 'teamA' | 'teamB',
  score: number,
): Promise<void> => {
  const key = teamId === 'teamA' ? TEAM_A_SCORE_KEY : TEAM_B_SCORE_KEY;
  await getRedis().set(`${key}${roomId}`, score.toString(), 'EX', ROOM_TTL);
};

export const getTeamScore = async (roomId: string, teamId: 'teamA' | 'teamB'): Promise<number> => {
  const key = teamId === 'teamA' ? TEAM_A_SCORE_KEY : TEAM_B_SCORE_KEY;
  const val = await getRedis().get(`${key}${roomId}`);
  return val ? parseInt(val, 10) : 0;
};

export const incrementTeamScore = async (
  roomId: string,
  teamId: 'teamA' | 'teamB',
  points: number,
): Promise<number> => {
  const key = teamId === 'teamA' ? TEAM_A_SCORE_KEY : TEAM_B_SCORE_KEY;
  const newScore = await getRedis().incrby(`${key}${roomId}`, points);
  await getRedis().expire(`${key}${roomId}`, ROOM_TTL);
  return newScore;
};
