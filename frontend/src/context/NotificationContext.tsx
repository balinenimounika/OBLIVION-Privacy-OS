import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationApi } from '../api/notification.api';
import { Notification } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface NotificationContextType {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await notificationApi.list({ limit: 50 });
      const list = res.data || [];
      setNotifications(list);
      const count = res.meta?.unreadCount !== undefined
        ? res.meta.unreadCount
        : list.filter((n) => !n.isRead).length;
      setUnreadCount(count);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationApi.list({ limit: 1 });
      if (res.meta?.unreadCount !== undefined) {
        setUnreadCount(res.meta.unreadCount);
      }
    } catch {
      // Ignore background count refresh failure
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      showToast('Failed to mark notification as read', 'error');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      showToast('All notifications marked as read', 'success');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      showToast('Failed to mark all as read', 'error');
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

const defaultNotificationContext: NotificationContextType = {
  unreadCount: 0,
  notifications: [],
  loading: false,
  error: null,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  refreshUnreadCount: async () => {},
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  return context || defaultNotificationContext;
};
