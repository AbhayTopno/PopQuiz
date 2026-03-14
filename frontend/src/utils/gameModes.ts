import { useRouter } from 'next/navigation';

type GameModeConfig = {
  routePrefix: string;
  initEvent: string;
};

export const gameModes: Record<string, GameModeConfig> = {
  '1v1': {
    routePrefix: '/1v1arena',
    initEvent: 'versus:init',
  },
  '2v2': {
    routePrefix: '/2v2arena',
    initEvent: '2v2:init',
  },
  coop: {
    routePrefix: '/cooparena',
    initEvent: 'coop:init',
  },
  custom: {
    routePrefix: '/customarena',
    initEvent: 'custom:init',
  },
  ffa: {
    routePrefix: '/ffaarena',
    initEvent: 'ffa:init',
  },
  solo: {
    routePrefix: '/quiz',
    initEvent: 'quiz:start',
  },
};

export const getModeConfig = (modeStr: string): GameModeConfig => {
  return gameModes[modeStr] || gameModes['solo'];
};

export const handleQuizStartRouting = (
  mode: string,
  roomId: string,
  quizId: string,
  duration: number,
  username: string,
  router: ReturnType<typeof useRouter>,
) => {
  const config = getModeConfig(mode);
  if (mode === 'solo' || !mode) {
    router.push(`${config.routePrefix}/${quizId}?duration=${duration}`);
  } else {
    router.push(
      `${config.routePrefix}?roomId=${roomId}&quizId=${quizId}&duration=${duration}&username=${username}`,
    );
  }
};
