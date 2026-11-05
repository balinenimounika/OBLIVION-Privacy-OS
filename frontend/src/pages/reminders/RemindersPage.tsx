import React, { useEffect, useState, useCallback } from 'react';
import {
  BellRing,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { reminderApi } from '../../api/reminder.api';
import { Reminder, ReminderType, ReminderStatus, CreateReminderDTO } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';

export interface DeadlineUrgency {
  urgencyState: 'COMPLETED' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'UPCOMING';
  badgeLabel: string;
  badgeVariant: 'success' | 'danger' | 'warning' | 'primary' | 'neutral';
  cardClass: string;
  iconBgClass: string;
  iconColor: string;
  daysRemaining: number;
}

export function getDeadlineUrgency(reminderDate: string, isCompleted: boolean): DeadlineUrgency {
  if (isCompleted) {
    return {
      urgencyState: 'COMPLETED',
      badgeLabel: 'Completed',
      badgeVariant: 'success',
      cardClass: 'bg-navy-900/60 border-navy-800 opacity-80',
      iconBgClass: 'bg-emerald-950/60 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      daysRemaining: 0,
    };
  }

  const dateStr = reminderDate.split('T')[0];
  const parts = dateStr.split('-').map(Number);
  const remMidnight = Date.UTC(parts[0], parts[1] - 1, parts[2]);

  const now = new Date();
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((remMidnight - nowMidnight) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      urgencyState: 'OVERDUE',
      badgeLabel: `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`,
      badgeVariant: 'danger',
      cardClass: 'bg-navy-900 border-rose-500/40 shadow-glow-rose',
      iconBgClass: 'bg-rose-950/80 border-rose-500/40',
      iconColor: 'text-rose-400',
      daysRemaining: diffDays,
    };
  }

  if (diffDays === 0) {
    return {
      urgencyState: 'DUE_TODAY',
      badgeLabel: 'Due today',
      badgeVariant: 'warning',
      cardClass: 'bg-navy-900 border-amber-500/40 shadow-glow-amber',
      iconBgClass: 'bg-amber-950/80 border-amber-500/40',
      iconColor: 'text-amber-400',
      daysRemaining: 0,
    };
  }

  if (diffDays === 1) {
    return {
      urgencyState: 'DUE_TOMORROW',
      badgeLabel: 'Due tomorrow',
      badgeVariant: 'warning',
      cardClass: 'bg-navy-900 border-amber-500/30',
      iconBgClass: 'bg-amber-950/50 border-amber-500/30',
      iconColor: 'text-amber-400',
      daysRemaining: 1,
    };
  }

  return {
    urgencyState: 'UPCOMING',
    badgeLabel: `${diffDays} days remaining`,
    badgeVariant: 'primary',
    cardClass: 'bg-navy-900 border-navy-750',
    iconBgClass: 'bg-navy-800 border-navy-750',
    iconColor: 'text-electric-400',
    daysRemaining: diffDays,
  };
}

const REMINDER_TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: 'FOLLOW_UP_REMOVAL', label: 'Follow Up on Removal Request' },
  { value: 'EXPIRY_CHECK', label: 'Exposure Expiration Check' },
  { value: 'ANNUAL_PRIVACY_REVIEW', label: 'Annual Privacy Review' },
  { value: 'CONSENT_REVALIDATION', label: 'Consent Revalidation' },
  { value: 'CUSTOM', label: 'Custom Reminder' },
];

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day).toLocaleDateString();
    }
  }
  return new Date(dateStr).toLocaleDateString();
};

export const RemindersPage: React.FC = () => {
  const { showToast } = useToast();
  const { refreshUnreadCount } = useNotifications();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<CreateReminderDTO>({
    title: '',
    reminderType: 'FOLLOW_UP_REMOVAL',
    reminderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reminderApi.list();
      setReminders(res.data || []);
    } catch (err: any) {
      console.error('Failed to load reminders:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title || !formData.reminderDate) {
      setFormError('Please enter a title and scheduled date.');
      return;
    }

    setSubmitting(true);
    try {
      // Normalize date to UTC noon to prevent timezone shifts
      const dateParts = formData.reminderDate.split('-');
      const isoDate = dateParts.length === 3
        ? `${formData.reminderDate}T12:00:00.000Z`
        : new Date(formData.reminderDate).toISOString();

      await reminderApi.create({
        title: formData.title.trim(),
        reminderType: formData.reminderType,
        reminderDate: isoDate,
        notes: formData.notes?.trim() || undefined,
      });
      showToast('Privacy reminder scheduled', 'success');
      setIsAddModalOpen(false);
      setFormData({
        title: '',
        reminderType: 'FOLLOW_UP_REMOVAL',
        reminderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
      });
      fetchReminders();
      refreshUnreadCount();
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
        const fieldDetails = errData.errors
          .map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`)
          .join(', ');
        setFormError(`Validation failed: ${fieldDetails}`);
      } else {
        setFormError(errData?.message || err.message || 'Failed to create reminder.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (reminder: Reminder) => {
    try {
      await reminderApi.update(reminder.id, { reminderStatus: 'COMPLETED' });
      showToast('Reminder marked as completed', 'success');
      fetchReminders();
      refreshUnreadCount();
    } catch (err: any) {
      showToast('Failed to update reminder', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await reminderApi.delete(id);
      showToast('Reminder deleted', 'success');
      fetchReminders();
      refreshUnreadCount();
    } catch {
      showToast('Failed to delete reminder', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Privacy Reminders & Deadlines
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track 30-day statutory response deadlines and scheduled annual privacy audits.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Schedule Reminder
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReminders} />
      ) : reminders.length === 0 ? (
        <EmptyState
          title="No Scheduled Reminders"
          description="Schedule a statutory 30-day follow-up reminder for your GDPR/CCPA removal requests."
          actionText="Schedule Reminder"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {reminders.map((rem) => {
            const isCompleted = rem.reminderStatus === 'COMPLETED';
            const urgency = getDeadlineUrgency(rem.reminderDate, isCompleted);
            return (
              <Card
                key={rem.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ${urgency.cardClass}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${urgency.iconBgClass} ${urgency.iconColor}`}>
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-semibold ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                        {rem.title || (rem as any).exposureRecord?.purpose || rem.reminderType.replace(/_/g, ' ')}
                      </h3>
                      {/* Urgency Badge */}
                      <Badge variant={urgency.badgeVariant} size="sm">
                        {urgency.badgeLabel}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {rem.reminderType.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Target: {formatDisplayDate(rem.reminderDate)}
                      </span>
                      {(rem.notes || (rem as any).exposureRecord?.notes) && (
                        <span>"{rem.notes || (rem as any).exposureRecord?.notes}"</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isCompleted && (
                    <Button
                      variant={urgency.urgencyState === 'OVERDUE' || urgency.urgencyState === 'DUE_TODAY' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleMarkComplete(rem)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Complete
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(rem.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Privacy Reminder"
        description="Set a statutory follow-up deadline or periodic review alert."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <Input
            label="Reminder Title *"
            placeholder="e.g. GDPR 30-Day Erasure Response Deadline"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />

          <Select
            label="Reminder Category *"
            options={REMINDER_TYPE_OPTIONS}
            value={formData.reminderType}
            onChange={(e) =>
              setFormData({ ...formData, reminderType: e.target.value as ReminderType })
            }
          />

          <Input
            label="Target Date *"
            type="date"
            value={formData.reminderDate}
            onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
            required
          />

          <Input
            label="Operational Notes (Optional)"
            placeholder="e.g. Escalate to supervisory authority if unacknowledged"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Schedule Reminder
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
