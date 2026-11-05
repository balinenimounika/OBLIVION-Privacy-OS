import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  Info,
  Calendar,
  ExternalLink,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { Notification, NotificationType } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useNotifications } from '../../context/NotificationContext';
import { notificationApi } from '../../api/notification.api';

export interface ParsedNotification {
  cleanMessage: string;
  reminderId?: string;
  reminderTitle?: string;
  stage?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export function parseNotification(rawMessage: string, title: string): ParsedNotification {
  let reminderId: string | undefined;
  let reminderTitle: string | undefined;
  let stage: string | undefined;
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';

  // 1. Extract metadata comment if present: <!-- STAGE:... | REMINDER:... | PRIORITY:... -->
  const metaMatch = rawMessage.match(
    /<!--\s*STAGE:([^\s|]+)\s*\|\s*REMINDER:([^\s|]+)(?:\s*\|\s*PRIORITY:([^\s|]+))?\s*-->/
  );
  if (metaMatch) {
    stage = metaMatch[1];
    reminderId = metaMatch[2];
    if (metaMatch[3]) {
      priority = metaMatch[3] as any;
    }
  }

  // 2. Extract [Related Reminder: ... | ID: ...]
  const titleMatch = rawMessage.match(/\[Related Reminder:\s*([^|]+)\s*\|\s*ID:\s*([^\]]+)\]/);
  if (titleMatch) {
    reminderTitle = titleMatch[1].trim();
    if (!reminderId) reminderId = titleMatch[2].trim();
  }

  // 3. Fallback priority inference from title if not in metadata
  if (!metaMatch) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('overdue') || lowerTitle.includes('due today')) {
      priority = 'URGENT';
    } else if (lowerTitle.includes('due tomorrow') || lowerTitle.includes('approaching') || lowerTitle.includes('urgent')) {
      priority = 'HIGH';
    } else if (lowerTitle.includes('upcoming') || lowerTitle.includes('7 days')) {
      priority = 'MEDIUM';
    } else {
      priority = 'LOW';
    }
  }

  // 4. Clean message
  const cleanMessage = rawMessage
    .replace(/<!--.*?-->/g, '')
    .replace(/\[Related Reminder:[^\]]+\]/g, '')
    .trim();

  return { cleanMessage, reminderId, reminderTitle, stage, priority };
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationApi.list({ limit: 50 });
      setNotifications(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'REMINDERS'>('ALL');

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'REMINDERS') {
      return (
        n.notificationType === 'REMINDER_DUE' ||
        n.title.toLowerCase().includes('reminder') ||
        n.message.includes('STAGE:')
      );
    }
    return true;
  });

  const getIcon = (type: NotificationType, priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', title: string) => {
    if (priority === 'URGENT' || title.toLowerCase().includes('overdue')) {
      return <Flame className="w-5 h-5 text-rose-400" />;
    }
    if (priority === 'HIGH' || title.toLowerCase().includes('tomorrow')) {
      return <Clock className="w-5 h-5 text-amber-400" />;
    }
    if (title.toLowerCase().includes('completed')) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    }
    switch (type) {
      case 'SECURITY_ALERT':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'REMINDER_DUE':
        return <Calendar className="w-5 h-5 text-electric-400" />;
      case 'REQUEST_STATUS_UPDATE':
        return <CheckCircle className="w-5 h-5 text-cyan-400" />;
      case 'SYSTEM_NOTICE':
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getPriorityBadgeVariant = (priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): 'danger' | 'warning' | 'primary' | 'neutral' => {
    switch (priority) {
      case 'URGENT':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'primary';
      case 'LOW':
      default:
        return 'neutral';
    }
  };

  const remindersCount = notifications.filter(
    (n) => n.notificationType === 'REMINDER_DUE' || n.title.toLowerCase().includes('reminder')
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
              Notifications & Alerts
            </h1>
            {unreadCount > 0 && (
              <Badge variant="primary" size="sm">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated statutory alerts, reminder deadline countdowns, and privacy status updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            leftIcon={<CheckCheck className="w-4 h-4" />}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-navy-800 pb-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'ALL'
              ? 'bg-electric-600/20 text-electric-300 border border-electric-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/40'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/40'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('REMINDERS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'REMINDERS'
              ? 'bg-electric-600/20 text-electric-300 border border-electric-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/40'
          }`}
        >
          Reminders ({remindersCount})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNotifications} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title={
            filter === 'UNREAD'
              ? 'No Unread Notifications'
              : filter === 'REMINDERS'
              ? 'No Reminder Alerts'
              : 'No Notifications'
          }
          description={
            filter === 'UNREAD'
              ? 'All caught up! New privacy alerts and deadline notices will appear here.'
              : 'Automated statutory reminder alerts and status updates will be logged here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const parsed = parseNotification(notif.message, notif.title);
            const isUrgent = parsed.priority === 'URGENT';
            const isHigh = parsed.priority === 'HIGH';

            return (
              <Card
                key={notif.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all duration-200 ${
                  notif.isRead
                    ? 'bg-navy-900 border-navy-800 opacity-80 hover:opacity-100'
                    : isUrgent
                    ? 'bg-navy-900 border-rose-500/40 shadow-glow-rose'
                    : isHigh
                    ? 'bg-navy-900 border-amber-500/30'
                    : 'bg-navy-850 border-electric-500/30 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 ${
                      isUrgent
                        ? 'bg-rose-950/80 border-rose-500/40'
                        : isHigh
                        ? 'bg-amber-950/60 border-amber-500/40'
                        : 'bg-navy-800 border-navy-750'
                    }`}
                  >
                    {getIcon(notif.notificationType, parsed.priority, notif.title)}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-semibold ${
                          notif.isRead ? 'text-slate-300' : 'text-slate-100 font-bold'
                        }`}
                      >
                        {notif.title}
                      </h3>

                      <Badge variant={getPriorityBadgeVariant(parsed.priority)} size="sm">
                        {parsed.priority}
                      </Badge>

                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-electric-400 animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {parsed.cleanMessage}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 flex-wrap">
                      <span>{new Date(notif.createdAt).toLocaleString()}</span>

                      {/* Related Reminder Pill & Navigation Link */}
                      {parsed.reminderTitle && (
                        <button
                          type="button"
                          onClick={() => navigate('/app/reminders')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-navy-800 hover:bg-electric-600/30 text-electric-300 hover:text-white border border-electric-500/20 text-[10px] transition-colors"
                          title="Navigate to Reminders page"
                        >
                          <Calendar className="w-3 h-3 text-electric-400" />
                          <span>Reminder: {parsed.reminderTitle}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* View Reminder button if not already clicked */}
                  {parsed.reminderTitle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/app/reminders')}
                      className="text-xs text-electric-400 hover:text-white"
                      rightIcon={<ExternalLink className="w-3 h-3" />}
                    >
                      View Reminder
                    </Button>
                  )}

                  {!notif.isRead && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(notif.id)}
                      leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
