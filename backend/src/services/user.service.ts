import { User } from '../models/user.js';
import bcrypt from 'bcryptjs';

export interface UpdateProfileData {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}

export class UserService {
  static async updateProfile(userId: string, data: UpdateProfileData) {
    const { username, currentPassword, newPassword } = data;

    if (!username || typeof username !== 'string') {
      throw new Error('Username is required');
    }

    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      throw new Error('Username cannot be empty');
    }

    if (normalizedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    const userRecord = await User.findById(userId);

    if (!userRecord) {
      throw new Error('User not found');
    }

    if (normalizedUsername.toLowerCase() !== userRecord.username.toLowerCase()) {
      const existingUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: userRecord._id },
      });

      if (existingUser) {
        throw new Error('Username is already taken');
      }
    }

    userRecord.username = normalizedUsername;

    const wantsPasswordChange = Boolean(currentPassword || newPassword);

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword) {
        throw new Error('Current and new passwords are required to change password');
      }

      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      const passwordMatches = await bcrypt.compare(currentPassword, userRecord.password);

      if (!passwordMatches) {
        throw new Error('Current password is incorrect');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      userRecord.password = hashedPassword;
    }

    await userRecord.save();
    return userRecord;
  }

  static async getUserById(id: string) {
    const user = await User.findById(id).select('-password');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  static async getAllUsers() {
    return await User.find().select('-password');
  }
}
