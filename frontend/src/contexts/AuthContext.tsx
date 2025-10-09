'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const logError = (message: string, error: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(message, error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      const userData: User = {
        id: data._id,
        email: data.email,
        username: data.username,
        isAdmin: data.isAdmin,
        avatar: data.avatar,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      logError('Login error:', error);
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }

      const data = await response.json();
      const userData: User = {
        id: data._id,
        email: data.email,
        username: data.username,
        isAdmin: data.isAdmin,
        avatar: data.avatar,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      logError('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logError('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Profile update failed');
      }

      const updatedUser = await response.json();
      const userData: User = {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        isAdmin: updatedUser.isAdmin,
        avatar: updatedUser.avatar,
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      logError('Profile update error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
