import type { Server } from 'socket.io';
import type { AuthSocket } from '../../middlewares/socketAuthMiddleware.js';
import { Player, ChatMessage } from '../../types/index.js';
import { PlayerRedisService } from '../../services/redis/player.redis.service.js';
import { RoomRedisService } from '../../services/redis/room.redis.service.js';
import { TeamRedisService } from '../../services/redis/team.redis.service.js';
import { ChatRedisService } from '../../services/redis/chat.redis.service.js';
import { getRedisClient } from '../../config/redis.js';

const getCoopData = async (key: string): Promise<string | null> => {
  const redis = getRedisClient();
  return await redis.get(key);
};

const setCoopData = async (key: string, value: string, ttl = 7200): Promise<void> => {
  const redis = getRedisClient();
  await redis.set(key, value);
  await redis.expire(key, ttl);
};

export const registerTeamHandlers = (io: Server, socket: AuthSocket) => {
  socket.on(
    'update-team-assignments',
    async (data: { roomId: string; teamAssignments: { teamA: string[]; teamB: string[] } }) => {
      try {
        const { roomId, teamAssignments } = data;
        const players = await PlayerRedisService.getAllPlayers(roomId);
        const usernameAssignments = {
          teamA: teamAssignments.teamA
            .map((id) => players.find((p) => p.id === id)?.username)
            .filter((u): u is string => !!u),
          teamB: teamAssignments.teamB
            .map((id) => players.find((p) => p.id === id)?.username)
            .filter((u): u is string => !!u),
        };

        await TeamRedisService.setTeamAssignmentsByUsername(roomId, usernameAssignments);
        await TeamRedisService.setTeamAssignments(roomId, teamAssignments);

        io.to(roomId).emit('team-assignments', teamAssignments);
      } catch (error) {
        console.error('Error in update-team-assignments:', error);
      }
    },
  );

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

        const roomExists = await RoomRedisService.roomExists(roomId);
        if (!roomExists) {
          await RoomRedisService.createRoom({
            roomId,
            quizId,
            createdAt: Date.now(),
            mode: '2v2',
          });
        }

        const currentPlayerCount = await PlayerRedisService.getPlayerCount(roomId);
        if (currentPlayerCount >= 4) {
          socket.emit('room:full', {
            message: 'Room is full',
            maxCapacity: 4,
            currentCount: currentPlayerCount,
          });
          return;
        }

        const allPlayersPrev = await PlayerRedisService.getAllPlayers(roomId);
        const existingPlayer = allPlayersPrev.find((p) => p.username === effectiveUsername);

        let player: Player;
        if (existingPlayer) {
          await PlayerRedisService.removePlayer(roomId, existingPlayer.id);
          player = { ...existingPlayer, id: socket.id };
          await PlayerRedisService.addPlayer(roomId, player);
        } else {
          player = {
            id: socket.id,
            username: effectiveUsername,
            avatar: effectiveAvatar,
            score: 0,
            currentQuestionIndex: 0,
            answers: [],
            isReady: false,
            joinedAt: Date.now(),
          };
          await PlayerRedisService.addPlayer(roomId, player);
        }

        socket.join(roomId);

        let teamAssignments = await TeamRedisService.getTeamAssignments(roomId);
        const usernameAssignments = await TeamRedisService.getTeamAssignmentsByUsername(roomId);

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const totalPlayers = players.length;

        if (!teamAssignments) {
          teamAssignments = { teamA: [], teamB: [] };
        }

        if (
          usernameAssignments &&
          (usernameAssignments.teamA.length > 0 || usernameAssignments.teamB.length > 0)
        ) {
          const newTeamAssignments = {
            teamA: players
              .filter((p) => usernameAssignments.teamA.includes(p.username))
              .map((p) => p.id),
            teamB: players
              .filter((p) => usernameAssignments.teamB.includes(p.username))
              .map((p) => p.id),
          };

          teamAssignments = newTeamAssignments;
          await TeamRedisService.setTeamAssignments(roomId, teamAssignments);
        }

        const allStoredIds = [...teamAssignments.teamA, ...teamAssignments.teamB];
        const currentIds = players.map((p) => p.id);
        const hasStaleIds = allStoredIds.some((id) => !currentIds.includes(id));

        if (hasStaleIds) {
          teamAssignments.teamA = teamAssignments.teamA.filter((id) => currentIds.includes(id));
          teamAssignments.teamB = teamAssignments.teamB.filter((id) => currentIds.includes(id));
          await TeamRedisService.setTeamAssignments(roomId, teamAssignments);
        }

        teamAssignments = (await TeamRedisService.getTeamAssignments(roomId)) || {
          teamA: [],
          teamB: [],
        };

        let myTeamId: 'teamA' | 'teamB';

        if (teamAssignments.teamA.includes(socket.id)) {
          myTeamId = 'teamA';
        } else if (teamAssignments.teamB.includes(socket.id)) {
          myTeamId = 'teamB';
        } else {
          const latestAssignments = (await TeamRedisService.getTeamAssignments(roomId)) || {
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
              if (!latestAssignments.teamA.includes(socket.id)) {
                latestAssignments.teamA.push(socket.id);
              }
            } else {
              myTeamId = 'teamB';
              if (!latestAssignments.teamB.includes(socket.id)) {
                latestAssignments.teamB.push(socket.id);
              }
            }
            await TeamRedisService.setTeamAssignments(roomId, latestAssignments);
            teamAssignments = latestAssignments;
          }
        }

        const teamAMembers = players.filter((p) => teamAssignments!.teamA.includes(p.id));
        const teamBMembers = players.filter((p) => teamAssignments!.teamB.includes(p.id));

        const teamAScore = await TeamRedisService.getTeamScore(roomId, 'teamA');
        const teamBScore = await TeamRedisService.getTeamScore(roomId, 'teamB');

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
          message: `${effectiveUsername} joined the room`,
          timestamp: Date.now(),
        };
        await ChatRedisService.addChatMessage(roomId, systemMessage);
        io.to(roomId).emit('chat-message', systemMessage);
      } catch (error) {
        console.error('Error in join-2v2-room:', error);
        socket.emit('error', { message: 'Failed to join 2v2 room' });
      }
    },
  );

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

        const teamAssignments = await TeamRedisService.getTeamAssignments(roomId);
        if (!teamAssignments) return;

        const players = await PlayerRedisService.getAllPlayers(roomId);
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

        const newTeamScore = await TeamRedisService.incrementTeamScore(roomId, teamId, points);

        for (const member of teamMembers) {
          await PlayerRedisService.updatePlayer(roomId, member.id, {
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

      const teamAssignments = await TeamRedisService.getTeamAssignments(roomId);
      if (!teamAssignments) return;

      await PlayerRedisService.updatePlayer(roomId, socket.id, { isReady: true });

      const players = await PlayerRedisService.getAllPlayers(roomId);
      const teamMemberIds = teamId === 'teamA' ? teamAssignments.teamA : teamAssignments.teamB;
      const teamMembers = players.filter((p) => teamMemberIds.includes(p.id));
      const teamFinished = teamMembers.every((p) => p.isReady);

      if (teamFinished) {
        const teamScore = await TeamRedisService.getTeamScore(roomId, teamId);

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

        const allPlayers = await PlayerRedisService.getAllPlayers(roomId);
        const teamAMembers = allPlayers.filter((p) => teamAssignments.teamA.includes(p.id));
        const teamBMembers = allPlayers.filter((p) => teamAssignments.teamB.includes(p.id));

        const teamAFinished = teamAMembers.length > 0 && teamAMembers.every((p) => p.isReady);
        const teamBFinished = teamBMembers.length > 0 && teamBMembers.every((p) => p.isReady);

        if (teamAFinished && teamBFinished) {
          const teamAScore = await TeamRedisService.getTeamScore(roomId, 'teamA');
          const teamBScore = await TeamRedisService.getTeamScore(roomId, 'teamB');

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

          io.to(roomId).emit('2v2-battle-complete', { teams });
        }
      }
    } catch (error) {
      console.error('Error in team-quiz-finished:', error);
    }
  });

  socket.on('2v2:init', async (data: { roomId: string; quizId: string; duration: number }) => {
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
      console.error('Error in 2v2:init:', error);
      socket.emit('error', { message: 'Failed to start 2v2 battle' });
    }
  });

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

        const roomExists = await RoomRedisService.roomExists(roomId);
        if (!roomExists) {
          await RoomRedisService.createRoom({
            roomId,
            quizId,
            createdAt: Date.now(),
            mode: 'custom',
          });
        }

        const currentPlayerCount = await PlayerRedisService.getPlayerCount(roomId);
        if (currentPlayerCount >= 10) {
          socket.emit('room:full', {
            message: 'Room is full (max 10 players)',
            maxCapacity: 10,
            currentCount: currentPlayerCount,
          });
          return;
        }

        const allPlayersPrev = await PlayerRedisService.getAllPlayers(roomId);
        const existingPlayer = allPlayersPrev.find((p) => p.username === effectiveUsername);

        let player: Player;
        if (existingPlayer) {
          await PlayerRedisService.removePlayer(roomId, existingPlayer.id);
          player = { ...existingPlayer, id: socket.id };
          await PlayerRedisService.addPlayer(roomId, player);
        } else {
          player = {
            id: socket.id,
            username: effectiveUsername,
            avatar: effectiveAvatar,
            score: 0,
            currentQuestionIndex: 0,
            answers: [],
            isReady: false,
            joinedAt: Date.now(),
          };
          await PlayerRedisService.addPlayer(roomId, player);
        }

        socket.join(roomId);

        let teamAssignments = await TeamRedisService.getTeamAssignments(roomId);
        const usernameAssignments = await TeamRedisService.getTeamAssignmentsByUsername(roomId);

        const players = await PlayerRedisService.getAllPlayers(roomId);
        const totalPlayers = players.length;

        if (!teamAssignments) {
          teamAssignments = { teamA: [], teamB: [] };
        }

        if (
          usernameAssignments &&
          (usernameAssignments.teamA.length > 0 || usernameAssignments.teamB.length > 0)
        ) {
          const newTeamAssignments = {
            teamA: players
              .filter((p) => usernameAssignments.teamA.includes(p.username))
              .map((p) => p.id),
            teamB: players
              .filter((p) => usernameAssignments.teamB.includes(p.username))
              .map((p) => p.id),
          };

          teamAssignments = newTeamAssignments;
          await TeamRedisService.setTeamAssignments(roomId, teamAssignments);
        }

        const allStoredIds = [...teamAssignments.teamA, ...teamAssignments.teamB];
        const currentIds = players.map((p) => p.id);
        const hasStaleIds = allStoredIds.some((id) => !currentIds.includes(id));

        if (hasStaleIds) {
          teamAssignments.teamA = teamAssignments.teamA.filter((id) => currentIds.includes(id));
          teamAssignments.teamB = teamAssignments.teamB.filter((id) => currentIds.includes(id));
          await TeamRedisService.setTeamAssignments(roomId, teamAssignments);
        }

        teamAssignments = (await TeamRedisService.getTeamAssignments(roomId)) || {
          teamA: [],
          teamB: [],
        };

        let myTeamId: 'teamA' | 'teamB';

        if (teamAssignments.teamA.includes(socket.id)) {
          myTeamId = 'teamA';
        } else if (teamAssignments.teamB.includes(socket.id)) {
          myTeamId = 'teamB';
        } else {
          const latestAssignments = (await TeamRedisService.getTeamAssignments(roomId)) || {
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
              if (!latestAssignments.teamA.includes(socket.id)) {
                latestAssignments.teamA.push(socket.id);
              }
            } else {
              myTeamId = 'teamB';
              if (!latestAssignments.teamB.includes(socket.id)) {
                latestAssignments.teamB.push(socket.id);
              }
            }
            await TeamRedisService.setTeamAssignments(roomId, latestAssignments);
            teamAssignments = latestAssignments;
          }
        }

        const teamAMembers = players.filter((p) => teamAssignments!.teamA.includes(p.id));
        const teamBMembers = players.filter((p) => teamAssignments!.teamB.includes(p.id));

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

        socket.emit('team-assignment', { teamId: myTeamId, teams });
        io.to(roomId).emit('teams-update', { teams, totalPlayers });

        const systemMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username: 'System',
          message: `${effectiveUsername} joined the custom room`,
          timestamp: Date.now(),
        };
        await ChatRedisService.addChatMessage(roomId, systemMessage);
        io.to(roomId).emit('chat-message', systemMessage);
      } catch (error) {
        console.error('Error in join-custom-room:', error);
        socket.emit('error', { message: 'Failed to join custom room' });
      }
    },
  );

  socket.on('custom:init', async (data: { roomId: string; quizId: string; duration: number }) => {
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
      console.error('Error in custom:init:', error);
      socket.emit('error', { message: 'Failed to start custom battle' });
    }
  });

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

        const teamScoreKey = `coop:${roomId}:score`;
        let teamScore = await getCoopData(teamScoreKey);
        if (teamScore === null) {
          await setCoopData(teamScoreKey, '0');
          teamScore = '0';
        }

        const coopMembersKey = `coop:${roomId}:members`;
        const existingMembers = await getCoopData(coopMembersKey);
        const members = existingMembers ? JSON.parse(existingMembers) : [];

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

        io.to(roomId).emit('coop-team-update', {
          members,
          score: parseInt(teamScore, 10),
        });
      } catch (error) {
        console.error('Error in join-coop-room:', error);
        socket.emit('error', { message: 'Failed to join co-op room' });
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
      timeLeft: number;
    }) => {
      try {
        const { roomId, answer, isCorrect, points, currentQuestion } = data;

        const coopMembersKey = `coop:${roomId}:members`;
        const membersData = await getCoopData(coopMembersKey);
        const members = membersData ? JSON.parse(membersData) : [];
        const answeringPlayer = members.find(
          (m: { id: string; username: string; avatar?: string }) => m.id === socket.id,
        );
        const playerName = answeringPlayer?.username || 'Someone';

        io.to(roomId).emit('coop-answer-locked', {
          answeredBy: socket.id,
          playerName,
          answer,
          isCorrect,
        });

        const teamScoreKey = `coop:${roomId}:score`;
        const currentScoreStr = await getCoopData(teamScoreKey);
        const currentScore = currentScoreStr ? parseInt(currentScoreStr, 10) : 0;
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

      const teamScoreKey = `coop:${roomId}:score`;
      const coopMembersKey = `coop:${roomId}:members`;

      const scoreStr = await getCoopData(teamScoreKey);
      const membersData = await getCoopData(coopMembersKey);

      const finalScore = scoreStr ? parseInt(scoreStr, 10) : 0;
      const members = membersData ? JSON.parse(membersData) : [];

      io.to(roomId).emit('coop-quiz-complete', {
        finalScore,
        members,
      });
    } catch (error) {
      console.error('Error in coop-quiz-finished:', error);
    }
  });

  socket.on('coop:init', async (data: { roomId: string; quizId: string; duration: number }) => {
    try {
      const { roomId, quizId, duration } = data;
      await RoomRedisService.updateRoomStatus(roomId, { gameStarted: true });

      const teamScoreKey = `coop:${roomId}:score`;
      await setCoopData(teamScoreKey, '0');

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
      socket.emit('error', { message: 'Failed to start co-op quiz' });
    }
  });
};
