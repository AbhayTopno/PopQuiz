import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import { ChatMessage, Player, ScoreUpdate } from '../types/index.js';
import type { AnswerSubmission } from '../types/index.js';
import * as redisService from './redisService.js';
import { socketAuthMiddleware } from '../middlewares/socketAuthMiddleware.js';
import type { AuthSocket } from '../middlewares/socketAuthMiddleware.js';

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_API,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach authentication middleware so we can identify users by JWT cookie
  io.use((socket, next) => socketAuthMiddleware(socket as unknown as AuthSocket, next));

  io.on('connection', (socket: AuthSocket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a quiz room
    socket.on(
      'join-room',
      async (data: { roomId: string; quizId: string; username?: string; avatar?: string }) => {
        try {
          const { roomId, quizId } = data;
          const payloadUsername = (data.username ?? '').trim();
          const payloadAvatar = data.avatar;

          // Prefer authenticated user details when available
          const effectiveUsername =
            (socket.user?.username || payloadUsername || 'Player').trim() || 'Player';
          const effectiveAvatar = socket.user?.profilePic ?? payloadAvatar;

          // Create room if it doesn't exist
          const roomExists = await redisService.roomExists(roomId);
          if (!roomExists) {
            await redisService.createRoom({
              roomId,
              quizId,
              createdAt: Date.now(),
            });
          }

          // Add player to room
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

          // Get player count
          const totalPlayers = await redisService.getPlayerCount(roomId);

          // Notify all players in the room
          io.to(roomId).emit('player-joined', {
            player: {
              id: player.id,
              username: player.username,
              avatar: player.avatar,
              score: player.score,
            },
            totalPlayers,
          });

          // Get room state
          const room = await redisService.getRoom(roomId);
          const players = await redisService.getAllPlayers(roomId);
          const messages = await redisService.getChatMessages(roomId);

          const playersList = players.map((p) => ({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            score: p.score,
            isReady: p.isReady,
          }));

          // Send current room state to the newly joined player
          socket.emit('room-state', {
            players: playersList,
            messages,
            gameStarted: room?.gameStarted || false,
            gameFinished: room?.gameFinished || false,
          });

          // Send system message
          const systemMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            username: 'System',
            message: `${effectiveUsername} joined the room`,
            timestamp: Date.now(),
          };
          await redisService.addChatMessage(roomId, systemMessage);
          io.to(roomId).emit('chat-message', systemMessage);

          console.log(`👤 ${effectiveUsername} joined room ${roomId}`);
        } catch (error) {
          console.error('Error in join-room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      },
    );

    // Player ready status
    socket.on('player-ready', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          await redisService.updatePlayer(roomId, socket.id, { isReady: true });

          io.to(roomId).emit('player-ready-update', {
            playerId: socket.id,
            username: player.username,
            isReady: true,
          });

          // Check if all players are ready
          const players = await redisService.getAllPlayers(roomId);
          const allReady = players.every((p) => p.isReady);
          const playerCount = await redisService.getPlayerCount(roomId);

          if (allReady && playerCount >= 2) {
            await redisService.updateRoomStatus(roomId, { gameStarted: true });
            io.to(roomId).emit('game-start', {
              message: 'All players are ready! Game starting...',
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error('Error in player-ready:', error);
      }
    });

    // Handle chat messages
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

          // Broadcast to all players in the room
          io.to(roomId).emit('chat-message', chatMessage);
        }
      } catch (error) {
        console.error('Error in send-message:', error);
      }
    });

    // Handle answer submission and score update
    socket.on('submit-answer', async (data: { roomId: string; answer: AnswerSubmission }) => {
      try {
        const { roomId, answer } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          // Record the answer
          const newAnswer = {
            questionIndex: answer.questionIndex,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            timestamp: Date.now(),
          };
          player.answers.push(newAnswer);

          // Update score if correct
          let newScore = player.score;
          if (answer.isCorrect) {
            newScore += 1;
          }

          const newQuestionIndex = answer.questionIndex + 1;

          // Update player in Redis
          await redisService.updatePlayer(roomId, socket.id, {
            score: newScore,
            currentQuestionIndex: newQuestionIndex,
            answers: player.answers,
          });

          // Broadcast score update to all players
          const scoreUpdate: ScoreUpdate = {
            playerId: socket.id,
            username: player.username,
            score: newScore,
            currentQuestionIndex: newQuestionIndex,
            totalQuestions: 0, // This should be passed from the client
          };

          io.to(roomId).emit('score-update', scoreUpdate);

          // Send live feedback to other players
          io.to(roomId).emit('player-answered', {
            playerId: socket.id,
            username: player.username,
            questionIndex: answer.questionIndex,
            isCorrect: answer.isCorrect,
          });
        }
      } catch (error) {
        console.error('Error in submit-answer:', error);
      }
    });

    // Handle question progress
    socket.on('question-progress', async (data: { roomId: string; questionIndex: number }) => {
      try {
        const { roomId, questionIndex } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          await redisService.updatePlayer(roomId, socket.id, {
            currentQuestionIndex: questionIndex,
          });

          io.to(roomId).emit('player-progress', {
            playerId: socket.id,
            username: player.username,
            questionIndex,
          });
        }
      } catch (error) {
        console.error('Error in question-progress:', error);
      }
    });

    // Handle quiz completion
    socket.on('quiz-completed', async (data: { roomId: string; finalScore: number }) => {
      try {
        const { roomId, finalScore } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          await redisService.updatePlayer(roomId, socket.id, { score: finalScore });

          // Broadcast completion
          io.to(roomId).emit('player-completed', {
            playerId: socket.id,
            username: player.username,
            finalScore,
            completedAt: Date.now(),
          });

          // Check if all players have completed
          const players = await redisService.getAllPlayers(roomId);
          const allCompleted = players.every((p) => p.currentQuestionIndex >= 0); // Adjust based on your logic

          if (allCompleted) {
            await redisService.updateRoomStatus(roomId, { gameFinished: true });

            // Calculate final rankings
            const rankings = players
              .map((p) => ({
                username: p.username,
                avatar: p.avatar,
                score: p.score,
                answers: p.answers.length,
              }))
              .sort((a, b) => b.score - a.score);

            io.to(roomId).emit('game-finished', {
              rankings,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error('Error in quiz-completed:', error);
      }
    });

    // Handle typing indicator
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

    // Handle reactions/emojis
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

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      try {
        // Find and remove player from all rooms
        const roomIds = await redisService.getAllRoomIds();

        for (const roomId of roomIds) {
          const player = await redisService.getPlayer(roomId, socket.id);

          if (player) {
            await redisService.removePlayer(roomId, socket.id);

            const remainingPlayers = await redisService.getPlayerCount(roomId);

            // Notify other players
            io.to(roomId).emit('player-left', {
              playerId: socket.id,
              username: player.username,
              remainingPlayers,
            });

            // Send system message
            const systemMessage: ChatMessage = {
              id: `${Date.now()}-${Math.random()}`,
              username: 'System',
              message: `${player.username} left the room`,
              timestamp: Date.now(),
            };
            await redisService.addChatMessage(roomId, systemMessage);
            io.to(roomId).emit('chat-message', systemMessage);

            // Clean up empty rooms after 5 minutes
            if (remainingPlayers === 0) {
              setTimeout(
                async () => {
                  const count = await redisService.getPlayerCount(roomId);
                  if (count === 0) {
                    await redisService.deleteRoom(roomId);
                    console.log(`🗑️  Deleted empty room: ${roomId}`);
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

    // Handle leave room explicitly
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

    // Settings update (host broadcasts settings changes)
    socket.on(
      'settings:update',
      async (data: {
        roomId: string;
        settings: { topic: string; difficulty: string; count: number; duration: number };
      }) => {
        try {
          const { roomId, settings } = data;
          // Broadcast updated settings to all players in the room
          io.to(roomId).emit('settings:update', settings);
          console.log(`⚙️  Settings updated in room ${roomId}:`, settings);
        } catch (error) {
          console.error('Error in settings:update:', error);
        }
      },
    );

    // Start quiz (for co-op modes)
    socket.on('quiz:start', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });

        // Broadcast quiz start to all players
        io.to(roomId).emit('quiz:start', { quizId, duration });

        console.log(`🎮 Quiz started in room ${roomId}: ${quizId}`);
      } catch (error) {
        console.error('Error in quiz:start:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    // Initialize versus mode (1v1 battles)
    socket.on('versus:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });

        // Start countdown for versus mode
        let countdown = 3;
        const countdownInterval = setInterval(() => {
          if (countdown > 0) {
            io.to(roomId).emit('versus:countdown', countdown);
            countdown--;
          } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('quiz:start', { quizId, duration });
            console.log(`⚔️  Versus battle started in room ${roomId}: ${quizId}`);
          }
        }, 1000);
      } catch (error) {
        console.error('Error in versus:init:', error);
        socket.emit('error', { message: 'Failed to start versus battle' });
      }
    });

    // 1v1 Arena: Score update during battle
    socket.on(
      'score-update',
      async (data: {
        roomId: string;
        score: number;
        currentQuestion: number;
        finished: boolean;
      }) => {
        try {
          const { roomId, score, currentQuestion, finished } = data;
          let player = await redisService.getPlayer(roomId, socket.id);

          if (!player) {
            console.log(
              `⚠️  Player not found in Redis during score-update, adding now... (${socket.id})`,
            );
            // Player might not be in Redis yet, try to find username from connection
            const username = 'Player'; // Fallback
            player = {
              id: socket.id,
              username,
              score: 0,
              currentQuestionIndex: 0,
              answers: [],
              isReady: false,
              joinedAt: Date.now(),
            };
            await redisService.addPlayer(roomId, player);
          }

          // Update player score in Redis
          await redisService.updatePlayer(roomId, socket.id, {
            score,
            currentQuestionIndex: currentQuestion,
          });

          // Broadcast score update to ALL players in the room (including sender for confirmation)
          const scoreUpdateData = {
            id: socket.id,
            username: player.username,
            score,
            currentQuestion,
            finished,
          };

          // Emit to everyone in the room (synchronous like chat)
          io.to(roomId).emit('score-update-broadcast', scoreUpdateData);

          console.log(
            `📊 Score synced to Redis: ${player.username} - ${score} pts (Q${currentQuestion}) → Broadcasting to room ${roomId}`,
          );
        } catch (error) {
          console.error('Error in score-update:', error);
        }
      },
    );

    // 1v1 Arena: Player finished quiz
    socket.on(
      'player-finished',
      async (data: { roomId: string; username: string; score: number }) => {
        try {
          const { roomId, username, score } = data;

          // Mark player as finished
          await redisService.updatePlayer(roomId, socket.id, {
            score,
            isReady: true, // Reusing isReady to mean "finished"
          });

          // Notify opponent that this player finished
          socket.to(roomId).emit('opponent-finished', { username, score });

          // Check if both players finished
          const players = await redisService.getAllPlayers(roomId);
          const allFinished = players.every((p) => p.isReady);

          if (allFinished && players.length >= 2) {
            // Battle complete - send final results to both
            io.to(roomId).emit('battle-complete', {
              players: players.map((p) => ({
                id: p.id,
                username: p.username,
                score: p.score,
              })),
            });

            console.log(`⚔️  1v1 Battle completed in room ${roomId}`);
          }
        } catch (error) {
          console.error('Error in player-finished:', error);
        }
      },
    );

    // Get current leaderboard
    // Get leaderboard
    socket.on('get-leaderboard', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const roomExists = await redisService.roomExists(roomId);

        if (roomExists) {
          const players = await redisService.getAllPlayers(roomId);

          const leaderboard = players
            .map((p) => ({
              playerId: p.id,
              username: p.username,
              avatar: p.avatar,
              score: p.score,
              currentQuestionIndex: p.currentQuestionIndex,
            }))
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              return a.currentQuestionIndex - b.currentQuestionIndex;
            });

          socket.emit('leaderboard-update', leaderboard);
        }
      } catch (error) {
        console.error('Error in get-leaderboard:', error);
      }
    });
  });

  // Cleanup old rooms periodically (every hour)
  setInterval(
    async () => {
      try {
        const cleaned = await redisService.cleanupEmptyRooms();
        if (cleaned > 0) {
          console.log(`🗑️  Cleaned up ${cleaned} empty rooms`);
        }
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    },
    60 * 60 * 1000,
  );

  console.log('✅ Socket.IO initialized');
  return io;
}

// Export types for use in other files
export type { Player, ChatMessage, ScoreUpdate, AnswerSubmission };
