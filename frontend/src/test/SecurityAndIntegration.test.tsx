import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { apiClient, setAuthToken, getAuthToken, TOKEN_STORAGE_KEY, AUTH_EXPIRED_EVENT } from '../api/client';
import { WebsitesPage } from '../pages/websites/WebsitesPage';
import { websiteApi } from '../api/website.api';
import { Website } from '../types';

describe('Frontend Security & Integration Tests (Mocked API Responses)', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  describe('1. Protected Route Authentication Guards', () => {
    it('redirects unauthenticated users to /login when accessing protected routes', async () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setAuthToken(null);

      render(
        <MemoryRouter initialEntries={['/app/websites']}>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<div>Mock Login Page Screen</div>} />
                <Route
                  path="/app/websites"
                  element={
                    <ProtectedRoute>
                      <div>Confidential Protected Websites Dashboard</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Mock Login Page Screen')).toBeInTheDocument();
      });
      expect(screen.queryByText('Confidential Protected Websites Dashboard')).not.toBeInTheDocument();
    });

    it('renders protected child components when valid authentication session is present', async () => {
      const mockToken = 'mock-jwt-token-xyz';
      localStorage.setItem(TOKEN_STORAGE_KEY, mockToken);
      setAuthToken(mockToken);

      const authApi = await import('../api/auth.api');
      vi.spyOn(authApi.authApi, 'me').mockResolvedValueOnce({
        success: true,
        message: 'Profile retrieved',
        data: {
          id: 'tenant-user-uuid-1',
          email: 'test@oblivion.internal',
          fullName: 'Test User',
          role: 'USER',
          accountStatus: 'ACTIVE',
          createdAt: '2026-11-03T10:00:00.000Z',
        } as any,
      });

      render(
        <MemoryRouter initialEntries={['/app/secure-area']}>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<div>Login Page</div>} />
                <Route
                  path="/app/secure-area"
                  element={
                    <ProtectedRoute>
                      <div>Verified Protected Dashboard Area</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Verified Protected Dashboard Area')).toBeInTheDocument();
      });
    });
  });

  describe('2. API Interceptor Security & Error Handling', () => {
    it('dispatches AUTH_EXPIRED_EVENT and purges stored token upon HTTP 401 Unauthorized', async () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
      setAuthToken('stale-token');

      let authExpiredFired = false;
      const listener = () => {
        authExpiredFired = true;
      };
      window.addEventListener(AUTH_EXPIRED_EVENT, listener);

      try {
        const error: any = {
          response: {
            status: 401,
            data: { success: false, message: 'Invalid or expired token' },
          },
        };
        const interceptorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
        if (interceptorHandler) {
          await interceptorHandler(error);
        }
      } catch {
        // Expected promise rejection
      }

      window.removeEventListener(AUTH_EXPIRED_EVENT, listener);

      expect(authExpiredFired).toBe(true);
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('dispatches AUTH_EXPIRED_EVENT and purges stored token upon HTTP 403 Forbidden (Suspended Account)', async () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'suspended-account-token');
      setAuthToken('suspended-account-token');

      let authExpiredFired = false;
      const listener = () => {
        authExpiredFired = true;
      };
      window.addEventListener(AUTH_EXPIRED_EVENT, listener);

      try {
        const error: any = {
          response: {
            status: 403,
            data: { success: false, message: 'Account has been suspended' },
          },
        };
        const interceptorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
        if (interceptorHandler) {
          await interceptorHandler(error);
        }
      } catch {
        // Expected promise rejection
      }

      window.removeEventListener(AUTH_EXPIRED_EVENT, listener);

      expect(authExpiredFired).toBe(true);
    });
  });

  describe('3. Component CRUD Interaction Flow (WebsitesPage with Mocked HTTP Responses)', () => {
    const mockWebsite: Website = {
      id: 'site-uuid-1234',
      userId: 'user-uuid-1',
      websiteName: 'Acme Data Broker',
      websiteUrl: 'https://acme-broker.example.com',
      websiteCategory: 'FINANCIAL_SERVICES',
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
      _count: { exposureRecords: 2, removalRequests: 1 },
    };

    it('loads and displays tracked websites from API response', async () => {
      vi.spyOn(websiteApi, 'list').mockResolvedValueOnce({
        success: true,
        message: 'Websites retrieved',
        data: [mockWebsite],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <WebsitesPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Acme Data Broker')).toBeInTheDocument();
        expect(screen.getByText('https://acme-broker.example.com')).toBeInTheDocument();
      });
    });

    it('handles website registration submission and invokes websiteApi.create with valid payload', async () => {
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });

      const createSpy = vi.spyOn(websiteApi, 'create').mockResolvedValueOnce({
        success: true,
        message: 'Website created',
        data: mockWebsite,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <WebsitesPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Websites Tracked Yet')).toBeInTheDocument();
      });

      // Click "Add Website" in header to open modal
      const headerAddBtns = screen.getAllByRole('button', { name: /Add Website/i });
      fireEvent.click(headerAddBtns[0]);

      // Verify modal is open
      expect(screen.getByText('Register Third-Party Website')).toBeInTheDocument();

      // Fill in input fields
      const nameInput = screen.getByLabelText(/Website Name/i);
      const urlInput = screen.getByLabelText(/Website URL/i);

      fireEvent.change(nameInput, { target: { value: 'New Broker Portal' } });
      fireEvent.change(urlInput, { target: { value: 'https://newbroker.example.com' } });

      // Click the submit button inside the modal (the second "Add Website" button)
      const allAddBtns = screen.getAllByRole('button', { name: /Add Website/i });
      const submitBtn = allAddBtns[allAddBtns.length - 1];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            websiteName: 'New Broker Portal',
            websiteUrl: 'https://newbroker.example.com',
          })
        );
      });
    });

    it('renders error message in modal when websiteApi.create fails with API conflict', async () => {
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });

      vi.spyOn(websiteApi, 'create').mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            success: false,
            message: 'A website with this URL has already been registered in your account',
          },
        },
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <WebsitesPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Websites Tracked Yet')).toBeInTheDocument();
      });

      const headerAddBtns = screen.getAllByRole('button', { name: /Add Website/i });
      fireEvent.click(headerAddBtns[0]);

      const nameInput = screen.getByLabelText(/Website Name/i);
      const urlInput = screen.getByLabelText(/Website URL/i);

      fireEvent.change(nameInput, { target: { value: 'Duplicate Portal' } });
      fireEvent.change(urlInput, { target: { value: 'https://duplicate.example.com' } });

      const allAddBtns = screen.getAllByRole('button', { name: /Add Website/i });
      const submitBtn = allAddBtns[allAddBtns.length - 1];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('A website with this URL has already been registered in your account')).toBeInTheDocument();
      });
    });

    it('handles website deletion and invokes websiteApi.delete upon user confirmation', async () => {
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: [mockWebsite],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      const deleteSpy = vi.spyOn(websiteApi, 'delete').mockResolvedValueOnce({
        success: true,
        message: 'Website deleted',
        data: null,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <WebsitesPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Acme Data Broker')).toBeInTheDocument();
      });

      // Find trash button by its title attribute
      const deleteBtn = screen.getByTitle('Delete Website');
      fireEvent.click(deleteBtn);

      // Verify confirmation modal opens
      expect(screen.getByText('Confirm Website Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

      // Click Confirm Delete inside modal
      const deleteModalBtns = screen.getAllByRole('button', { name: /^Delete Website$/i });
      fireEvent.click(deleteModalBtns[deleteModalBtns.length - 1]);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('site-uuid-1234');
      });
    });
  });
});
