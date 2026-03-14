import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import { AnswerSubmission, ScoreUpdate } from '../../types/index.js';
import { PlayerRedisService } from '../../services/redis/player.redis.service.js';
import { RoomRedisService } from '../../services/redis/room.redis.service.js';

export const registerGameHandlers = (io: Server, socket: AuthSocket) => {
  socket.on('player-ready', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        await PlayerRedisService.updatePlayer(roomId, socket.id, { isReady: true });

        io.to(roomId).emit('player-ready-update', {
          playerId: socket.id,
          username: player.username,
          isReady: true,
        });

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const allReady = players.every((p) => p.isReady);
        const playerCount = await PlayerRedisService.getPlayerCount(roomId);

        if (allReady && playerCount >= 2) {
          await RoomRedisService.updateRoomStatus(roomId, { gameStarted: true });
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

  socket.on('submit-answer', async (data: { roomId: string; answer: AnswerSubmission }) => {
    try {
      const { roomId, answer } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        const newAnswer = {
          questionIndex: answer.questionIndex,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          timestamp: Date.now(),
        };
        player.answers.push(newAnswer);

        let newScore = player.score;
        if (answer.isCorrect) {
          newScore += 1;
        }

        const newQuestionIndex = answer.questionIndex + 1;

        await PlayerRedisService.updatePlayer(roomId, socket.id, {
          score: newScore,
          currentQuestionIndex: newQuestionIndex,
          answers: player.answers,
        });

        const scoreUpdate: ScoreUpdate = {
          playerId: socket.id,
          username: player.username,
          score: newScore,
          currentQuestionIndex: newQuestionIndex,
          totalQuestions: 0,
        };

        io.to(roomId).emit('score-update', scoreUpdate);

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

  socket.on('question-progress', async (data: { roomId: string; questionIndex: number }) => {
    try {
      const { roomId, questionIndex } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        await PlayerRedisService.updatePlayer(roomId, socket.id, {
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

  socket.on('quiz-completed', async (data: { roomId: string; finalScore: number }) => {
    try {
      const { roomId, finalScore } = data;
      const player = await PlayerRedisService.getPlayer(roomId, socket.id);

      if (player) {
        await PlayerRedisService.updatePlayer(roomId, socket.id, { score: finalScore });

        io.to(roomId).emit('player-completed', {
          playerId: socket.id,
          username: player.username,
          finalScore,
          completedAt: Date.now(),
        });

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const allCompleted = players.every((p) => p.currentQuestionIndex >= 0);

        if (allCompleted) {
          await RoomRedisService.updateRoomStatus(roomId, { gameFinished: true });

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

  socket.on('quiz:start', async (data: { roomId: string; quizId: string; duration: number }) => {
    try {
      const { roomId, quizId, duration } = data;
      await RoomRedisService.updateRoomStatus(roomId, { gameStarted: true });
      io.to(roomId).emit('quiz:start', { quizId, duration });
    } catch (error) {
      console.error('Error in quiz:start:', error);
      socket.emit('error', { message: 'Failed to start quiz' });
    }
  });

  socket.on('versus:init', async (data: { roomId: string; quizId: string; duration: number }) => {
    try {
      const { roomId, quizId, duration } = data;
      await RoomRedisService.updateRoomStatus(roomId, { gameStarted: true });

      let countdown = 3;
      const countdownInterval = setInterval(() => {
        if (countdown > 0) {
          io.to(roomId).emit('versus:countdown', countdown);
          countdown--;
        } else {
          clearInterval(countdownInterval);
          io.to(roomId).emit('quiz:start', { quizId, duration });
        }
      }, 1000);
    } catch (error) {
      console.error('Error in versus:init:', error);
      socket.emit('error', { message: 'Failed to start versus battle' });
    }
  });

  socket.on(
    'score-update',
    async (data: { roomId: string; score: number; currentQuestion: number; finished: boolean }) => {
      try {
        const { roomId, score, currentQuestion, finished } = data;
        let player = await PlayerRedisService.getPlayer(roomId, socket.id);

        if (!player) {
          const username = 'Player';
          player = {
            id: socket.id,
            username,
            score: 0,
            currentQuestionIndex: 0,
            answers: [],
            isReady: false,
            joinedAt: Date.now(),
          };
          await PlayerRedisService.addPlayer(roomId, player);
        }

        await PlayerRedisService.updatePlayer(roomId, socket.id, {
          score,
          currentQuestionIndex: currentQuestion,
        });

        const scoreUpdateData = {
          id: socket.id,
          username: player.username,
          score,
          currentQuestion,
          finished,
        };

        io.to(roomId).emit('score-update-broadcast', scoreUpdateData);
      } catch (error) {
        console.error('Error in score-update:', error);
      }
    },
  );

  socket.on(
    'player-finished',
    async (data: { roomId: string; username: string; score: number }) => {
      try {
        const { roomId, username, score } = data;

        await PlayerRedisService.updatePlayer(roomId, socket.id, {
          score,
          isReady: true,
        });

        socket.to(roomId).emit('opponent-finished', { username, score });

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const allFinished = players.every((p) => p.isReady);

        if (allFinished && players.length >= 2) {
          io.to(roomId).emit('battle-complete', {
            players: players.map((p) => ({
              id: p.id,
              username: p.username,
              score: p.score,
            })),
          });
        }
      } catch (error) {
        console.error('Error in player-finished:', error);
      }
    },
  );

  socket.on('get-leaderboard', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const roomExists = await RoomRedisService.roomExists(roomId);

      if (roomExists) {
        const players = await PlayerRedisService.getAllPlayers(roomId);

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

  socket.on('join-ffa-room', async (data: { roomId: string; quizId: string; username: string }) => {
    try {
      const { roomId, username } = data;

      const existingPlayer = await PlayerRedisService.getPlayer(roomId, socket.id);
      if (!existingPlayer) {
        const player = {
          id: socket.id,
          username: username || 'Player',
          score: 0,
          currentQuestionIndex: 0,
          answers: [],
          isReady: false,
          joinedAt: Date.now(),
        };
        await PlayerRedisService.addPlayer(roomId, player);
      }

      socket.join(roomId);

      const players = await PlayerRedisService.getAllPlayers(roomId);
      const playerList = players
        .map((p) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          score: p.score || 0,
          finished: p.isReady || false,
        }))
        .sort((a, b) => b.score - a.score);

      socket.emit('ffa-players-update', { players: playerList });
      io.to(roomId).emit('ffa-players-update', { players: playerList });
    } catch (error) {
      console.error('Error in join-ffa-room:', error);
      socket.emit('error', { message: 'Failed to join FFA room' });
    }
  });

  socket.on('ffa:init', async (data: { roomId: string; quizId: string; duration: number }) => {
    try {
      const { roomId, quizId, duration } = data;
      await RoomRedisService.updateRoomStatus(roomId, { gameStarted: true });

      let countdown = 3;
      const countdownInterval = setInterval(() => {
        if (countdown > 0) {
          io.to(roomId).emit('ffa:countdown', countdown);
          countdown--;
        } else {
          clearInterval(countdownInterval);
          io.to(roomId).emit('quiz:start', { quizId, duration });
        }
      }, 1000);
    } catch (error) {
      console.error('Error in ffa:init:', error);
      socket.emit('error', { message: 'Failed to start FFA battle' });
    }
  });

  socket.on(
    'ffa-score-update',
    async (data: { roomId: string; score: number; currentQuestion: number; finished: boolean }) => {
      try {
        const { roomId, score, currentQuestion, finished } = data;
        let player = await PlayerRedisService.getPlayer(roomId, socket.id);

        if (!player) {
          const username = 'Player';
          player = {
            id: socket.id,
            username,
            score: 0,
            currentQuestionIndex: 0,
            answers: [],
            isReady: false,
            joinedAt: Date.now(),
          };
          await PlayerRedisService.addPlayer(roomId, player);
        }

        await PlayerRedisService.updatePlayer(roomId, socket.id, {
          score,
          currentQuestionIndex: currentQuestion,
        });

        const scoreUpdateData = {
          playerId: socket.id,
          username: player.username,
          score,
          currentQuestion,
          finished,
        };

        io.to(roomId).emit('ffa-score-update', scoreUpdateData);
      } catch (error) {
        console.error('Error in ffa-score-update:', error);
      }
    },
  );

  socket.on(
    'ffa-player-finished',
    async (data: { roomId: string; username: string; score: number }) => {
      try {
        const { roomId, username, score } = data;

        await PlayerRedisService.updatePlayer(roomId, socket.id, {
          score,
          isReady: true,
        });

        socket.to(roomId).emit('ffa-player-finished', {
          playerId: socket.id,
          username,
          score,
        });

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const allFinished = players.every((p) => p.isReady);

        if (allFinished && players.length >= 2) {
          const sortedPlayers = players
            .map((p) => ({
              id: p.id,
              username: p.username,
              score: p.score,
              finished: true,
            }))
            .sort((a, b) => b.score - a.score);

          io.to(roomId).emit('ffa-battle-complete', {
            players: sortedPlayers,
          });
        }
      } catch (error) {
        console.error('Error in ffa-player-finished:', error);
      }
    },
  );

  socket.on('ffa-get-players', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const roomExists = await RoomRedisService.roomExists(roomId);

      if (roomExists) {
        const players = await PlayerRedisService.getAllPlayers(roomId);

        const playerList = players
          .map((p) => ({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            score: p.score,
            finished: p.isReady || false,
          }))
          .sort((a, b) => b.score - a.score);

        socket.emit('ffa-players-update', { players: playerList });
      }
    } catch (error) {
      console.error('Error in ffa-get-players:', error);
    }
  });
};
