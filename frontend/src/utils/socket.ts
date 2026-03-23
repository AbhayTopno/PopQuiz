import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '@/lib/config';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = getSocketUrl();
    socket = io(url, {
      autoConnect: false,
      withCredentials: true,
      auth: (cb) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        cb({ token });
      },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
