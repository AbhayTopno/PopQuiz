import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, type AuthSocket } from '../middlewares/socketAuthMiddleware.js';
import * as redisService from '../services/redisService.js';

import { RoomHandler } from './handlers/RoomHandler.js';
import { ChatHandler } from './handlers/ChatHandler.js';
import { GameProgressHandler } from './handlers/GameProgressHandler.js';
import { GameModeHandler } from './handlers/GameModeHandler.js';

export class SocketManager {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: this.buildCorsValidator(),
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    this.setupMiddlewares();
    this.setupConnectionHandlers();
    this.startCleanupInterval();
  }

  private buildCorsValidator() {
    const raw = process.env.CORS_ORIGIN;
    if (!raw) {
      return (origin: string | undefined, callback: (_error: Error | null, _allow?: boolean) => void) => callback(null, true);
    }

    const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
    const hasWildcard = origins.includes('*');

    const escapeRegexSpecials = (value: string) => value.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

    const matchesOrigin = (value: string) =>
      origins.some((allowed) => {
        if (allowed === '*') return true;
        if (allowed.includes('*')) {
          const pattern = `^${escapeRegexSpecials(allowed).replace(/\\\*/g, '.*')}$`;
          return new RegExp(pattern, 'i').test(value.toLowerCase());
        }
        return allowed.toLowerCase() === value.toLowerCase();
      });

    return (origin: string | undefined, callback: (_error: Error | null, _allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (hasWildcard || matchesOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS policy`));
    };
  }

  private setupMiddlewares() {
    this.io.use((socket, next) => socketAuthMiddleware(socket as unknown as AuthSocket, next));
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket: AuthSocket) => {
      console.log(`🔌 Socket.IO client connected: ${socket.id}`);

      // Register Domain Handlers
      RoomHandler.register(this.io, socket);
      ChatHandler.register(this.io, socket);
      GameProgressHandler.register(this.io, socket);
      GameModeHandler.register(this.io, socket);

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`🔌 Socket.IO client disconnected: ${socket.id}`);
        try {
          const roomIds = await redisService.getAllRoomIds();

          for (const roomId of roomIds) {
            const player = await redisService.getPlayer(roomId, socket.id);

            if (player) {
              await redisService.removePlayer(roomId, socket.id);
              const remainingPlayers = await redisService.getPlayerCount(roomId);

              this.io.to(roomId).emit('player-left', {
                playerId: socket.id,
                username: player.username,
                remainingPlayers,
              });

              const systemMessage = {
                id: `${Date.now()}-${Math.random()}`,
                username: 'System',
                message: `${player.username} left the room`,
                timestamp: Date.now(),
              };
              await redisService.addChatMessage(roomId, systemMessage);
              this.io.to(roomId).emit('chat-message', systemMessage);

              if (remainingPlayers === 0) {
                setTimeout(async () => {
                  const count = await redisService.getPlayerCount(roomId);
                  if (count === 0) {
                    await redisService.deleteRoom(roomId);
                  }
                }, 5 * 60 * 1000);
              }
            }
          }
        } catch (error) {
          console.error('Error in disconnect:', error);
        }
      });
    });
  }

  private startCleanupInterval() {
    setInterval(async () => {
      try {
        await redisService.cleanupEmptyRooms();
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    }, 60 * 60 * 1000);
  }

  public getServer() {
    return this.io;
  }
}
