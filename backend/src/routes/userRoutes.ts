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

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getCurrentUser);
router.get('/getUser/:id', getUserById);
router.get('/getAllUsers', getAllUsers);

export default router;
