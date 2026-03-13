import { Server as HTTPServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import { SocketManager } from '../websockets/SocketManager.js';
import { ChatMessage, Player, ScoreUpdate, AnswerSubmission } from '../types/index.js';

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const manager = new SocketManager(httpServer);
  return manager.getServer();
}

// Export types for use in other files (to maintain backward compatibility for imports)
export type { Player, ChatMessage, ScoreUpdate, AnswerSubmission };
