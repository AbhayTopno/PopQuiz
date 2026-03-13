import type { Server, Socket } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import * as redisService from '../../services/redisService.js';
import type { Player, ChatMessage } from '../../types/index.js';

export class RoomHandler {
  static register(io: Server, socket: AuthSocket) {
    socket.on('join-room', async (data: { roomId: string; quizId: string; username?: string; avatar?: string; mode?: string }) => {
      try {
        const { roomId, quizId, mode } = data;
        const payloadUsername = (data.username ?? '').trim();
        const payloadAvatar = data.avatar;

        const effectiveUsername = (socket.user?.username || payloadUsername || 'Player').trim() || 'Player';
        const effectiveAvatar = socket.user?.profilePic ?? payloadAvatar;

        const roomExists = await redisService.roomExists(roomId);
        if (!roomExists) {
          await redisService.createRoom({
            roomId,
            quizId,
            createdAt: Date.now(),
            mode: mode || '1v1',
          });
        }

        const currentPlayerCount = await redisService.getPlayerCount(roomId);
        const room = await redisService.getRoom(roomId);
        const roomMode = room?.mode || mode || '1v1';
        const maxCapacity = roomMode === '2v2' ? 4 : roomMode === 'coop' || roomMode === 'custom' || roomMode === 'ffa' ? 10 : 2;

        if (currentPlayerCount >= maxCapacity) {
          socket.emit('room:full', { message: 'Room is full', maxCapacity, currentCount: currentPlayerCount });
          return;
        }

        const player: Player = {
          id: socket.id,
          username: effectiveUsername,
          avatar: effectiveAvatar,
          score: 0,
          currentQuestionIndex: 0,
          answers: [],
          isReady: false,
          joinedAt: Date.now(),
        };

        await redisService.addPlayer(roomId, player);
        socket.join(roomId);

        const totalPlayers = await redisService.getPlayerCount(roomId);

        io.to(roomId).emit('player-joined', {
          player: { id: player.id, username: player.username, avatar: player.avatar, score: player.score },
          totalPlayers,
        });

        const roomState = await redisService.getRoom(roomId);
        const players = await redisService.getAllPlayers(roomId);
        const messages = await redisService.getChatMessages(roomId);
        const teamAssignments = await redisService.getTeamAssignments(roomId);

        const playersList = players.map((p) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          score: p.score,
          isReady: p.isReady,
        }));

        socket.emit('room-state', {
          players: playersList,
          messages,
          teamAssignments: teamAssignments || { teamA: [], teamB: [] },
          gameStarted: roomState?.gameStarted || false,
          gameFinished: roomState?.gameFinished || false,
        });

        const systemMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username: 'System',
          message: `${effectiveUsername} joined the room`,
          timestamp: Date.now(),
        };
        await redisService.addChatMessage(roomId, systemMessage);
        io.to(roomId).emit('chat-message', systemMessage);
      } catch (error) {
        console.error('Error in join-room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          await redisService.removePlayer(roomId, socket.id);
          socket.leave(roomId);
          const remainingPlayers = await redisService.getPlayerCount(roomId);
          io.to(roomId).emit('player-left', {
            playerId: socket.id,
            username: player.username,
            remainingPlayers,
          });
        }
      } catch (error) {
        console.error('Error in leave-room:', error);
      }
    });

    socket.on('kick-player', async (data: { roomId: string; playerId: string }) => {
      try {
        const { roomId, playerId } = data;
        const player = await redisService.getPlayer(roomId, playerId);
        if (!player) return;

        await redisService.removePlayer(roomId, playerId);
        io.to(playerId).emit('player-kicked', { message: `You have been removed from the room by the host` });

        const remainingPlayers = await redisService.getPlayerCount(roomId);
        io.to(roomId).emit('player-left', {
          playerId,
          username: player.username,
          remainingPlayers,
        });
      } catch (error) {
        console.error('Error in kick-player:', error);
      }
    });

    socket.on('settings:update', async (data: { roomId: string; settings: any }) => {
      try {
        io.to(data.roomId).emit('settings:update', data.settings);
      } catch (error) {
        console.error('Error in settings:update:', error);
      }
    });
  }
}
