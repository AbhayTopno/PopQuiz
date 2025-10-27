import express from 'express';
import {
  getAllUsers,
  getUserById,
  login,
  logout,
  signup,
  getCurrentUser,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authLimiter, apiLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Authentication routes with strict rate limiting
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Protected routes with general API rate limiting
router.get('/me', apiLimiter, protect, getCurrentUser);
router.get('/getUser/:id', apiLimiter, getUserById);
router.get('/getAllUsers', apiLimiter, getAllUsers);

export default router;
