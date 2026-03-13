import { RoomRepository } from '../repositories/RoomRepository.js';
import { PlayerRepository } from '../repositories/PlayerRepository.js';
import { ChatRepository } from '../repositories/ChatRepository.js';
import { TeamRepository } from '../repositories/TeamRepository.js';
import { CoopRepository } from '../repositories/CoopRepository.js';
import type { Player, Room, ChatMessage, TeamAssignment } from '../types/index.js';
import type { CoopMember } from '../repositories/CoopRepository.js';

/**
 * RedisServiceFacade — OCP / DIP
 *
 * Composes all domain repositories into a single injection point.
 * Routes depend on this facade, not on individual repositories directly.
 * Adding a new mode = adding a new repository + wiring it here, zero
 * changes to existing routes or business logic.
 */
export class RedisServiceFacade {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly players: PlayerRepository,
    private readonly chat: ChatRepository,
    private readonly teams: TeamRepository,
    private readonly coop: CoopRepository,
  ) {}

  // ─── Health ──────────────────────────────────────────────────────────────
  async healthCheck(): Promise<boolean> {
    return this.rooms.healthCheck();
  }

  // ─── Rooms (shared across all modes) ─────────────────────────────────────
  createRoom(d: { roomId: string; quizId: string; createdAt: number; mode?: string }): Promise<void> {
    return this.rooms.createRoom(d);
  }
  getRoom(roomId: string): Promise<Partial<Room> | null> {
    return this.rooms.getRoom(roomId);
  }
  updateRoomStatus(roomId: string, s: { gameStarted?: boolean; gameFinished?: boolean }): Promise<void> {
    return this.rooms.updateRoomStatus(roomId, s);
  }
  roomExists(roomId: string): Promise<boolean> {
    return this.rooms.roomExists(roomId);
  }
  getAllRoomIds(): Promise<string[]> {
    return this.rooms.getAllRoomIds();
  }

  /** Full teardown: removes room + players + chat + teams + coop keys. */
  async deleteRoom(roomId: string): Promise<void> {
    await Promise.all([
      this.rooms.deleteRoom(roomId),
      this.players.deleteRoomPlayers(roomId),
      this.chat.deleteRoomChat(roomId),
      this.teams.deleteRoomTeams(roomId),
      this.coop.deleteRoomCoop(roomId),
    ]);
  }

  /**
   * Cleanup empty rooms older than 5 minutes.
   * Used by the backend's periodic cleanup interval.
   */
  async cleanupEmptyRooms(): Promise<number> {
    const roomIds = await this.rooms.getAllRoomIds();
    let cleaned = 0;
    for (const roomId of roomIds) {
      const count = await this.players.getPlayerCount(roomId);
      if (count === 0) {
        const room = await this.rooms.getRoom(roomId);
        if (room?.createdAt && Date.now() - room.createdAt > 5 * 60 * 1000) {
          await this.deleteRoom(roomId);
          cleaned++;
        }
      }
    }
    return cleaned;
  }

  // ─── Players (all modes: 1v1, 2v2, FFA, coop, custom) ───────────────────
  addPlayer(roomId: string, player: Player): Promise<void> {
    return this.players.addPlayer(roomId, player);
  }
  getPlayer(roomId: string, playerId: string): Promise<Player | null> {
    return this.players.getPlayer(roomId, playerId);
  }
  getAllPlayers(roomId: string): Promise<Player[]> {
    return this.players.getAllPlayers(roomId);
  }
  updatePlayer(roomId: string, playerId: string, updates: Partial<Player>): Promise<void> {
    return this.players.updatePlayer(roomId, playerId, updates);
  }
  updatePlayerScore(roomId: string, playerId: string, score: number): Promise<void> {
    return this.players.updatePlayerScore(roomId, playerId, score);
  }
  removePlayer(roomId: string, playerId: string): Promise<void> {
    return this.players.removePlayer(roomId, playerId);
  }
  getPlayerCount(roomId: string): Promise<number> {
    return this.players.getPlayerCount(roomId);
  }
  getLeaderboard(roomId: string): Promise<{ playerId: string; score: number }[]> {
    return this.players.getLeaderboard(roomId);
  }

  // ─── Chat (all modes) ─────────────────────────────────────────────────────
  addChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    return this.chat.addChatMessage(roomId, message);
  }
  getChatMessages(roomId: string): Promise<ChatMessage[]> {
    return this.chat.getChatMessages(roomId);
  }
  getRecentChatMessages(roomId: string, count?: number): Promise<ChatMessage[]> {
    return this.chat.getRecentChatMessages(roomId, count);
  }

  // ─── Teams (2v2 + Custom mode) ────────────────────────────────────────────
  setTeamAssignments(roomId: string, assignments: TeamAssignment): Promise<void> {
    return this.teams.setTeamAssignments(roomId, assignments);
  }
  getTeamAssignments(roomId: string): Promise<TeamAssignment | null> {
    return this.teams.getTeamAssignments(roomId);
  }
  setTeamAssignmentsByUsername(roomId: string, assignments: TeamAssignment): Promise<void> {
    return this.teams.setTeamAssignmentsByUsername(roomId, assignments);
  }
  getTeamAssignmentsByUsername(roomId: string): Promise<TeamAssignment | null> {
    return this.teams.getTeamAssignmentsByUsername(roomId);
  }
  setTeamScore(roomId: string, teamId: 'teamA' | 'teamB', score: number): Promise<void> {
    return this.teams.setTeamScore(roomId, teamId, score);
  }
  getTeamScore(roomId: string, teamId: 'teamA' | 'teamB'): Promise<number> {
    return this.teams.getTeamScore(roomId, teamId);
  }
  incrementTeamScore(roomId: string, teamId: 'teamA' | 'teamB', points: number): Promise<number> {
    return this.teams.incrementTeamScore(roomId, teamId, points);
  }

  // ─── Coop mode ───────────────────────────────────────────────────────────
  getCoopScore(roomId: string): Promise<number> {
    return this.coop.getScore(roomId);
  }
  setCoopScore(roomId: string, score: number): Promise<void> {
    return this.coop.setScore(roomId, score);
  }
  incrementCoopScore(roomId: string, points: number): Promise<number> {
    return this.coop.incrementScore(roomId, points);
  }
  getCoopMembers(roomId: string): Promise<CoopMember[]> {
    return this.coop.getMembers(roomId);
  }
  setCoopMembers(roomId: string, members: CoopMember[]): Promise<void> {
    return this.coop.setMembers(roomId, members);
  }
  addCoopMember(roomId: string, member: CoopMember): Promise<CoopMember[]> {
    return this.coop.addMember(roomId, member);
  }
}

/** Factory — creates and wires all repositories into the facade. */
export const createFacade = (): RedisServiceFacade =>
  new RedisServiceFacade(
    new RoomRepository(),
    new PlayerRepository(),
    new ChatRepository(),
    new TeamRepository(),
    new CoopRepository(),
  );
