// Export the type so it can be imported by other files
export type ButtonProps = {
  id?: string;
  title: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  containerClass?: string;
  onClick?: () => void;
};

export interface AnimatedTitleProps {
  title: string;
  containerClass?: string;
}

export interface ImageClipBoxProps {
  src: string;
  clipClass: string;
}

export interface BentoTiltProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface BentoCardProps {
  src: string;
  title: React.ReactNode;
  description?: string;
  isComingSoon?: boolean;
  onOpen?: () => void;
  topic?: string;
}

export interface SocialLink {
  href: string;
  icon: React.ReactElement;
}

export interface Question {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizData {
  _id: string;
  topic: string;
  difficulty: string;
  numberOfQuestions: number;
  questions: Question[];
  hostedBy: string;
}

export type Props = {
  initialQuizData: QuizData;
  initialDuration?: number;
};

export interface User {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  currentUser: () => Promise<void>;
}

// ============================================
// Waiting Room & Multiplayer Types
// ============================================

// Socket.IO client type
export interface SocketClient {
  id?: string;
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  connect: () => void;
  disconnect: () => void;
  connected: boolean;
}

export interface WaitingRoomPlayer {
  id: string;
  name: string;
  teamId?: string; // 'teamA' or 'teamB'
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  system?: boolean;
}

export interface QuizSettings {
  topic: string;
  difficulty: string;
  questionCount: number;
  duration: number;
}

export interface TeamAssignments {
  teamA: string[]; // Array of player IDs
  teamB: string[]; // Array of player IDs
}

export interface WaitingRoomProps {
  roomId: string;
  quizId: string;
  username: string;
  avatar?: string;
  isHost: boolean;
  mode: string;
  initialSettings: {
    topic: string;
    difficulty: string;
    count: number;
    duration: number;
  };
}

// Server-emitted payload types
export interface ServerPlayer {
  id: string;
  username?: string;
  name?: string;
  avatar?: string;
}

export interface ServerChatMessage {
  id: string;
  username?: string;
  name?: string;
  message?: string;
  text?: string;
  timestamp?: number;
  ts?: number;
}

// Component prop types
export interface PlayersListProps {
  players: WaitingRoomPlayer[];
  mode: string;
}

export interface ChatBoxProps {
  messages: ChatMessage[];
  messageInput: string;
  setMessageInput: (value: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  connected: boolean;
}

export interface SettingsPanelProps {
  roomId: string;
  settings: QuizSettings;
  updateSettings: (partial: Partial<QuizSettings>) => void;
  isHost: boolean;
  copied: boolean;
  onCopyLink: () => void;
}

export interface TeamManagementProps {
  mode: string;
  players: WaitingRoomPlayer[];
  teamAssignments: TeamAssignments;
  isHost: boolean;
  socket: SocketClient; // Socket.IO client instance
  draggedPlayerId: string | null;
  dragOverTeam: 'teamA' | 'teamB' | null;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, playerId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (teamId: 'teamA' | 'teamB') => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetTeam: 'teamA' | 'teamB') => void;
  onKickPlayer: (playerId: string, playerName: string) => void;
  onAssignPlayer: (playerId: string, teamId: 'teamA' | 'teamB') => void;
}

export interface StartButtonProps {
  mode: string;
  players: WaitingRoomPlayer[];
  teamAssignments: TeamAssignments;
  isGenerating: boolean;
  countdown: number | null;
  topicValid: boolean;
  onStart: () => void;
}

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  mode: string;
  settings: QuizSettings;
  updateSettings: (updates: Partial<QuizSettings>) => void;
  isHost: boolean;
  copied: boolean;
  onCopyLink: () => void;
  players: WaitingRoomPlayer[];
  teamAssignments: TeamAssignments;
  socket: SocketClient; // Socket.IO client instance
  draggedPlayerId: string | null;
  dragOverTeam: 'teamA' | 'teamB' | null;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, playerId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (teamId: 'teamA' | 'teamB') => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetTeam: 'teamA' | 'teamB') => void;
  onKickPlayer: (playerId: string, playerName: string) => void;
  onAssignPlayer: (playerId: string, teamId: 'teamA' | 'teamB') => void;
}

export interface CountdownOverlayProps {
  countdown: number | null;
}

export interface KickConfirmModalProps {
  isOpen: boolean;
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface KickedMessageModalProps {
  isOpen: boolean;
}
