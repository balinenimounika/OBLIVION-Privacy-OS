import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { userPreferenceApi } from '../api/user-preference.api';

// Mock userPreferenceApi
vi.mock('../api/user-preference.api', () => ({
  userPreferenceApi: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    getEmailDeliveries: vi.fn(),
    resendVerification: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

describe('SettingsPage - Global User Email & Notification System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registered email bound to PostgreSQL and verification badge', async () => {
    vi.mocked(userPreferenceApi.getPreferences).mockResolvedValueOnce({
      success: true,
      message: 'Notification preferences retrieved',
      data: {
        id: 'pref-123',
        userId: 'user-456',
        emailNotificationsEnabled: true,
        notifyOnCreated: true,
        notify7DaysBefore: true,
        notify3DaysBefore: true,
        notify1DayBefore: true,
        notifyDueToday: true,
        notifyOverdue: true,
        notifyCompleted: true,
        notifyOnCompleted: true,
        notifyRemovalUpdates: true,
        notifyAccountSecurity: true,
        welcomeEmailSent: true,
        registeredEmail: 'privacy_user@oblivion.internal',
        isEmailVerified: true,
        overdueFrequency: 'DAILY',
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    });

    vi.mocked(userPreferenceApi.getEmailDeliveries).mockResolvedValueOnce({
      success: true,
      message: 'Deliveries retrieved',
      data: [
        {
          id: 'del-1',
          notificationStage: 'WELCOME',
          recipientEmail: 'privacy_user@oblivion.internal',
          subject: 'Welcome to OBLIVION',
          deliveryStatus: 'SENT',
          attemptCount: 1,
          createdAt: '2026-11-05T01:00:00Z',
        },
        {
          id: 'del-2',
          notificationStage: 'REMOVAL_CREATED',
          recipientEmail: 'privacy_user@oblivion.internal',
          subject: 'Removal Request Initiated: DataBroker',
          deliveryStatus: 'DELIVERED',
          attemptCount: 1,
          createdAt: '2026-11-05T02:00:00Z',
        },
      ],
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Registered Account Email')).toBeInTheDocument();
      expect(screen.getAllByText('privacy_user@oblivion.internal').length).toBeGreaterThan(0);
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL Bound')).toBeInTheDocument();
    });

    // Check that Account Security Alerts is marked Locked
    expect(screen.getByText('Account Security Alerts')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText(/Essential security events cannot be disabled/i)).toBeInTheDocument();

    // Check delivery history table rendered
    await waitFor(() => {
      expect(screen.getByText('Recent Email Delivery Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Welcome to OBLIVION')).toBeInTheDocument();
      expect(screen.getByText('Removal Request Initiated: DataBroker')).toBeInTheDocument();
    });
  });

  it('renders unverified state warning and token verification input when email is unverified', async () => {
    vi.mocked(userPreferenceApi.getPreferences).mockResolvedValueOnce({
      success: true,
      message: 'Notification preferences retrieved',
      data: {
        id: 'pref-789',
        userId: 'user-789',
        emailNotificationsEnabled: true,
        notifyOnCreated: true,
        notify7DaysBefore: true,
        notify3DaysBefore: true,
        notify1DayBefore: true,
        notifyDueToday: true,
        notifyOverdue: true,
        notifyCompleted: true,
        notifyOnCompleted: true,
        notifyRemovalUpdates: true,
        notifyAccountSecurity: true,
        welcomeEmailSent: true,
        registeredEmail: 'unverified_user@oblivion.internal',
        isEmailVerified: false,
        overdueFrequency: 'DAILY',
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    });

    vi.mocked(userPreferenceApi.getEmailDeliveries).mockResolvedValueOnce({
      success: true,
      message: 'Deliveries retrieved',
      data: [],
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unverified')).toBeInTheDocument();
      expect(screen.getByText('Email Address Awaiting Verification')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Paste verification token...')).toBeInTheDocument();
      expect(screen.getByText('Resend Link')).toBeInTheDocument();
    });
  });
});
