import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import * as redisService from '../../services/redisService.js';
import type { ChatMessage } from '../../types/index.js';

export class ChatHandler {
  static register(io: Server, socket: AuthSocket) {
    socket.on('send-message', async (data: { roomId: string; message: string }) => {
      try {
        const { roomId, message } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          const chatMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            username: player.username,
            message: message.trim(),
            timestamp: Date.now(),
            avatar: player.avatar,
          };

          await redisService.addChatMessage(roomId, chatMessage);
          io.to(roomId).emit('chat-message', chatMessage);
        }
      } catch (error) {
        console.error('Error in send-message:', error);
      }
    });

    socket.on('typing', async (data: { roomId: string; isTyping: boolean }) => {
      try {
        const { roomId, isTyping } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

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
        const player = await redisService.getPlayer(roomId, socket.id);

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
  }
}
