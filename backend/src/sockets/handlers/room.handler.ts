import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import { Player, ChatMessage } from '../../types/index.js';
import { RoomRedisService } from '../../services/redis/room.redis.service.js';
import { PlayerRedisService } from '../../services/redis/player.redis.service.js';
import { ChatRedisService } from '../../services/redis/chat.redis.service.js';
import { TeamRedisService } from '../../services/redis/team.redis.service.js';

export const registerRoomHandlers = (io: Server, socket: AuthSocket) => {
  socket.on(
    'join-room',
    async (data: {
      roomId: string;
      quizId: string;
      username?: string;
      avatar?: string;
      mode?: string;
    }) => {
      try {
        const { roomId, quizId, mode } = data;
        const payloadUsername = (data.username ?? '').trim();
        const payloadAvatar = data.avatar;

        const effectiveUsername =
          (socket.user?.username || payloadUsername || 'Player').trim() || 'Player';
        const effectiveAvatar = socket.user?.profilePic ?? payloadAvatar;

        const roomExists = await RoomRedisService.roomExists(roomId);
        if (!roomExists) {
          await RoomRedisService.createRoom({
            roomId,
            quizId,
            createdAt: Date.now(),
            mode: mode || '1v1',
          });
        }

        const currentPlayerCount = await PlayerRedisService.getPlayerCount(roomId);
        const room = await RoomRedisService.getRoom(roomId);
        const roomMode = room?.mode || mode || '1v1';
        const maxCapacity =
          roomMode === '2v2'
            ? 4
            : roomMode === 'coop' || roomMode === 'custom' || roomMode === 'ffa'
              ? 10
              : 2;

        if (currentPlayerCount >= maxCapacity) {
          socket.emit('room:full', {
            message: 'Room is full',
            maxCapacity,
            currentCount: currentPlayerCount,
          });
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

        await PlayerRedisService.addPlayer(roomId, player);
        socket.join(roomId);

        const totalPlayers = await PlayerRedisService.getPlayerCount(roomId);

        io.to(roomId).emit('player-joined', {
          player: {
            id: player.id,
            username: player.username,
            avatar: player.avatar,
            score: player.score,
          },
          totalPlayers,
        });

        const roomState = await RoomRedisService.getRoom(roomId);
        const players = await PlayerRedisService.getAllPlayers(roomId);
        const messages = await ChatRedisService.getChatMessages(roomId);
        const teamAssignments = await TeamRedisService.getTeamAssignments(roomId);

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
        await ChatRedisService.addChatMessage(roomId, systemMessage);
        io.to(roomId).emit('chat-message', systemMessage);
      } catch (error) {
        console.error('Error in join-room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    },
  );

  socket.on('disconnect', async () => {
    console.log(`🔌 Socket.IO client disconnected: ${socket.id}`);
    try {
      const roomIds = await RoomRedisService.getAllRoomIds();

      for (const roomId of roomIds) {
        const player = await PlayerRedisService.getPlayer(roomId, socket.id);

        if (player) {
          await PlayerRedisService.removePlayer(roomId, socket.id);

          const remainingPlayers = await PlayerRedisService.getPlayerCount(roomId);

          io.to(roomId).emit('player-left', {
            playerId: socket.id,
            username: player.username,
            remainingPlayers,
          });

          const systemMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            username: 'System',
            message: `${player.username} left the room`,
            timestamp: Date.now(),
          };
          await ChatRedisService.addChatMessage(roomId, systemMessage);
          io.to(roomId).emit('chat-message', systemMessage);

          if (remainingPlayers === 0) {
            setTimeout(
              async () => {
                const count = await PlayerRedisService.getPlayerCount(roomId);
                if (count === 0) {
                  await RoomRedisService.deleteRoom(roomId);
                }
              },
              5 * 60 * 1000,
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });

  socket.on('leave-room', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        await PlayerRedisService.removePlayer(roomId, socket.id);
        socket.leave(roomId);

        const remainingPlayers = await PlayerRedisService.getPlayerCount(roomId);

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
      const player = await PlayerRedisService.getPlayer(roomId, playerId);
      if (!player) return;

      await PlayerRedisService.removePlayer(roomId, playerId);

      io.to(playerId).emit('player-kicked', {
        message: `You have been removed from the room by the host`,
      });

      const remainingPlayers = await PlayerRedisService.getPlayerCount(roomId);
      io.to(roomId).emit('player-left', {
        playerId,
        username: player.username,
        remainingPlayers,
      });
    } catch (error) {
      console.error('Error in kick-player:', error);
    }
  });

  socket.on(
    'settings:update',
    async (data: {
      roomId: string;
      settings: { topic: string; difficulty: string; count: number; duration: number };
    }) => {
      try {
        const { roomId, settings } = data;
        io.to(roomId).emit('settings:update', settings);
      } catch (error) {
        console.error('Error in settings:update:', error);
      }
    },
  );
};
