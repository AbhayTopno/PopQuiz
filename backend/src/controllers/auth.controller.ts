import { asyncHandler } from '../middlewares/asyncHandler.js';
import generateToken from '../utils/createToken.js';
import { AuthService } from '../services/auth.service.js';
import { UserService, UpdateProfileData } from '../services/user.service.js';
import type { Request, Response } from 'express';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    profilePic?: string;
  };
}

const signup = asyncHandler(async (req: Request, res: Response) => {
  try {
    const newUser = await AuthService.signup(req.body);
    generateToken(res, newUser._id.toString());
    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
    });
  } catch (error: any) {
    res.status(400);
    throw new Error(error.message);
  }
});

const login = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await AuthService.login(req.body);
    generateToken(res, user._id.toString());
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  } catch (error: any) {
    res.status(400);
    throw new Error(error.message);
  }
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  try {
    const data: UpdateProfileData = req.body || {};
    const updatedUser = await UserService.updateProfile(req.user._id, data);

    req.user = {
      _id: updatedUser._id.toString(),
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      profilePic: updatedUser.profilePic,
    };

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      profilePic: updatedUser.profilePic,
    });
  } catch (error: any) {
    // Determine status code based on error message patterns
    if (error.message === 'User not found') res.status(404);
    else res.status(400);
    throw new Error(error.message);
  }
});

const getUserById = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await UserService.getUserById(req.params.id);
    res.json(user);
  } catch (error: any) {
    res.status(404);
    throw new Error(error.message);
  }
});

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserService.getAllUsers();
  res.json(users);
});

const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user) {
    res.json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      isAdmin: req.user.isAdmin,
      profilePic: req.user.profilePic,
    });
  } else {
    res.status(401);
    throw new Error('Not authenticated');
  }
});

export { signup, login, logout, getUserById, getAllUsers, getCurrentUser, updateProfile };
