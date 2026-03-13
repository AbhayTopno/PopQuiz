import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import * as redisService from '../../services/redisService.js';
import type { Player, ChatMessage } from '../../types/index.js';

// Helper functions for co-op mode
const getCoopData = async (key: string): Promise<string | null> => {
  const { getRedisClient } = await import('../../config/redis.js');
  const redis = getRedisClient();
  return await redis.get(key);
};

const setCoopData = async (key: string, value: string, ttl = 7200): Promise<void> => {
  const { getRedisClient } = await import('../../config/redis.js');
  const redis = getRedisClient();
  await redis.set(key, value);
  await redis.expire(key, ttl);
};

export class GameModeHandler {
  static register(io: Server, socket: AuthSocket) {
    socket.on('quiz:start', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
        io.to(roomId).emit('quiz:start', { quizId, duration });
      } catch (error) {
        console.error('Error in quiz:start:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    socket.on('versus:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
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

    // ========== 2v2 AND CUSTOM MODE ========== //
    socket.on(
      'update-team-assignments',
      async (data: { roomId: string; teamAssignments: { teamA: string[]; teamB: string[] } }) => {
        try {
          const { roomId, teamAssignments } = data;
          const players = await redisService.getAllPlayers(roomId);
          const usernameAssignments = {
            teamA: teamAssignments.teamA
              .map((id) => players.find((p) => p.id === id)?.username)
              .filter((u): u is string => !!u),
            teamB: teamAssignments.teamB
              .map((id) => players.find((p) => p.id === id)?.username)
              .filter((u): u is string => !!u),
          };

          await redisService.setTeamAssignmentsByUsername(roomId, usernameAssignments);
          await redisService.setTeamAssignments(roomId, teamAssignments);
          io.to(roomId).emit('team-assignments', teamAssignments);
        } catch (error) {
          console.error('Error in update-team-assignments:', error);
        }
      },
    );

    const handleJoinTeamRoom = async (
      data: { roomId: string; quizId: string; username?: string; avatar?: string },
      mode: '2v2' | 'custom',
      maxCapacity: number,
    ) => {
      try {
        const { roomId, quizId } = data;
        const payloadUsername = (data.username ?? '').trim();
        const payloadAvatar = data.avatar;

        const effectiveUsername =
          (socket.user?.username || payloadUsername || 'Player').trim() || 'Player';
        const effectiveAvatar = socket.user?.profilePic ?? payloadAvatar;

        const roomExists = await redisService.roomExists(roomId);
        if (!roomExists) {
          await redisService.createRoom({
            roomId,
            quizId,
            createdAt: Date.now(),
            mode,
          });
        }

        const currentPlayerCount = await redisService.getPlayerCount(roomId);
        if (currentPlayerCount >= maxCapacity) {
          socket.emit('room:full', {
            message: `Room is full (max ${maxCapacity})`,
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

        await redisService.addPlayer(roomId, player);
        socket.join(roomId);

        let teamAssignments = await redisService.getTeamAssignments(roomId);
        const usernameAssignments = await redisService.getTeamAssignmentsByUsername(roomId);
        const players = await redisService.getAllPlayers(roomId);
        const totalPlayers = players.length;

        if (!teamAssignments) {
          teamAssignments = { teamA: [], teamB: [] };
        }

        if (
          usernameAssignments &&
          (usernameAssignments.teamA.length > 0 || usernameAssignments.teamB.length > 0)
        ) {
          teamAssignments = {
            teamA: players
              .filter((p) => usernameAssignments.teamA.includes(p.username))
              .map((p) => p.id),
            teamB: players
              .filter((p) => usernameAssignments.teamB.includes(p.username))
              .map((p) => p.id),
          };
          await redisService.setTeamAssignments(roomId, teamAssignments);
        }

        const currentIds = players.map((p) => p.id);
        const allStoredIds = [...teamAssignments.teamA, ...teamAssignments.teamB];
        if (allStoredIds.some((id) => !currentIds.includes(id))) {
          teamAssignments.teamA = teamAssignments.teamA.filter((id) => currentIds.includes(id));
          teamAssignments.teamB = teamAssignments.teamB.filter((id) => currentIds.includes(id));
          await redisService.setTeamAssignments(roomId, teamAssignments);
        }

        teamAssignments = (await redisService.getTeamAssignments(roomId)) || {
          teamA: [],
          teamB: [],
        };

        let myTeamId: 'teamA' | 'teamB';
        if (teamAssignments.teamA.includes(socket.id)) {
          myTeamId = 'teamA';
        } else if (teamAssignments.teamB.includes(socket.id)) {
          myTeamId = 'teamB';
        } else {
          const latestAssignments = (await redisService.getTeamAssignments(roomId)) || {
            teamA: [],
            teamB: [],
          };
          if (latestAssignments.teamA.includes(socket.id)) {
            myTeamId = 'teamA';
            teamAssignments = latestAssignments;
          } else if (latestAssignments.teamB.includes(socket.id)) {
            myTeamId = 'teamB';
            teamAssignments = latestAssignments;
          } else {
            if (latestAssignments.teamA.length <= latestAssignments.teamB.length) {
              myTeamId = 'teamA';
              latestAssignments.teamA.push(socket.id);
            } else {
              myTeamId = 'teamB';
              latestAssignments.teamB.push(socket.id);
            }
            await redisService.setTeamAssignments(roomId, latestAssignments);
            teamAssignments = latestAssignments;
          }
        }

        const teamAMembers = players.filter((p) => teamAssignments.teamA.includes(p.id));
        const teamBMembers = players.filter((p) => teamAssignments.teamB.includes(p.id));

        const teamAScore =
          mode === '2v2'
            ? await redisService.getTeamScore(roomId, 'teamA')
            : teamAMembers.reduce((sum, p) => sum + p.score, 0);
        const teamBScore =
          mode === '2v2'
            ? await redisService.getTeamScore(roomId, 'teamB')
            : teamBMembers.reduce((sum, p) => sum + p.score, 0);

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

        socket.emit('team-assignment', { teamId: myTeamId, teams });
        io.to(roomId).emit('teams-update', { teams, totalPlayers });

        const systemMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username: 'System',
          message: `${effectiveUsername} joined the ${mode} room`,
          timestamp: Date.now(),
        };
        await redisService.addChatMessage(roomId, systemMessage);
        io.to(roomId).emit('chat-message', systemMessage);
      } catch (error) {
        console.error(`Error in join-${mode}-room:`, error);
        socket.emit('error', { message: `Failed to join ${mode} room` });
      }
    };

    socket.on('join-2v2-room', async (data) => handleJoinTeamRoom(data, '2v2', 4));
    socket.on('join-custom-room', async (data) => handleJoinTeamRoom(data, 'custom', 10));

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
          const teamAssignments = await redisService.getTeamAssignments(roomId);
          if (!teamAssignments) return;

          const players = await redisService.getAllPlayers(roomId);
          const teamMemberIds = teamId === 'teamA' ? teamAssignments.teamA : teamAssignments.teamB;
          const teamMembers = players.filter((p) => teamMemberIds.includes(p.id));

          if (!teamMemberIds.includes(socket.id)) return;

          io.to(roomId).emit('team-answer-locked', {
            teamId,
            currentQuestion,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });

          const newTeamScore = await redisService.incrementTeamScore(roomId, teamId, points);

          for (const member of teamMembers) {
            await redisService.updatePlayer(roomId, member.id, {
              currentQuestionIndex: currentQuestion + 1,
            });
          }

          io.to(roomId).emit('team-score-update', {
            teamId,
            score: newTeamScore,
            currentQuestion: currentQuestion + 1,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });
        } catch (error) {
          console.error('Error in submit-team-answer:', error);
        }
      },
    );

    socket.on('team-quiz-finished', async (data: { roomId: string; teamId: 'teamA' | 'teamB' }) => {
      try {
        const { roomId, teamId } = data;
        const teamAssignments = await redisService.getTeamAssignments(roomId);
        if (!teamAssignments) return;

        await redisService.updatePlayer(roomId, socket.id, { isReady: true });
        const players = await redisService.getAllPlayers(roomId);
        const teamMemberIds = teamId === 'teamA' ? teamAssignments.teamA : teamAssignments.teamB;
        const teamMembers = players.filter((p) => teamMemberIds.includes(p.id));

        if (teamMembers.every((p) => p.isReady)) {
          const teamScore = await redisService.getTeamScore(roomId, teamId);
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

          const allPlayers = await redisService.getAllPlayers(roomId);
          const teamAMembers = allPlayers.filter((p) => teamAssignments.teamA.includes(p.id));
          const teamBMembers = allPlayers.filter((p) => teamAssignments.teamB.includes(p.id));

          if (
            teamAMembers.length > 0 &&
            teamAMembers.every((p) => p.isReady) &&
            teamBMembers.length > 0 &&
            teamBMembers.every((p) => p.isReady)
          ) {
            const teamAScore = await redisService.getTeamScore(roomId, 'teamA');
            const teamBScore = await redisService.getTeamScore(roomId, 'teamB');

            io.to(roomId).emit('2v2-battle-complete', {
              teams: [
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
              ],
            });
          }
        }
      } catch (error) {
        console.error('Error in team-quiz-finished:', error);
      }
    });

    socket.on('2v2:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
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
        console.error('Error in 2v2:init:', error);
      }
    });

    socket.on('custom:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
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
        console.error('Error in custom:init:', error);
      }
    });

    // ========== CO-OP MODE ========== //
    socket.on(
      'join-coop-room',
      async (data: { roomId: string; quizId: string; username?: string; avatar?: string }) => {
        try {
          const { roomId } = data;
          const effectiveUsername =
            (socket.user?.username || data.username || 'Player').trim() || 'Player';
          const effectiveAvatar = socket.user?.profilePic ?? data.avatar;

          const teamScoreKey = `coop:${roomId}:score`;
          let teamScore = await getCoopData(teamScoreKey);
          if (teamScore === null) {
            await setCoopData(teamScoreKey, '0');
            teamScore = '0';
          }

          const coopMembersKey = `coop:${roomId}:members`;
          const membersData = await getCoopData(coopMembersKey);
          const members = membersData ? JSON.parse(membersData) : [];

          if (!members.find((m: { id: string }) => m.id === socket.id)) {
            members.push({ id: socket.id, username: effectiveUsername, avatar: effectiveAvatar });
            await setCoopData(coopMembersKey, JSON.stringify(members));
          }

          socket.join(roomId);
          io.to(roomId).emit('coop-team-update', { members, score: parseInt(teamScore, 10) });
        } catch (error) {
          console.error('Error in join-coop-room:', error);
        }
      },
    );

    socket.on(
      'submit-coop-answer',
      async (data: {
        roomId: string;
        answer: string | null;
        isCorrect: boolean;
        points: number;
        currentQuestion: number;
      }) => {
        try {
          const { roomId, answer, isCorrect, points, currentQuestion } = data;
          const membersData = await getCoopData(`coop:${roomId}:members`);
          const members = membersData ? JSON.parse(membersData) : [];
          const answeringPlayer = members.find(
            (m: { id: string; username: string }) => m.id === socket.id,
          );

          io.to(roomId).emit('coop-answer-locked', {
            answeredBy: socket.id,
            playerName: answeringPlayer?.username || 'Someone',
            answer,
            isCorrect,
          });

          const teamScoreKey = `coop:${roomId}:score`;
          const currentScore = parseInt((await getCoopData(teamScoreKey)) || '0', 10);
          const newScore = currentScore + (isCorrect ? points : 0);
          await setCoopData(teamScoreKey, String(newScore));

          io.to(roomId).emit('coop-score-update', {
            score: newScore,
            currentQuestion,
            answeredBy: socket.id,
            answer,
            isCorrect,
          });
        } catch (error) {
          console.error('Error in submit-coop-answer:', error);
        }
      },
    );

    socket.on('coop-quiz-finished', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const finalScore = parseInt((await getCoopData(`coop:${roomId}:score`)) || '0', 10);
        const members = JSON.parse((await getCoopData(`coop:${roomId}:members`)) || '[]');
        io.to(roomId).emit('coop-quiz-complete', { finalScore, members });
      } catch (error) {
        console.error('Error in coop-quiz-finished:', error);
      }
    });

    socket.on('coop:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
        await setCoopData(`coop:${roomId}:score`, '0');

        let countdown = 3;
        const countdownInterval = setInterval(() => {
          if (countdown > 0) {
            io.to(roomId).emit('coop:countdown', countdown);
            countdown--;
          } else {
            clearInterval(countdownInterval);
            io.to(roomId).emit('quiz:start', { quizId, duration });
          }
        }, 1000);
      } catch (error) {
        console.error('Error in coop:init:', error);
      }
    });

    // ========== FFA MODE ========== //
    socket.on(
      'join-ffa-room',
      async (data: { roomId: string; quizId: string; username: string }) => {
        try {
          const { roomId, username } = data;
          const existingPlayer = await redisService.getPlayer(roomId, socket.id);
          if (!existingPlayer) {
            await redisService.addPlayer(roomId, {
              id: socket.id,
              username: username || 'Player',
              score: 0,
              currentQuestionIndex: 0,
              answers: [],
              isReady: false,
              joinedAt: Date.now(),
            });
          }

          socket.join(roomId);
          const players = await redisService.getAllPlayers(roomId);
          const playerList = players
            .map((p) => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              score: p.score || 0,
              finished: p.isReady || false,
            }))
            .sort((a, b) => b.score - a.score);

          io.to(roomId).emit('ffa-players-update', { players: playerList });
        } catch (error) {
          console.error('Error in join-ffa-room:', error);
        }
      },
    );

    socket.on('ffa:init', async (data: { roomId: string; quizId: string; duration: number }) => {
      try {
        const { roomId, quizId, duration } = data;
        await redisService.updateRoomStatus(roomId, { gameStarted: true });
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
      }
    });

    socket.on(
      'ffa-score-update',
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
          io.to(roomId).emit('ffa-score-update', {
            playerId: socket.id,
            username: player.username,
            score,
            currentQuestion,
            finished,
          });
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
          await redisService.updatePlayer(roomId, socket.id, { score, isReady: true });
          socket.to(roomId).emit('ffa-player-finished', { playerId: socket.id, username, score });

          const players = await redisService.getAllPlayers(roomId);
          if (players.every((p) => p.isReady) && players.length >= 2) {
            const sortedPlayers = players
              .map((p) => ({ id: p.id, username: p.username, score: p.score, finished: true }))
              .sort((a, b) => b.score - a.score);
            io.to(roomId).emit('ffa-battle-complete', { players: sortedPlayers });
          }
        } catch (error) {
          console.error('Error in ffa-player-finished:', error);
        }
      },
    );

    socket.on('ffa-get-players', async (data: { roomId: string }) => {
      try {
        if (await redisService.roomExists(data.roomId)) {
          const players = await redisService.getAllPlayers(data.roomId);
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
  } // end register
} // end GameModeHandler
