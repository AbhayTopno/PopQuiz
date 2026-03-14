import { User } from '../models/user.js';
import bcrypt from 'bcryptjs';

export class AuthService {
  /**
   * Hashes a plain text password and creates a new user.
   */
  static async signupUser(username: string, email: string, passwordPlain: string) {
    if (passwordPlain.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return newUser;
  }

  /**
   * Authenticates a user with email and password.
   */
  static async loginUser(email: string, passwordPlain: string) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    return user;
  }
}
