import { asyncHandler } from '../middlewares/asyncHandler.js';
import generateToken from '../utils/createToken.js';
import { AuthService } from '../services/auth.service.js';
import { UserService } from '../services/user.service.js';
import type { Request, Response } from 'express';

const signup = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newUser = await AuthService.signupUser(username, email, password);
    generateToken(res, newUser._id.toString());

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ message: errorMessage });
  }
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await AuthService.loginUser(email, password);
    generateToken(res, user._id.toString());

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ message: errorMessage });
  }
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

interface UpdateProfileBody {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}

const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  const { username, currentPassword, newPassword }: UpdateProfileBody = req.body || {};

  if (!username || typeof username !== 'string') {
    res.status(400);
    throw new Error('Username is required');
  }

  try {
    const userRecord = await UserService.updateProfile(
      req.user._id,
      username,
      currentPassword,
      newPassword,
    );

    req.user = {
      _id: userRecord._id.toString(),
      username: userRecord.username,
      email: userRecord.email,
      isAdmin: userRecord.isAdmin,
      profilePic: userRecord.profilePic,
    };

    res.json(req.user);
  } catch (error: unknown) {
    res.status(400);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
});

const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.getUserById(req.params.id);

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserService.getAllUsers();
  res.json(users);
});

interface AuthRequest extends Request {
  user?: {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    profilePic?: string;
  };
}

const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401);
    throw new Error('Not authenticated');
  }
});

export { signup, login, logout, getUserById, getAllUsers, getCurrentUser, updateProfile };
