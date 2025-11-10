import { asyncHandler } from '../middlewares/asyncHandler.js';
import { User } from '../models/user.js';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/createToken.js';
import type { Request, Response } from 'express';

const signup = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: 'All fields are required' });

  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Invalid email format' });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ message: 'Email already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  generateToken(res, newUser._id.toString());

  res.status(201).json({
    _id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    isAdmin: newUser.isAdmin,
  });
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'All fields are required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  generateToken(res, user._id.toString());

  res.status(200).json({
    _id: user._id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
  });
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

  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    res.status(400);
    throw new Error('Username cannot be empty');
  }

  if (normalizedUsername.length < 3) {
    res.status(400);
    throw new Error('Username must be at least 3 characters long');
  }

  const userRecord = await User.findById(req.user._id);

  if (!userRecord) {
    res.status(404);
    throw new Error('User not found');
  }

  if (normalizedUsername.toLowerCase() !== userRecord.username.toLowerCase()) {
    const existingUser = await User.findOne({
      username: normalizedUsername,
      _id: { $ne: userRecord._id },
    });

    if (existingUser) {
      res.status(400);
      throw new Error('Username is already taken');
    }
  }

  userRecord.username = normalizedUsername;

  const wantsPasswordChange = Boolean(currentPassword || newPassword);

  if (wantsPasswordChange) {
    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error('Current and new passwords are required to change password');
    }

    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('New password must be at least 8 characters long');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, userRecord.password);

    if (!passwordMatches) {
      res.status(400);
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    userRecord.password = hashedPassword;
  }

  await userRecord.save();

  req.user = {
    _id: userRecord._id.toString(),
    username: userRecord.username,
    email: userRecord.email,
    isAdmin: userRecord.isAdmin,
    profilePic: userRecord.profilePic,
  };

  res.json({
    _id: userRecord._id,
    username: userRecord.username,
    email: userRecord.email,
    isAdmin: userRecord.isAdmin,
    profilePic: userRecord.profilePic,
  });
});

const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('-password');

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select('-password');
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
  // req.user is attached by the protect middleware
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
