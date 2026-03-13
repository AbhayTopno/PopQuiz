import type { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import type { IRedisRepository } from '../interfaces/IRedisRepository.js';
import type { TeamAssignment } from '../types/index.js';

/**
 * TeamRepository — SRP
 *
 * Responsible for 2v2 and Custom mode team assignments and shared team scores.
 *
 * Keys managed:
 *   team-assignments:{roomId}  → STRING (JSON TeamAssignment by socket ID)
 *   team_usernames:{roomId}    → STRING (JSON TeamAssignment by username — survives reconnects)
 *   team-score:{roomId}:teamA  → STRING (shared integer score)
 *   team-score:{roomId}:teamB  → STRING (shared integer score)
 */

const TEAM_KEY = 'team-assignments:';
const TEAM_USERNAMES_KEY = 'team_usernames:';
const TEAM_SCORE_KEY = 'team-score:';
const ROOM_TTL = 24 * 60 * 60;

export class TeamRepository implements IRedisRepository {
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

  // ─── Socket-ID based assignments ─────────────────────────────────────────

  async setTeamAssignments(roomId: string, assignments: TeamAssignment): Promise<void> {
    const deduped: TeamAssignment = {
      teamA: [...new Set(assignments.teamA)],
      teamB: [...new Set(assignments.teamB)],
    };
    await this.redis.set(`${TEAM_KEY}${roomId}`, JSON.stringify(deduped));
    await this.redis.expire(`${TEAM_KEY}${roomId}`, ROOM_TTL);
  }

  async getTeamAssignments(roomId: string): Promise<TeamAssignment | null> {
    const raw = await this.redis.get(`${TEAM_KEY}${roomId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TeamAssignment;
    } catch {
      return null;
    }
  }

  // ─── Username-based assignments (persist across socket reconnects) ────────

  async setTeamAssignmentsByUsername(
    roomId: string,
    assignments: TeamAssignment,
  ): Promise<void> {
    const deduped: TeamAssignment = {
      teamA: [...new Set(assignments.teamA)],
      teamB: [...new Set(assignments.teamB)],
    };
    await this.redis.set(`${TEAM_USERNAMES_KEY}${roomId}`, JSON.stringify(deduped));
    await this.redis.expire(`${TEAM_USERNAMES_KEY}${roomId}`, ROOM_TTL);
  }

  async getTeamAssignmentsByUsername(roomId: string): Promise<TeamAssignment | null> {
    const raw = await this.redis.get(`${TEAM_USERNAMES_KEY}${roomId}`);
    return raw ? (JSON.parse(raw) as TeamAssignment) : null;
  }

  // ─── Shared team scores (2v2 coop-style scoring) ─────────────────────────

  async setTeamScore(
    roomId: string,
    teamId: 'teamA' | 'teamB',
    score: number,
  ): Promise<void> {
    const key = `${TEAM_SCORE_KEY}${roomId}:${teamId}`;
    await this.redis.set(key, score.toString());
    await this.redis.expire(key, ROOM_TTL);
  }

  async getTeamScore(roomId: string, teamId: 'teamA' | 'teamB'): Promise<number> {
    const raw = await this.redis.get(`${TEAM_SCORE_KEY}${roomId}:${teamId}`);
    return raw ? parseInt(raw, 10) : 0;
  }

  /** Atomically increment a team's shared score by `points` and return the new value. */
  async incrementTeamScore(
    roomId: string,
    teamId: 'teamA' | 'teamB',
    points: number,
  ): Promise<number> {
    const key = `${TEAM_SCORE_KEY}${roomId}:${teamId}`;
    const newScore = await this.redis.incrby(key, points);
    await this.redis.expire(key, ROOM_TTL);
    return newScore;
  }

  /** Remove all team-related keys for a room (called on room deletion). */
  async deleteRoomTeams(roomId: string): Promise<void> {
    await this.redis.del(
      `${TEAM_KEY}${roomId}`,
      `${TEAM_USERNAMES_KEY}${roomId}`,
      `${TEAM_SCORE_KEY}${roomId}:teamA`,
      `${TEAM_SCORE_KEY}${roomId}:teamB`,
    );
  }
}
