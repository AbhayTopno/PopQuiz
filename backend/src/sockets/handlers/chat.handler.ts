import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import { ChatMessage } from '../../types/index.js';
import { PlayerRedisService } from '../../services/redis/player.redis.service.js';
import { ChatRedisService } from '../../services/redis/chat.redis.service.js';

export const registerChatHandlers = (io: Server, socket: AuthSocket) => {
  socket.on('send-message', async (data: { roomId: string; message: string }) => {
    try {
      const { roomId, message } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username: player.username,
          message: message.trim(),
          timestamp: Date.now(),
          avatar: player.avatar,
        };

        await ChatRedisService.addChatMessage(roomId, chatMessage);
        io.to(roomId).emit('chat-message', chatMessage);
      }
    } catch (error) {
      console.error('Error in send-message:', error);
    }
  });

  socket.on('typing', async (data: { roomId: string; isTyping: boolean }) => {
    try {
      const { roomId, isTyping } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        socket.to(roomId).emit('user-typing', {
          username: player.username,
          isTyping,
        });
      }
    } catch (error) {
      console.error('Error in typing:', error);
    }
  });

  socket.on('send-reaction', async (data: { roomId: string; reaction: string }) => {
    try {
      const { roomId, reaction } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        io.to(roomId).emit('player-reaction', {
          playerId: socket.id,
          username: player.username,
          reaction,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error in send-reaction:', error);
    }
  });
};
