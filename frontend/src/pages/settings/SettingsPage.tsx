import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Shield,
  KeyRound,
  LogOut,
  CheckCircle2,
  Bell,
  Clock,
  Flame,
  Check,
  Save,
  AlertCircle,
  RefreshCw,
  Lock,
  Send,
  FileCheck2,
  Inbox,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { userPreferenceApi, UpdateUserPreferenceDTO } from '../../api/user-preference.api';
import {
  UserNotificationPreference,
  OverdueFrequency,
  EmailDeliveryItem,
  EmailDeliveryStatus,
} from '../../types';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  // Notification Preferences State
  const [preferences, setPreferences] = useState<UserNotificationPreference | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState<boolean>(true);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);

  // Email Verification State
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [resendingVerification, setResendingVerification] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Delivery History State
  const [deliveries, setDeliveries] = useState<EmailDeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState<boolean>(true);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoadingPrefs(true);
      setPrefError(null);
      const res = await userPreferenceApi.getPreferences();
      setPreferences(res.data);
      if (res.data?.isEmailVerified !== undefined) {
        setIsVerified(res.data.isEmailVerified);
      } else if (user?.isEmailVerified !== undefined) {
        setIsVerified(user.isEmailVerified);
      }
    } catch (err: any) {
      setPrefError(err.response?.data?.message || 'Failed to load email preferences');
    } finally {
      setLoadingPrefs(false);
    }
  }, [user]);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoadingDeliveries(true);
      const res = await userPreferenceApi.getEmailDeliveries();
      setDeliveries(res.data || []);
    } catch {
      // Non-blocking for delivery history
    } finally {
      setLoadingDeliveries(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
    fetchDeliveries();
  }, [fetchPreferences, fetchDeliveries]);

  const handleToggle = (key: keyof UpdateUserPreferenceDTO) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key as keyof UserNotificationPreference],
    });
    setPrefSuccess(null);
  };

  const handleFrequencyChange = (freq: OverdueFrequency) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      overdueFrequency: freq,
    });
    setPrefSuccess(null);
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    try {
      setSavingPrefs(true);
      setPrefError(null);
      setPrefSuccess(null);
      const payload: UpdateUserPreferenceDTO = {
        emailNotificationsEnabled: preferences.emailNotificationsEnabled,
        notifyOnCreated: preferences.notifyOnCreated,
        notify7DaysBefore: preferences.notify7DaysBefore,
        notify3DaysBefore: preferences.notify3DaysBefore,
        notify1DayBefore: preferences.notify1DayBefore,
        notifyDueToday: preferences.notifyDueToday,
        notifyOverdue: preferences.notifyOverdue,
        overdueFrequency: preferences.overdueFrequency,
        notifyOnCompleted: preferences.notifyOnCompleted,
        notifyRemovalUpdates: preferences.notifyRemovalUpdates,
        notifyAccountSecurity: true, // Permanent security guarantee
      };

      const res = await userPreferenceApi.updatePreferences(payload);
      setPreferences(res.data);
      setPrefSuccess('Notification preferences saved successfully.');
    } catch (err: any) {
      setPrefError(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendingVerification(true);
      setVerificationMessage(null);
      await userPreferenceApi.resendVerification();
      setVerificationMessage({
        type: 'success',
        text: 'A verification link has been dispatched to your registered email address.',
      });
      fetchDeliveries();
    } catch (err: any) {
      setVerificationMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to send verification email.',
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) return;

    try {
      setVerifying(true);
      setVerificationMessage(null);
      await userPreferenceApi.verifyEmail(verificationToken.trim());
      setIsVerified(true);
      setVerificationToken('');
      setVerificationMessage({
        type: 'success',
        text: 'Email address successfully verified! Full privacy notifications unlocked.',
      });
      fetchPreferences();
      fetchDeliveries();
    } catch (err: any) {
      setVerificationMessage({
        type: 'error',
        text: err.response?.data?.message || 'Invalid or expired verification token.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = (status: EmailDeliveryStatus) => {
    switch (status) {
      case 'SENT':
      case 'DELIVERED':
        return <Badge variant="success" size="sm">{status}</Badge>;
      case 'PENDING':
      case 'SENDING':
        return <Badge variant="warning" size="sm">{status}</Badge>;
      case 'FAILED':
      case 'BOUNCED':
        return <Badge variant="danger" size="sm">{status}</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral" size="sm">{status}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const formatStageLabel = (stage: string) => {
    return stage
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
          Account & Security Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review your account profile, configure transactional email notifications via Resend, and inspect delivery telemetry.
        </p>
      </div>

      {/* Profile & Registered Email Identity Card */}
      <Card className="bg-navy-900 border-navy-750 p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-navy-800">
          <div className="w-14 h-14 rounded-2xl bg-electric-600/20 text-electric-400 border border-electric-500/30 flex items-center justify-center font-bold text-xl font-mono shadow-glow-purple">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">{user?.fullName}</h2>
            <div className="text-xs text-slate-400 font-mono mt-0.5">{user?.id}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Mail className="w-3.5 h-3.5 text-electric-400" />
                Registered Account Email
              </label>
              {isVerified ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                </span>
              )}
            </div>

            <div className="font-semibold text-slate-200 bg-navy-850 p-3 rounded-xl border border-navy-750 font-mono flex items-center justify-between">
              <span>{preferences?.registeredEmail || user?.email}</span>
              <span className="text-[10px] text-slate-400 bg-navy-800 px-2 py-0.5 rounded border border-navy-700">
                PostgreSQL Bound
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              All transactional and privacy notifications are strictly delivered to this verified account email. Recipient cannot be spoofed.
            </p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Account Status & Security
            </label>
            <div className="flex items-center justify-between bg-navy-850 p-2.5 rounded-xl border border-navy-750">
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">
                  {user?.accountStatus || 'ACTIVE'}
                </Badge>
                <span className="text-slate-400 text-[11px]">Protected & Encrypted</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Bcrypt 12 Rounds</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Multi-tenant cryptographic data separation active across all privacy vaults.
            </p>
          </div>
        </div>

        {/* Email Verification Box (Shown if unverified) */}
        {!isVerified && (
          <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-amber-300">
                  Email Address Awaiting Verification
                </div>
                <div className="text-amber-200/80 mt-0.5 leading-relaxed">
                  For your privacy and security, sensitive exposure records and detailed removal grounds are masked in email dispatches until you verify ownership of your registered email.
                </div>
              </div>
            </div>

            {verificationMessage && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  verificationMessage.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                }`}
              >
                {verificationMessage.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{verificationMessage.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <form onSubmit={handleVerifyEmail} className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Paste verification token..."
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  className="bg-navy-900 border border-navy-750 text-slate-200 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-400 font-mono w-full sm:w-64"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={verifying}
                  disabled={!verificationToken.trim()}
                >
                  Verify
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                isLoading={resendingVerification}
                leftIcon={<Send className="w-3 h-3" />}
              >
                Resend Link
              </Button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-navy-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Sign out of your active browser session.
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={logout}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Transactional Email Preferences (Resend) */}
      <Card className="bg-navy-900 border-navy-750 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Transactional Email Notifications
                <Badge variant="primary" size="sm">Resend Gateway</Badge>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Proactive email alerts delivered directly to <span className="text-electric-300 font-mono">{preferences?.registeredEmail || user?.email}</span>.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSavePreferences}
            isLoading={savingPrefs}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            disabled={loadingPrefs || !preferences}
          >
            Save Preferences
          </Button>
        </div>

        {prefSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{prefSuccess}</span>
          </div>
        )}

        {prefError && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{prefError}</span>
            <button
              onClick={fetchPreferences}
              className="ml-auto underline hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {loadingPrefs ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-28" />
          </div>
        ) : preferences ? (
          <div className="space-y-6">
            {/* Master Switch */}
            <div className="flex items-center justify-between p-4 bg-navy-850 rounded-xl border border-navy-750">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-200">
                  Enable Transactional Email Delivery
                </div>
                <div className="text-xs text-slate-400">
                  Master toggle permitting automated notifications to be dispatched via Resend.
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.emailNotificationsEnabled}
                  onChange={() => handleToggle('emailNotificationsEnabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-navy-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-electric-600"></div>
              </label>
            </div>

            {/* Removal Request & Lifecycle Updates */}
            <div
              className={`space-y-3 transition-opacity duration-200 ${
                preferences.emailNotificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
              }`}
            >
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 pb-1">
                Privacy Removal Requests & Life-Cycle Notifications
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Removal Updates */}
                <div
                  onClick={() => handleToggle('notifyRemovalUpdates')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notifyRemovalUpdates !== false
                      ? 'bg-navy-800 border-electric-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileCheck2 className="w-4 h-4 text-electric-400" />
                    <div>
                      <div className="font-semibold text-slate-100">Removal Lifecycle Updates</div>
                      <div className="text-[11px] text-slate-400">Alerts when requests are created, progressed, or rejected</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notifyRemovalUpdates !== false
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notifyRemovalUpdates !== false && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Erasure Completed */}
                <div
                  onClick={() => handleToggle('notifyOnCompleted')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notifyOnCompleted
                      ? 'bg-navy-800 border-emerald-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-100">Erasure Completed</div>
                      <div className="text-[11px] text-slate-400">Confirmation alerts when platforms confirm complete erasure</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notifyOnCompleted
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notifyOnCompleted && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Granular Stage Toggles */}
            <div
              className={`space-y-3 transition-opacity duration-200 ${
                preferences.emailNotificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
              }`}
            >
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 pb-1">
                Statutory Erasure Deadline Reminders
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. Scheduled */}
                <div
                  onClick={() => handleToggle('notifyOnCreated')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notifyOnCreated
                      ? 'bg-navy-800 border-electric-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-electric-400" />
                    <div>
                      <div className="font-semibold text-slate-100">Reminder Scheduled</div>
                      <div className="text-[11px] text-slate-400">Confirmation when new reminder is created</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notifyOnCreated
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notifyOnCreated && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* 2. 7 Days Prior */}
                <div
                  onClick={() => handleToggle('notify7DaysBefore')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notify7DaysBefore
                      ? 'bg-navy-800 border-electric-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-electric-400" />
                    <div>
                      <div className="font-semibold text-slate-100">7 Days Before Deadline</div>
                      <div className="text-[11px] text-slate-400">Early preparation heads-up notice</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notify7DaysBefore
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notify7DaysBefore && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* 3. 3 Days Prior */}
                <div
                  onClick={() => handleToggle('notify3DaysBefore')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notify3DaysBefore
                      ? 'bg-navy-800 border-electric-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-semibold text-slate-100">3 Days Before Deadline</div>
                      <div className="text-[11px] text-slate-400">Follow-up readiness reminder</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notify3DaysBefore
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notify3DaysBefore && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* 4. 1 Day Prior */}
                <div
                  onClick={() => handleToggle('notify1DayBefore')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notify1DayBefore
                      ? 'bg-navy-800 border-electric-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-semibold text-slate-100">1 Day Before Deadline</div>
                      <div className="text-[11px] text-slate-400">Urgent 24-hour final statutory notice</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notify1DayBefore
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notify1DayBefore && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* 5. Due Today */}
                <div
                  onClick={() => handleToggle('notifyDueToday')}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    preferences.notifyDueToday
                      ? 'bg-navy-800 border-rose-500/30 text-slate-200'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="font-semibold text-slate-100">Due Today</div>
                      <div className="text-[11px] text-slate-400">Statutory maturity deadline reached</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      preferences.notifyDueToday
                        ? 'bg-electric-600 border-electric-500 text-white'
                        : 'border-slate-600 bg-navy-850'
                    }`}
                  >
                    {preferences.notifyDueToday && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Essential Security Notifications (Locked) */}
                <div className="p-3 rounded-xl border bg-navy-850 border-navy-750 text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        Account Security Alerts
                        <Badge variant="warning" size="sm">Locked</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">Essential security events cannot be disabled</div>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-md bg-navy-750 border border-navy-700 flex items-center justify-center text-slate-400">
                    <Lock className="w-3 h-3 text-amber-400" />
                  </div>
                </div>
              </div>

              {/* Overdue Settings Card */}
              <div className="p-4 bg-navy-850 rounded-xl border border-navy-750 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Overdue Reminders Escalation</div>
                      <div className="text-xs text-slate-400">Receive recurring alerts when a statutory action item is past its due date.</div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notifyOverdue}
                      onChange={() => handleToggle('notifyOverdue')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-navy-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {preferences.notifyOverdue && (
                  <div className="pt-3 border-t border-navy-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Overdue Alert Cadence:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['DAILY', 'THREE_DAYS', 'WEEKLY', 'NONE'] as OverdueFrequency[]).map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => handleFrequencyChange(freq)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                            preferences.overdueFrequency === freq
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-navy-800 text-slate-400 hover:text-slate-200 hover:bg-navy-750'
                          }`}
                        >
                          {freq === 'DAILY'
                            ? 'Every 24h'
                            : freq === 'THREE_DAYS'
                            ? 'Every 3 Days'
                            : freq === 'WEEKLY'
                            ? 'Weekly'
                            : 'Muted'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Transactional Email Delivery History (Telemetry Card) */}
      <Card className="bg-navy-900 border-navy-750 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-navy-800">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4 text-electric-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Recent Email Delivery Telemetry
              </h3>
              <p className="text-[11px] text-slate-400">
                Persistent audit log of transactional email dispatches to your registered account.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeliveries}
            isLoading={loadingDeliveries}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>

        {loadingDeliveries ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            No transactional email dispatches recorded yet for this account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-2.5 font-medium">Event Type</th>
                  <th className="pb-2.5 font-medium">Subject</th>
                  <th className="pb-2.5 font-medium">Recipient</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {deliveries.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-navy-850/40 transition-colors">
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-navy-800 border border-navy-750 text-slate-300">
                        {formatStageLabel(item.notificationStage)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 max-w-[200px] truncate text-slate-200">
                      {item.subject}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-400">
                      {item.recipientEmail}
                    </td>
                    <td className="py-2.5 pr-3">
                      {getStatusBadge(item.deliveryStatus)}
                    </td>
                    <td className="py-2.5 text-right text-[11px] text-slate-400 font-mono">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Security Architecture & Safeguards */}
      <Card className="bg-navy-900 border-navy-750 p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-navy-800">
          <KeyRound className="w-4 h-4 text-electric-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            Security & Privacy Safeguards
          </h3>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Password Hashing: </span>
              Passwords are salted and securely hashed using bcrypt (12 rounds). Plaintext passwords are never
              persisted or logged.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Account Data Protection: </span>
              Your personal information, exposure records, and removal requests are strictly isolated to your authenticated account.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Cryptographic Identity Binding: </span>
              Transactional emails are bound to your verified PostgreSQL user account. Users cannot redirect notifications to third-party addresses.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Mandatory Account Security Alerts: </span>
              Critical account security notifications (such as password resets and deactivations) cannot be silenced under any configuration.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
