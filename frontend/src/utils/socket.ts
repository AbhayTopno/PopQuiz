import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '@/lib/config';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = getSocketUrl();
    socket = io(url, {
      autoConnect: false,
      withCredentials: true,
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
