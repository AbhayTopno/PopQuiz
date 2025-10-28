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
              mode: mode || '1v1',
            });
          }

          // Check room capacity based on mode
          const currentPlayerCount = await redisService.getPlayerCount(roomId);
          const room = await redisService.getRoom(roomId);
          const roomMode = room?.mode || mode || '1v1';
          const maxCapacity =
            roomMode === '2v2' ? 4 : roomMode === 'coop' || roomMode === 'custom' ? 10 : 2;

          if (currentPlayerCount >= maxCapacity) {
            socket.emit('room:full', {
              message: 'Room is full',
              maxCapacity,
              currentCount: currentPlayerCount,
            });
            return;
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

          // Send current room state to the newly joined player
          socket.emit('room-state', {
            players: playersList,
            messages,
            teamAssignments: teamAssignments || { teamA: [], teamB: [] },
            gameStarted: roomState?.gameStarted || false,
            gameFinished: roomState?.gameFinished || false,
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

    // Kick player (host only)
    socket.on('kick-player', async (data: { roomId: string; playerId: string }) => {
      try {
        const { roomId, playerId } = data;

        // Get the player to kick
        const player = await redisService.getPlayer(roomId, playerId);
        if (!player) {
          console.error('⚠️  Player not found for kick');
          return;
        }

        // Remove player from room
        await redisService.removePlayer(roomId, playerId);

        // Notify the kicked player
        io.to(playerId).emit('player-kicked', {
          message: `You have been removed from the room by the host`,
        });

        // Notify other players in the room
        const remainingPlayers = await redisService.getPlayerCount(roomId);
        io.to(roomId).emit('player-left', {
          playerId,
          username: player.username,
          remainingPlayers,
        });

        console.log(`🚫 Player ${player.username} (${playerId}) was kicked from room ${roomId}`);
      } catch (error) {
        console.error('Error in kick-player:', error);
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

    // ========== 2v2 ARENA HANDLERS ==========

    // Update team assignments (host only)
    socket.on(
      'update-team-assignments',
      async (data: { roomId: string; teamAssignments: { teamA: string[]; teamB: string[] } }) => {
        try {
          const { roomId, teamAssignments } = data;

          // Get all players to map IDs to usernames
          const players = await redisService.getAllPlayers(roomId);

          // Convert player IDs to usernames
          const usernameAssignments = {
            teamA: teamAssignments.teamA
              .map((id) => players.find((p) => p.id === id)?.username)
              .filter((u): u is string => !!u),
            teamB: teamAssignments.teamB
              .map((id) => players.find((p) => p.id === id)?.username)
              .filter((u): u is string => !!u),
          };

          // Store team assignments by username (persistent across socket reconnects)
          await redisService.setTeamAssignmentsByUsername(roomId, usernameAssignments);

          // Also store by current socket IDs for immediate use
          await redisService.setTeamAssignments(roomId, teamAssignments);

          // Broadcast updated team assignments to all players in the room
          io.to(roomId).emit('team-assignments', teamAssignments);

          console.log(`👥 Team assignments updated in room ${roomId}:`, teamAssignments);
          console.log(`👥 Username-based assignments:`, usernameAssignments);
        } catch (error) {
          console.error('Error in update-team-assignments:', error);
        }
      },
    );

    // Join 2v2 room and assign teams
    socket.on(
      'join-2v2-room',
      async (data: { roomId: string; quizId: string; username?: string; avatar?: string }) => {
        try {
          const { roomId, quizId } = data;
          const payloadUsername = (data.username ?? '').trim();
          const payloadAvatar = data.avatar;

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
              mode: '2v2',
            });
          }

          // Check room capacity for 2v2 mode (max 4 players)
          const currentPlayerCount = await redisService.getPlayerCount(roomId);
          if (currentPlayerCount >= 4) {
            socket.emit('room:full', {
              message: 'Room is full',
              maxCapacity: 4,
              currentCount: currentPlayerCount,
            });
            return;
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

          // Get stored team assignments or use default
          let teamAssignments = await redisService.getTeamAssignments(roomId);
          const usernameAssignments = await redisService.getTeamAssignmentsByUsername(roomId);

          // Get all players
          const players = await redisService.getAllPlayers(roomId);
          const totalPlayers = players.length;

          // Initialize team assignments if they don't exist
          if (!teamAssignments) {
            teamAssignments = { teamA: [], teamB: [] };
          }

          // If we have username-based assignments from waiting room, use them to rebuild socket ID assignments
          if (
            usernameAssignments &&
            (usernameAssignments.teamA.length > 0 || usernameAssignments.teamB.length > 0)
          ) {
            console.log(
              `📋 Found username-based team assignments for room ${roomId}:`,
              usernameAssignments,
            );

            // Map usernames to current socket IDs
            const newTeamAssignments = {
              teamA: players
                .filter((p) => usernameAssignments.teamA.includes(p.username))
                .map((p) => p.id),
              teamB: players
                .filter((p) => usernameAssignments.teamB.includes(p.username))
                .map((p) => p.id),
            };

            // Update team assignments with current socket IDs
            teamAssignments = newTeamAssignments;
            await redisService.setTeamAssignments(roomId, teamAssignments);
            console.log(`✅ Rebuilt team assignments from usernames:`, teamAssignments);
          }

          // Clean up stale socket IDs of disconnected players
          const allStoredIds = [...teamAssignments.teamA, ...teamAssignments.teamB];
          const currentIds = players.map((p) => p.id);
          const hasStaleIds = allStoredIds.some((id) => !currentIds.includes(id));

          if (hasStaleIds) {
            // Remove disconnected players' socket IDs but keep team structure
            teamAssignments.teamA = teamAssignments.teamA.filter((id) => currentIds.includes(id));
            teamAssignments.teamB = teamAssignments.teamB.filter((id) => currentIds.includes(id));

            await redisService.setTeamAssignments(roomId, teamAssignments);
            console.log(`🧹 Cleaned up stale socket IDs for room ${roomId}`, teamAssignments);
          }

          // Re-fetch team assignments to ensure we have the latest state (handles race conditions)
          teamAssignments = (await redisService.getTeamAssignments(roomId)) || {
            teamA: [],
            teamB: [],
          };

          // Check if current player is in team assignments, if not, assign them
          let myTeamId: 'teamA' | 'teamB';
          console.log(
            `🔍 Checking assignment for ${effectiveUsername} (${socket.id}). Current assignments:`,
            { teamA: teamAssignments.teamA, teamB: teamAssignments.teamB },
          );

          if (teamAssignments.teamA.includes(socket.id)) {
            myTeamId = 'teamA';
            console.log(`✅ ${effectiveUsername} already in teamA`);
          } else if (teamAssignments.teamB.includes(socket.id)) {
            myTeamId = 'teamB';
            console.log(`✅ ${effectiveUsername} already in teamB`);
          } else {
            // Player not in any team, assign to smaller team based on team assignment array lengths
            console.log(
              `🆕 ${effectiveUsername} not in any team. TeamA size: ${teamAssignments.teamA.length}, TeamB size: ${teamAssignments.teamB.length}`,
            );

            // Re-fetch one more time right before assignment to minimize race condition
            const latestAssignments = (await redisService.getTeamAssignments(roomId)) || {
              teamA: [],
              teamB: [],
            };

            // Check again if player was assigned by another concurrent request
            if (latestAssignments.teamA.includes(socket.id)) {
              myTeamId = 'teamA';
              teamAssignments = latestAssignments;
              console.log(`✅ ${effectiveUsername} was concurrently assigned to teamA`);
            } else if (latestAssignments.teamB.includes(socket.id)) {
              myTeamId = 'teamB';
              teamAssignments = latestAssignments;
              console.log(`✅ ${effectiveUsername} was concurrently assigned to teamB`);
            } else {
              // Still not assigned, proceed with assignment
              if (latestAssignments.teamA.length <= latestAssignments.teamB.length) {
                myTeamId = 'teamA';
                if (!latestAssignments.teamA.includes(socket.id)) {
                  latestAssignments.teamA.push(socket.id);
                  console.log(`➕ Added ${effectiveUsername} (${socket.id}) to teamA`);
                }
              } else {
                myTeamId = 'teamB';
                if (!latestAssignments.teamB.includes(socket.id)) {
                  latestAssignments.teamB.push(socket.id);
                  console.log(`➕ Added ${effectiveUsername} (${socket.id}) to teamB`);
                }
              }
              await redisService.setTeamAssignments(roomId, latestAssignments);
              teamAssignments = latestAssignments;
              console.log(
                `✅ Assigned ${effectiveUsername} (${socket.id}) to ${myTeamId}. New assignments:`,
                teamAssignments,
              );
            }
          }

          // Determine team members based on stored assignments (after potential assignment)
          const teamAMembers = players.filter((p) => teamAssignments.teamA.includes(p.id));
          const teamBMembers = players.filter((p) => teamAssignments.teamB.includes(p.id));

          // Get shared team scores (not sum of individual player scores)
          const teamAScore = await redisService.getTeamScore(roomId, 'teamA');
          const teamBScore = await redisService.getTeamScore(roomId, 'teamB');

          const teams = [
            {
              teamId: 'teamA',
              members: teamAMembers.map((p) => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
              })),
              score: teamAScore,
              currentQuestionIndex: Math.max(...teamAMembers.map((p) => p.currentQuestionIndex), 0),
              hasAnswered: false,
            },
            {
              teamId: 'teamB',
              members: teamBMembers.map((p) => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
              })),
              score: teamBScore,
              currentQuestionIndex: Math.max(...teamBMembers.map((p) => p.currentQuestionIndex), 0),
              hasAnswered: false,
            },
          ];

          // Send team assignment to the newly joined player
          socket.emit('team-assignment', { teamId: myTeamId, teams });

          // Notify all players about updated teams
          io.to(roomId).emit('teams-update', { teams, totalPlayers });

          // Send system message
          const systemMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            username: 'System',
            message: `${effectiveUsername} joined the room`,
            timestamp: Date.now(),
          };
          await redisService.addChatMessage(roomId, systemMessage);
          io.to(roomId).emit('chat-message', systemMessage);

          console.log(`👥 ${effectiveUsername} joined 2v2 room ${roomId} on ${myTeamId}`);
        } catch (error) {
          console.error('Error in join-2v2-room:', error);
          socket.emit('error', { message: 'Failed to join 2v2 room' });
        }
      },
    ); // Submit team answer (each player progresses independently, scores are shared)
    socket.on(
      'submit-team-answer',
      async (data: {
        roomId: string;
        teamId: 'teamA' | 'teamB';
        answer: string | null;
        isCorrect: boolean;
        points: number;
        currentQuestion: number;
        timeLeft: number;
      }) => {
        try {
          const { roomId, teamId, answer, isCorrect, points, currentQuestion } = data;

          // Get stored team assignments
          const teamAssignments = await redisService.getTeamAssignments(roomId);
          if (!teamAssignments) {
            console.error('⚠️  No team assignments found for room', roomId);
            return;
          }

          // Get all players in the room
          const players = await redisService.getAllPlayers(roomId);

          // Determine team members based on stored assignments
          const teamMemberIds = teamId === 'teamA' ? teamAssignments.teamA : teamAssignments.teamB;
          const teamMembers = players.filter((p) => teamMemberIds.includes(p.id));

          // Validate that the socket is actually in this team
          if (!teamMemberIds.includes(socket.id)) {
            console.error(
              `⚠️  Player ${socket.id} tried to submit for ${teamId} but is not in that team`,
            );
            console.log('Team assignments:', teamAssignments);
            console.log(
              'All players:',
              players.map((p) => ({ id: p.id, username: p.username })),
            );
            return;
          }

          // BOTH teams use coop mechanics - broadcast lock so ALL teammates advance together
          io.to(roomId).emit('team-answer-locked', {
            teamId,
            currentQuestion,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });

          // Cooperative team behavior - ONE shared score for the whole team
          // Only increment the team score once (not per member)
          const newTeamScore = await redisService.incrementTeamScore(roomId, teamId, points);

          // Advance question index for ALL team members (but don't touch individual scores)
          for (const member of teamMembers) {
            await redisService.updatePlayer(roomId, member.id, {
              currentQuestionIndex: currentQuestion + 1,
            });
          }

          // Broadcast team score update to ALL players (both teams see each other's scores)
          io.to(roomId).emit('team-score-update', {
            teamId,
            score: newTeamScore,
            currentQuestion: currentQuestion + 1,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });

          console.log(
            `📊 Player ${socket.id} from ${teamId} answered Q${currentQuestion}: ${isCorrect ? 'Correct' : 'Wrong'} (+${points} pts) - Team Total: ${newTeamScore}`,
          );
        } catch (error) {
          console.error('Error in submit-team-answer:', error);
        }
      },
    );

    // Team finished quiz (individual player finishes)
    socket.on('team-quiz-finished', async (data: { roomId: string; teamId: 'teamA' | 'teamB' }) => {
      try {
        const { roomId, teamId } = data;

        // Get stored team assignments
        const teamAssignments = await redisService.getTeamAssignments(roomId);
        if (!teamAssignments) {
          console.error('⚠️  No team assignments found for room', roomId);
          return;
        }

        // Mark only this player as finished
        await redisService.updatePlayer(roomId, socket.id, { isReady: true });

        // Check if all team members finished
        const players = await redisService.getAllPlayers(roomId);
        const teamMemberIds = teamId === 'teamA' ? teamAssignments.teamA : teamAssignments.teamB;
        const teamMembers = players.filter((p) => teamMemberIds.includes(p.id));
        const teamFinished = teamMembers.every((p) => p.isReady);

        if (teamFinished) {
          // Get team's shared score (not sum of individual scores)
          const teamScore = await redisService.getTeamScore(roomId, teamId);

          // Notify room that this team finished
          io.to(roomId).emit('team-finished', {
            teamId,
            score: teamScore,
            members: teamMembers.map((p) => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              score: p.score,
            })),
          });

          console.log(`🏁 ${teamId} finished with score: ${teamScore}`);

          // Check if both teams finished
          const allPlayers = await redisService.getAllPlayers(roomId);
          const teamAMembers = allPlayers.filter((p) => teamAssignments.teamA.includes(p.id));
          const teamBMembers = allPlayers.filter((p) => teamAssignments.teamB.includes(p.id));

          console.log(`🔍 Checking if both teams finished:`);
          console.log(
            `   Team A members: ${teamAMembers.length} (${teamAMembers.map((p) => p.username).join(', ')})`,
          );
          console.log(
            `   Team A ready: ${teamAMembers.map((p) => `${p.username}:${p.isReady}`).join(', ')}`,
          );
          console.log(
            `   Team B members: ${teamBMembers.length} (${teamBMembers.map((p) => p.username).join(', ')})`,
          );
          console.log(
            `   Team B ready: ${teamBMembers.map((p) => `${p.username}:${p.isReady}`).join(', ')}`,
          );
          console.log(
            `   All players in room: ${allPlayers.length} (${allPlayers.map((p) => p.username).join(', ')})`,
          );
          console.log(`   Team assignments:`, teamAssignments);

          const teamAFinished = teamAMembers.length > 0 && teamAMembers.every((p) => p.isReady);
          const teamBFinished = teamBMembers.length > 0 && teamBMembers.every((p) => p.isReady);

          console.log(`   Team A finished: ${teamAFinished}, Team B finished: ${teamBFinished}`);

          if (teamAFinished && teamBFinished) {
            // Get shared team scores (not sum of individual scores)
            const teamAScore = await redisService.getTeamScore(roomId, 'teamA');
            const teamBScore = await redisService.getTeamScore(roomId, 'teamB');

            const teams = [
              {
                teamId: 'teamA',
                members: teamAMembers.map((p) => ({
                  id: p.id,
                  username: p.username,
                  avatar: p.avatar,
                })),
                score: teamAScore,
                currentQuestionIndex: 0,
                hasAnswered: false,
              },
              {
                teamId: 'teamB',
                members: teamBMembers.map((p) => ({
                  id: p.id,
                  username: p.username,
                  avatar: p.avatar,
                })),
                score: teamBScore,
                currentQuestionIndex: 0,
                hasAnswered: false,
              },
            ];

            // Broadcast battle complete
            io.to(roomId).emit('2v2-battle-complete', { teams });
            console.log(`⚔️  2v2 Battle completed in room ${roomId}`);
          }
        }
      } catch (error) {
        console.error('Error in team-quiz-finished:', error);
      }
    });

    // Initialize 2v2 versus mode
    socket.on('2v2:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });

        // Start countdown for 2v2 mode
        let countdown = 3;
        const countdownInterval = setInterval(() => {
          if (countdown > 0) {
            io.to(roomId).emit('versus:countdown', countdown);
            countdown--;
          } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('quiz:start', { quizId, duration });
            console.log(`⚔️  2v2 battle started in room ${roomId}: ${quizId}`);
          }
        }, 1000);
      } catch (error) {
        console.error('Error in 2v2:init:', error);
        socket.emit('error', { message: 'Failed to start 2v2 battle' });
      }
    });

    // ===== CUSTOM MODE HANDLERS (Reuses 2v2 logic with flexible team sizes) =====

    // Join custom room (uses same logic as 2v2 but allows any team composition)
    socket.on(
      'join-custom-room',
      async (data: { roomId: string; quizId: string; username?: string; avatar?: string }) => {
        try {
          const { roomId, quizId } = data;
          const payloadUsername = (data.username ?? '').trim();
          const payloadAvatar = data.avatar;

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
              mode: 'custom',
            });
          }

          // Check room capacity for custom mode (max 10 players)
          const currentPlayerCount = await redisService.getPlayerCount(roomId);
          if (currentPlayerCount >= 10) {
            socket.emit('room:full', {
              message: 'Room is full (max 10 players)',
              maxCapacity: 10,
              currentCount: currentPlayerCount,
            });
            return;
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

          // Get stored team assignments or use default
          let teamAssignments = await redisService.getTeamAssignments(roomId);
          const usernameAssignments = await redisService.getTeamAssignmentsByUsername(roomId);

          // Get all players
          const players = await redisService.getAllPlayers(roomId);
          const totalPlayers = players.length;

          // Initialize team assignments if they don't exist
          if (!teamAssignments) {
            teamAssignments = { teamA: [], teamB: [] };
          }

          // If we have username-based assignments from waiting room, use them
          if (
            usernameAssignments &&
            (usernameAssignments.teamA.length > 0 || usernameAssignments.teamB.length > 0)
          ) {
            console.log(
              `📋 Found username-based team assignments for custom room ${roomId}:`,
              usernameAssignments,
            );

            // Map usernames to current socket IDs
            const newTeamAssignments = {
              teamA: players
                .filter((p) => usernameAssignments.teamA.includes(p.username))
                .map((p) => p.id),
              teamB: players
                .filter((p) => usernameAssignments.teamB.includes(p.username))
                .map((p) => p.id),
            };

            teamAssignments = newTeamAssignments;
            await redisService.setTeamAssignments(roomId, teamAssignments);
            console.log(`✅ Rebuilt custom team assignments from usernames:`, teamAssignments);
          }

          // Clean up stale socket IDs
          const allStoredIds = [...teamAssignments.teamA, ...teamAssignments.teamB];
          const currentIds = players.map((p) => p.id);
          const hasStaleIds = allStoredIds.some((id) => !currentIds.includes(id));

          if (hasStaleIds) {
            teamAssignments.teamA = teamAssignments.teamA.filter((id) => currentIds.includes(id));
            teamAssignments.teamB = teamAssignments.teamB.filter((id) => currentIds.includes(id));
            await redisService.setTeamAssignments(roomId, teamAssignments);
            console.log(
              `🧹 Cleaned up stale socket IDs for custom room ${roomId}`,
              teamAssignments,
            );
          }

          // Re-fetch team assignments
          teamAssignments = (await redisService.getTeamAssignments(roomId)) || {
            teamA: [],
            teamB: [],
          };

          // Check if current player is in team assignments
          let myTeamId: 'teamA' | 'teamB';
          console.log(
            `🔍 Checking assignment for ${effectiveUsername} (${socket.id}) in custom room. Current assignments:`,
            { teamA: teamAssignments.teamA, teamB: teamAssignments.teamB },
          );

          if (teamAssignments.teamA.includes(socket.id)) {
            myTeamId = 'teamA';
            console.log(`✅ ${effectiveUsername} already in teamA`);
          } else if (teamAssignments.teamB.includes(socket.id)) {
            myTeamId = 'teamB';
            console.log(`✅ ${effectiveUsername} already in teamB`);
          } else {
            // Player not in any team, assign to smaller team (default balancing)
            console.log(
              `🆕 ${effectiveUsername} not in any team. TeamA size: ${teamAssignments.teamA.length}, TeamB size: ${teamAssignments.teamB.length}`,
            );

            const latestAssignments = (await redisService.getTeamAssignments(roomId)) || {
              teamA: [],
              teamB: [],
            };

            if (latestAssignments.teamA.includes(socket.id)) {
              myTeamId = 'teamA';
              teamAssignments = latestAssignments;
              console.log(`✅ ${effectiveUsername} was concurrently assigned to teamA`);
            } else if (latestAssignments.teamB.includes(socket.id)) {
              myTeamId = 'teamB';
              teamAssignments = latestAssignments;
              console.log(`✅ ${effectiveUsername} was concurrently assigned to teamB`);
            } else {
              // Assign to smaller team
              if (latestAssignments.teamA.length <= latestAssignments.teamB.length) {
                myTeamId = 'teamA';
                if (!latestAssignments.teamA.includes(socket.id)) {
                  latestAssignments.teamA.push(socket.id);
                  console.log(`➕ Added ${effectiveUsername} (${socket.id}) to teamA`);
                }
              } else {
                myTeamId = 'teamB';
                if (!latestAssignments.teamB.includes(socket.id)) {
                  latestAssignments.teamB.push(socket.id);
                  console.log(`➕ Added ${effectiveUsername} (${socket.id}) to teamB`);
                }
              }
              await redisService.setTeamAssignments(roomId, latestAssignments);
              teamAssignments = latestAssignments;
              console.log(
                `✅ Assigned ${effectiveUsername} (${socket.id}) to ${myTeamId}. New assignments:`,
                teamAssignments,
              );
            }
          }

          // Determine team members
          const teamAMembers = players.filter((p) => teamAssignments.teamA.includes(p.id));
          const teamBMembers = players.filter((p) => teamAssignments.teamB.includes(p.id));

          // Calculate team scores
          const teamAScore = teamAMembers.reduce((sum, p) => sum + p.score, 0);
          const teamBScore = teamBMembers.reduce((sum, p) => sum + p.score, 0);

          const teams = [
            {
              teamId: 'teamA',
              members: teamAMembers.map((p) => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
              })),
              score: teamAScore,
              currentQuestionIndex: Math.max(...teamAMembers.map((p) => p.currentQuestionIndex), 0),
              hasAnswered: false,
            },
            {
              teamId: 'teamB',
              members: teamBMembers.map((p) => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
              })),
              score: teamBScore,
              currentQuestionIndex: Math.max(...teamBMembers.map((p) => p.currentQuestionIndex), 0),
              hasAnswered: false,
            },
          ];

          // Send team assignment to the newly joined player
          socket.emit('team-assignment', { teamId: myTeamId, teams });

          // Notify all players about updated teams
          io.to(roomId).emit('teams-update', { teams, totalPlayers });

          // Send system message
          const systemMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            username: 'System',
            message: `${effectiveUsername} joined the custom room`,
            timestamp: Date.now(),
          };
          await redisService.addChatMessage(roomId, systemMessage);
          io.to(roomId).emit('chat-message', systemMessage);

          console.log(`⚙️  ${effectiveUsername} joined custom room ${roomId} on ${myTeamId}`);
        } catch (error) {
          console.error('Error in join-custom-room:', error);
          socket.emit('error', { message: 'Failed to join custom room' });
        }
      },
    );

    // Initialize custom mode
    socket.on('custom:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });

        // Start countdown for custom mode
        let countdown = 3;
        const countdownInterval = setInterval(() => {
          if (countdown > 0) {
            io.to(roomId).emit('versus:countdown', countdown);
            countdown--;
          } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('quiz:start', { quizId, duration });
            console.log(`⚙️  Custom battle started in room ${roomId}: ${quizId}`);
          }
        }, 1000);
      } catch (error) {
        console.error('Error in custom:init:', error);
        socket.emit('error', { message: 'Failed to start custom battle' });
      }
    });

    // ===== CO-OP MODE HANDLERS =====

    // Helper to get/set co-op data (using redis client directly like team assignments)
    const getCoopData = async (key: string): Promise<string | null> => {
      const redis = await import('../config/redis.js').then((m) => m.getRedisClient());
      return await redis.get(key);
    };

    const setCoopData = async (key: string, value: string, ttl = 7200): Promise<void> => {
      const redis = await import('../config/redis.js').then((m) => m.getRedisClient());
      await redis.set(key, value);
      await redis.expire(key, ttl);
    };

    // Join co-op room
    socket.on(
      'join-coop-room',
      async (data: { roomId: string; quizId: string; username?: string; avatar?: string }) => {
        try {
          const { roomId } = data;
          const payloadUsername = (data.username ?? '').trim();
          const payloadAvatar = data.avatar;

          const effectiveUsername =
            (socket.user?.username || payloadUsername || 'Player').trim() || 'Player';
          const effectiveAvatar = socket.user?.profilePic ?? payloadAvatar;

          // Get or create co-op team score
          const teamScoreKey = `coop:${roomId}:score`;
          let teamScore = await getCoopData(teamScoreKey);
          if (teamScore === null) {
            await setCoopData(teamScoreKey, '0');
            teamScore = '0';
          }

          // Add player to co-op team
          const coopMembersKey = `coop:${roomId}:members`;
          const existingMembers = await getCoopData(coopMembersKey);
          const members = existingMembers ? JSON.parse(existingMembers) : [];

          // Check if player already in team
          const existingMemberIndex = members.findIndex(
            (m: { id: string; username: string; avatar?: string }) => m.id === socket.id,
          );
          if (existingMemberIndex === -1) {
            members.push({
              id: socket.id,
              username: effectiveUsername,
              avatar: effectiveAvatar,
            });
            await setCoopData(coopMembersKey, JSON.stringify(members));
          }

          socket.join(roomId);

          // Send team update to all members
          io.to(roomId).emit('coop-team-update', {
            members,
            score: parseInt(teamScore, 10),
          });

          console.log(`🤝 ${effectiveUsername} joined co-op room ${roomId}`);
        } catch (error) {
          console.error('Error in join-coop-room:', error);
          socket.emit('error', { message: 'Failed to join co-op room' });
        }
      },
    );

    // Submit co-op answer
    socket.on(
      'submit-coop-answer',
      async (data: {
        roomId: string;
        answer: string | null;
        isCorrect: boolean;
        points: number;
        currentQuestion: number;
        timeLeft: number;
      }) => {
        try {
          const { roomId, answer, isCorrect, points, currentQuestion } = data;

          // Get player info
          const coopMembersKey = `coop:${roomId}:members`;
          const membersData = await getCoopData(coopMembersKey);
          const members = membersData ? JSON.parse(membersData) : [];
          const answeringPlayer = members.find(
            (m: { id: string; username: string; avatar?: string }) => m.id === socket.id,
          );
          const playerName = answeringPlayer?.username || 'Someone';

          // Lock all players immediately and send answer info
          io.to(roomId).emit('coop-answer-locked', {
            answeredBy: socket.id,
            playerName,
            answer,
            isCorrect,
          });

          // Update team score
          const teamScoreKey = `coop:${roomId}:score`;
          const currentScoreStr = await getCoopData(teamScoreKey);
          const currentScore = currentScoreStr ? parseInt(currentScoreStr, 10) : 0;
          const newScore = currentScore + (isCorrect ? points : 0);
          await setCoopData(teamScoreKey, String(newScore));

          // Broadcast score update
          io.to(roomId).emit('coop-score-update', {
            score: newScore,
            currentQuestion,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });

          console.log(
            `🤝 Co-op answer in room ${roomId} by ${playerName}: ${isCorrect ? 'correct' : 'incorrect'}, +${points} points`,
          );
        } catch (error) {
          console.error('Error in submit-coop-answer:', error);
        }
      },
    );

    // Co-op quiz finished
    socket.on('coop-quiz-finished', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        // Get final score and members
        const teamScoreKey = `coop:${roomId}:score`;
        const coopMembersKey = `coop:${roomId}:members`;

        const scoreStr = await getCoopData(teamScoreKey);
        const membersData = await getCoopData(coopMembersKey);

        const finalScore = scoreStr ? parseInt(scoreStr, 10) : 0;
        const members = membersData ? JSON.parse(membersData) : [];

        // Broadcast completion
        io.to(roomId).emit('coop-quiz-complete', {
          finalScore,
          members,
        });

        console.log(`🤝 Co-op quiz completed in room ${roomId}. Final Score: ${finalScore}`);
      } catch (error) {
        console.error('Error in coop-quiz-finished:', error);
      }
    });

    // Initialize co-op mode
    socket.on('coop:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });

        // Initialize co-op team score
        const teamScoreKey = `coop:${roomId}:score`;
        await setCoopData(teamScoreKey, '0');

        // Start countdown
        let countdown = 3;
        const countdownInterval = setInterval(() => {
          if (countdown > 0) {
            io.to(roomId).emit('coop:countdown', countdown);
            countdown--;
          } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('quiz:start', { quizId, duration });
            console.log(`🤝 Co-op quiz started in room ${roomId}: ${quizId}`);
          }
        }, 1000);
      } catch (error) {
        console.error('Error in coop:init:', error);
        socket.emit('error', { message: 'Failed to start co-op quiz' });
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
