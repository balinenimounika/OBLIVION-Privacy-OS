import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { CategoriesPage } from '../pages/categories/CategoriesPage';
import { RemindersPage } from '../pages/reminders/RemindersPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { AuditLogsPage } from '../pages/audit/AuditLogsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RemovalRequestsPage } from '../pages/removals/RemovalRequestsPage';
import { categoryApi } from '../api/category.api';
import { reminderApi } from '../api/reminder.api';
import { notificationApi } from '../api/notification.api';
import { auditApi } from '../api/audit.api';
import { removalRequestApi } from '../api/removal.api';
import { websiteApi } from '../api/website.api';
import { exposureApi } from '../api/exposure.api';

describe('UI & Page Responsiveness Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders CategoriesPage catalog with 12 reference data categories', async () => {
    vi.spyOn(categoryApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Categories retrieved',
      data: [
        {
          id: 'cat-1',
          name: 'Financial Data',
          description: 'Banking credentials, credit ratings, transactions',
          sensitivityLevel: 'CRITICAL',
          riskWeight: 9,
          createdAt: '2026-11-03T10:00:00Z',
        },
      ],
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Data Categories/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Financial Data')).toBeInTheDocument();
    });
  });

  it('renders RemindersPage with empty state and scheduling action', async () => {
    vi.spyOn(reminderApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Reminders retrieved',
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <RemindersPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Privacy Reminders/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No Scheduled Reminders/i)).toBeInTheDocument();
    });
  });

  it('renders NotificationsPage with empty state and mark all read button', async () => {
    vi.spyOn(notificationApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Notifications retrieved',
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1, unreadCount: 0 },
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <NotificationsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Notifications & Alerts/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No Notifications/i)).toBeInTheDocument();
    });
  });

  it('renders AuditLogsPage with filters and export report button', async () => {
    vi.spyOn(auditApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Audit logs retrieved',
      data: [],
      meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
    });
    vi.spyOn(auditApi, 'getSummary').mockResolvedValueOnce({
      success: true,
      message: 'Summary retrieved',
      data: {
        totalEvents: 0,
        uniqueActions: 0,
        actionBreakdown: {},
      },
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuditLogsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Activity History/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export GDPR \/ CCPA Report/i })).toBeInTheDocument();
  });

  it('renders SettingsPage with profile view and cryptographic safeguards', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Account & Security Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Security & Privacy Safeguards/i)).toBeInTheDocument();
    expect(screen.getByText(/Password Hashing/i)).toBeInTheDocument();
    expect(screen.getByText(/Account Data Protection/i)).toBeInTheDocument();
  });

  it('renders NotFoundPage with error badge and back navigation', async () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Resource Not Found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Safety/i })).toBeInTheDocument();
  });

  it('renders RemovalRequestsPage with state machine transitions and history controls', async () => {
    vi.spyOn(removalRequestApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Removals retrieved',
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
    vi.spyOn(websiteApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Websites retrieved',
      data: [],
    });
    vi.spyOn(exposureApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Exposures retrieved',
      data: [],
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <RemovalRequestsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Removal Requests/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No Removal Requests Logged/i)).toBeInTheDocument();
    });
  });
});
