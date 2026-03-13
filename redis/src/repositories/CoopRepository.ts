import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { IRedisRepository } from '../interfaces/IRedisRepository.js';

/**
 * CoopRepository — SRP
 *
 * Responsible for Co-op mode only.
 * Manages the shared team score and member list under namespaced keys.
 *
 * Keys managed:
 *   coop:{roomId}:score   → STRING (integer)
 *   coop:{roomId}:members → STRING (JSON array of {id, username, avatar?})
 */

const COOP_TTL = 7200; // 2 hours

export type CoopMember = {
  id: string;
  username: string;
  avatar?: string;
};

export class CoopRepository implements IRedisRepository {
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

  // ─── Score ────────────────────────────────────────────────────────────────

  async getScore(roomId: string): Promise<number> {
    const raw = await this.redis.get(`coop:${roomId}:score`);
    return raw ? parseInt(raw, 10) : 0;
  }

  async setScore(roomId: string, score: number): Promise<void> {
    await this.redis.set(`coop:${roomId}:score`, score.toString());
    await this.redis.expire(`coop:${roomId}:score`, COOP_TTL);
  }

  /** Atomically add `points` to the co-op score and return the new total. */
  async incrementScore(roomId: string, points: number): Promise<number> {
    const key = `coop:${roomId}:score`;
    const newScore = await this.redis.incrby(key, points);
    await this.redis.expire(key, COOP_TTL);
    return newScore;
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  async getMembers(roomId: string): Promise<CoopMember[]> {
    const raw = await this.redis.get(`coop:${roomId}:members`);
    return raw ? (JSON.parse(raw) as CoopMember[]) : [];
  }

  async setMembers(roomId: string, members: CoopMember[]): Promise<void> {
    await this.redis.set(`coop:${roomId}:members`, JSON.stringify(members));
    await this.redis.expire(`coop:${roomId}:members`, COOP_TTL);
  }

  /**
   * Add a member to the coop room if not already present (idempotent).
   * Returns the updated member list.
   */
  async addMember(roomId: string, member: CoopMember): Promise<CoopMember[]> {
    const existing = await this.getMembers(roomId);
    const alreadyIn = existing.some((m) => m.id === member.id);
    if (!alreadyIn) existing.push(member);
    await this.setMembers(roomId, existing);
    return existing;
  }

  /** Remove all coop data for a room (called on room deletion). */
  async deleteRoomCoop(roomId: string): Promise<void> {
    await this.redis.del(`coop:${roomId}:score`, `coop:${roomId}:members`);
  }
}
