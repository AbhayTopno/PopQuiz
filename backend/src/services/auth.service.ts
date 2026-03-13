import { User } from '../models/user.js';
import bcrypt from 'bcryptjs';

export class AuthService {
  static async signup(data: any): Promise<any> {
    const { username, email, password } = data;

    if (!username || !email || !password) {
      throw new Error('All fields are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return newUser;
  }

  static async login(data: any): Promise<any> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error('All fields are required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    return user;
  }
}
