import jwt from 'jsonwebtoken';
import { asyncHandler } from './asyncHandler.js';
import { User } from '../models/user.js';
import type { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    profilePic?: string;
  };
}

/**
 * Middleware to protect routes that require authentication
 * Verifies JWT token from cookies and attaches user to request
 */
export const protect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Read JWT from cookie
  const token: string | undefined = req.cookies.jwt;

  if (token) {
    try {
      const secret = process.env.JWT_SECRET || '';
      const decoded = jwt.verify(token, secret) as { userId: string };

      // Get user from database (exclude password)
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        res.status(401);
        throw new Error('Not authorized - User not found');
      }

      // Attach user to request object
      req.user = {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        profilePic: user.profilePic,
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401);
      throw new Error('Not authorized - Invalid token');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized - No token provided');
  }
});

/**
 * Middleware to check if user is an admin
 * Must be used after protect middleware
 */
export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized - Admin only');
  }
};

// Note: optionalAuth removed as it's not used and to simplify middleware surface
