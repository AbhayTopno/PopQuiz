import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from '../middlewares/socketAuthMiddleware.js';
import type { AuthSocket } from '../middlewares/socketAuthMiddleware.js';
import { registerRoomHandlers } from '../sockets/handlers/room.handler.js';
import { registerChatHandlers } from '../sockets/handlers/chat.handler.js';
import { registerGameHandlers } from '../sockets/handlers/game.handler.js';
import { registerTeamHandlers } from '../sockets/handlers/team.handler.js';
import { RoomRedisService } from './redis/room.redis.service.js';

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const escapeRegexSpecials = (value: string) => value.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

  const buildCorsValidator = () => {
    const raw = process.env.CORS_ORIGIN;

    if (!raw) {
      return (
        origin: string | undefined,
        callback: (_error: Error | null, _allow?: boolean) => void,
      ) => callback(null, true);
    }

    const origins = raw
      .split(',')
      .map((originValue) => originValue.trim())
      .filter(Boolean);

    const hasWildcard = origins.includes('*');

    const matchesOrigin = (value: string) =>
      origins.some((allowed) => {
        if (allowed === '*') {
          return true;
        }

        if (allowed.includes('*')) {
          const pattern = `^${escapeRegexSpecials(allowed).replace(/\\\*/g, '.*')}$`;
          return new RegExp(pattern, 'i').test(value.toLowerCase());
        }

        return allowed.toLowerCase() === value.toLowerCase();
      });

    return (
      origin: string | undefined,
      callback: (_error: Error | null, _allow?: boolean) => void,
    ) => {
      if (!origin) {
        return callback(null, true);
      }

      if (hasWildcard || matchesOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS policy`));
    };
  };

  const io = new Server(httpServer, {
    cors: {
      origin: buildCorsValidator(),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => socketAuthMiddleware(socket as unknown as AuthSocket, next));

  io.on('connection', (socket: AuthSocket) => {
    console.log(`🔌 Socket.IO client connected: ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerTeamHandlers(io, socket);
  });

  // Cleanup old rooms periodically (every hour)
  setInterval(
    async () => {
      try {
        await RoomRedisService.cleanupEmptyRooms();
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    },
    60 * 60 * 1000,
  );

  return io;
}
