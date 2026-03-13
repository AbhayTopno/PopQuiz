import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { IRedisRepository } from '../interfaces/IRedisRepository.js';
import type { Player } from '../types/index.js';

/**
 * PlayerRepository — SRP
 *
 * Responsible exclusively for Player entity persistence.
 * Used by ALL game modes (1v1, 2v2, FFA, coop, custom).
 *
 * Keys managed:
 *   players:{roomId}     → HASH  field=playerId, value=JSON(Player)
 *   leaderboard:{roomId} → ZSET  member=playerId, score=score
 */

const PLAYERS_KEY = 'players:';
const LEADERBOARD_KEY = 'leaderboard:';
const ROOM_TTL = 24 * 60 * 60;

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

export class PlayerRepository implements IRedisRepository {
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

  /** Add a new player to the room's player hash and the leaderboard sorted set. */
  async addPlayer(roomId: string, player: Player): Promise<void> {
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

    await this.redis.hset(playersKey, player.id, JSON.stringify(serialized));
    await this.redis.expire(playersKey, ROOM_TTL);
    await this.redis.zadd(leaderboardKey, player.score, player.id);
    await this.redis.expire(leaderboardKey, ROOM_TTL);
  }

  /** Retrieve a single player. Returns null if not found. */
  async getPlayer(roomId: string, playerId: string): Promise<Player | null> {
    const raw = await this.redis.hget(`${PLAYERS_KEY}${roomId}`, playerId);
    if (!raw) return null;
    return deserializePlayer(raw);
  }

  /** Retrieve all players in a room. */
  async getAllPlayers(roomId: string): Promise<Player[]> {
    const all = await this.redis.hgetall(`${PLAYERS_KEY}${roomId}`);
    if (!all || Object.keys(all).length === 0) return [];
    return (Object.values(all) as string[]).map(deserializePlayer);
  }

  /** Partially update a player's fields. Also syncs the leaderboard if score changed. */
  async updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<Player>,
  ): Promise<void> {
    const playersKey = `${PLAYERS_KEY}${roomId}`;
    const raw = await this.redis.hget(playersKey, playerId);
    if (!raw) throw new Error(`Player ${playerId} not found in room ${roomId}`);

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

    await this.redis.hset(playersKey, playerId, JSON.stringify(updated));

    if (updates.score !== undefined) {
      await this.redis.zadd(`${LEADERBOARD_KEY}${roomId}`, updates.score, playerId);
    }
  }

  /** Direct score update — sets both the player hash and the leaderboard ZSET. */
  async updatePlayerScore(roomId: string, playerId: string, score: number): Promise<void> {
    await this.redis.zadd(`${LEADERBOARD_KEY}${roomId}`, score, playerId);
    await this.updatePlayer(roomId, playerId, { score });
  }

  /** Remove a player from the room's hash and leaderboard. */
  async removePlayer(roomId: string, playerId: string): Promise<void> {
    await this.redis.hdel(`${PLAYERS_KEY}${roomId}`, playerId);
    await this.redis.zrem(`${LEADERBOARD_KEY}${roomId}`, playerId);
  }

  /** Return the number of players currently in a room. */
  async getPlayerCount(roomId: string): Promise<number> {
    return this.redis.hlen(`${PLAYERS_KEY}${roomId}`);
  }

  /** Return all players sorted by score descending (for leaderboard). */
  async getLeaderboard(roomId: string): Promise<{ playerId: string; score: number }[]> {
    const raw = await this.redis.zrevrange(`${LEADERBOARD_KEY}${roomId}`, 0, -1, 'WITHSCORES');
    const result: { playerId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ playerId: raw[i], score: parseInt(raw[i + 1], 10) });
    }
    return result;
  }

  /** Remove all player and leaderboard data for a room (called on room deletion). */
  async deleteRoomPlayers(roomId: string): Promise<void> {
    await this.redis.del(`${PLAYERS_KEY}${roomId}`, `${LEADERBOARD_KEY}${roomId}`);
  }
}
