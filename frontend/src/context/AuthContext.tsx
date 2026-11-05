import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, AuthData } from '../types';
import { authApi } from '../api/auth.api';
import { getAuthToken, setAuthToken, AUTH_EXPIRED_EVENT } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { fullName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) {
        await authApi.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentTok = getAuthToken();
    if (!currentTok) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authApi.me();
      const userData = (res.data as any)?.user || res.data;
      if (res.success && userData?.id) {
        setUser(userData);
      } else {
        await logout();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Session expired';
      showToast(msg, 'error');
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout, showToast]);

  // Initial load
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Listen for 401/403 authorization expiration events from Axios interceptor
  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      showToast(customEvent.detail || 'Your session has expired. Please sign in again.', 'warning');
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [showToast]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(credentials);
      const token = res.data?.tokens?.accessToken || res.data?.token;
      if (res.success && token) {
        setAuthToken(token);
        setTokenState(token);
        setUser(res.data.user);
        showToast('Welcome back to OBLIVION', 'success');
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { fullName: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      if (res.success) {
        showToast('Registration successful! Please sign in to your new account.', 'success');
      } else {
        throw new Error(res.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
