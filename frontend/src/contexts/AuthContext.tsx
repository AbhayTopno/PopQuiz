'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType, UpdateProfileInput } from '../types';
import { getApiUrl } from '@/lib/config';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const logError = (message: string, error: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(message, error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        avatar: data.profilePic ?? data.avatar,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', data.token);
    } catch (error) {
      logError('Login error:', error);
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: name, email, password }),
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
        avatar: data.profilePic ?? data.avatar,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', data.token);
    } catch (error) {
      logError('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${getApiUrl()}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      logError('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  };

  const updateProfile = async (data: UpdateProfileInput) => {
    try {
      const payload: UpdateProfileInput = {
        username: data.username.trim(),
      };

      if (data.currentPassword) {
        payload.currentPassword = data.currentPassword;
      }

      if (data.newPassword) {
        payload.newPassword = data.newPassword;
      }

      const response = await fetch(`${getApiUrl()}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Profile update failed');
      }

      const updatedUser = await response.json();
      const userData: User = {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        isAdmin: updatedUser.isAdmin,
        avatar: updatedUser.profilePic ?? updatedUser.avatar,
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      logError('Profile update error:', error);
      throw error;
    }
  };

  const currentUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const response = await fetch(`${getApiUrl()}/api/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const data = await response.json();
      const userData: User = {
        id: data._id,
        email: data.email,
        username: data.username,
        isAdmin: data.isAdmin,
        avatar: data.profilePic ?? data.avatar,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      logError('Current user fetch error:', error);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return;
    }
  }, []);

  // Initialize auth state on mount and refresh session from server
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    // Refresh session from server to honor cookie-auth
    currentUser().catch(() => {});
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, login, signup, logout, updateProfile, currentUser }}
    >
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
