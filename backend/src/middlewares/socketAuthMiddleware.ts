import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';
import type { Socket } from 'socket.io';

// Helper function to parse cookies
const parseCookies = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim();
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  return cookies;
};

// Extend Socket interface to include user data
export interface AuthSocket extends Socket {
  user?: {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    profilePic?: string;
  };
}

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from cookies or handshake auth
 * Attaches user to socket object
 */
export const socketAuthMiddleware = async (socket: AuthSocket, next: (_err?: Error) => void) => {
  try {
    let token: string | undefined;

    // Try to get token from cookies first (browser clients)
    if (socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies.jwt;
    }

    // Fallback to auth token from handshake (mobile/other clients)
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    // Fallback to query parameter (less secure, use as last resort)
    if (!token && socket.handshake.query?.token) {
      token = socket.handshake.query.token as string;
    }

    if (!token) {
      console.log('Socket authentication failed - No token provided');
      return next(new Error('Authentication error - No token provided'));
    }

    // Verify token
    const secret = process.env.JWT_SECRET || '';
    const decoded = jwt.verify(token, secret) as { userId: string };

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('Socket authentication failed - User not found');
      return next(new Error('Authentication error - User not found'));
    }

    // Attach user to socket
    socket.user = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      profilePic: user.profilePic,
    };

    console.log(`✅ Socket authenticated for user: ${user.username} (${socket.id})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Authentication error - Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Authentication error - Token expired'));
    }
    return next(new Error('Authentication error'));
  }
};

/**
 * Middleware to check if socket user is admin
 * Use this after socketAuthMiddleware
 */
export const socketAdminMiddleware = (socket: AuthSocket, next: (_err?: Error) => void) => {
  if (socket.user && socket.user.isAdmin) {
    next();
  } else {
    next(new Error('Not authorized - Admin only'));
  }
};

/**
 * Helper function to get user from socket in event handlers
 */
export const getSocketUser = (socket: AuthSocket) => {
  if (!socket.user) {
    throw new Error('Socket not authenticated');
  }
  return socket.user;
};
