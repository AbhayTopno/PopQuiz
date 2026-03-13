import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import * as redisService from '../../services/redisService.js';
import type { AnswerSubmission, ScoreUpdate } from '../../types/index.js';

export class GameProgressHandler {
  static register(io: Server, socket: AuthSocket) {
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

    socket.on('submit-answer', async (data: { roomId: string; answer: AnswerSubmission }) => {
      try {
        const { roomId, answer } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          const newAnswer = {
            questionIndex: answer.questionIndex,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            timestamp: Date.now(),
          };
          player.answers.push(newAnswer);

          let newScore = player.score;
          if (answer.isCorrect) newScore += 1;

          const newQuestionIndex = answer.questionIndex + 1;

          await redisService.updatePlayer(roomId, socket.id, {
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

    socket.on('quiz-completed', async (data: { roomId: string; finalScore: number }) => {
      try {
        const { roomId, finalScore } = data;
        const player = await redisService.getPlayer(roomId, socket.id);

        if (player) {
          await redisService.updatePlayer(roomId, socket.id, { score: finalScore });

          io.to(roomId).emit('player-completed', {
            playerId: socket.id,
            username: player.username,
            finalScore,
            completedAt: Date.now(),
          });

          const players = await redisService.getAllPlayers(roomId);
          const allCompleted = players.every((p) => p.currentQuestionIndex >= 0);

          if (allCompleted) {
            await redisService.updateRoomStatus(roomId, { gameFinished: true });

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

    // 1v1 Arena
    socket.on('score-update', async (data: { roomId: string; score: number; currentQuestion: number; finished: boolean }) => {
      try {
        const { roomId, score, currentQuestion, finished } = data;
        let player = await redisService.getPlayer(roomId, socket.id);

        if (!player) {
          player = {
            id: socket.id,
            username: 'Player',
            score: 0,
            currentQuestionIndex: 0,
            answers: [],
            isReady: false,
            joinedAt: Date.now(),
          };
          await redisService.addPlayer(roomId, player);
        }

        await redisService.updatePlayer(roomId, socket.id, {
          score,
          currentQuestionIndex: currentQuestion,
        });

        io.to(roomId).emit('score-update-broadcast', {
          id: socket.id,
          username: player.username,
          score,
          currentQuestion,
          finished,
        });
      } catch (error) {
        console.error('Error in score-update:', error);
      }
    });

    socket.on('player-finished', async (data: { roomId: string; username: string; score: number }) => {
      try {
        const { roomId, username, score } = data;

        await redisService.updatePlayer(roomId, socket.id, {
          score,
          isReady: true,
        });

        socket.to(roomId).emit('opponent-finished', { username, score });

        const players = await redisService.getAllPlayers(roomId);
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
    });

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
  }
}
