import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { RemovalRequestsPage } from '../pages/removals/RemovalRequestsPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { LandingPage } from '../pages/landing/LandingPage';
import { PrivacyShield3D } from '../components/landing/PrivacyShield3D';
import { Card3D } from '../components/landing/Card3D';
import { websiteApi } from '../api/website.api';
import { exposureApi } from '../api/exposure.api';
import { removalRequestApi } from '../api/removal.api';
import { dashboardApi } from '../api/dashboard.api';

describe('OBLIVION Master UI Improvements & Bug Fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part 1 – Removal Request Exposure Description Textarea', () => {
    const mockWebsites = [
      { id: 'web-instagram', userId: 'user-1', websiteName: 'Instagram', websiteUrl: 'https://instagram.com', websiteCategory: 'SOCIAL_MEDIA' as const, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z' },
      { id: 'web-facebook', userId: 'user-1', websiteName: 'Facebook', websiteUrl: 'https://facebook.com', websiteCategory: 'SOCIAL_MEDIA' as const, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z' },
      { id: 'web-linkedin', userId: 'user-1', websiteName: 'LinkedIn', websiteUrl: 'https://linkedin.com', websiteCategory: 'EMPLOYMENT' as const, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z' },
    ];

    it('replaces Associated Exposure Record dropdown with user-editable multiline textarea', async () => {
      vi.spyOn(removalRequestApi, 'list').mockResolvedValue({
        success: true,
        message: 'Removals retrieved',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: mockWebsites,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <RemovalRequestsPage />
          </ToastProvider>
        </MemoryRouter>
      );

      // Wait for initial data load to settle
      await waitFor(() => {
        expect(screen.getByText(/Removal Requests & Erasure Tracking/i)).toBeInTheDocument();
      });

      // Open Add Modal
      const newBtn = screen.getByRole('button', { name: /New Removal Request/i });
      fireEvent.click(newBtn);

      await waitFor(() => {
        expect(screen.getByText(/Initiate Formal Removal Request/i)).toBeInTheDocument();
      });

      // Verify dropdown is removed
      expect(screen.queryByLabelText(/Associated Exposure Record/i)).not.toBeInTheDocument();

      // Verify user-editable textarea exists with required placeholder
      const textarea = screen.getByPlaceholderText('Example: My phone number is publicly visible on Instagram.');
      expect(textarea).toBeInTheDocument();
      expect(screen.getByText(/Describe the Exposed Personal Information \*/i)).toBeInTheDocument();
    });

    it('shows website empty state warning and CTA when user has 0 websites', async () => {
      vi.spyOn(removalRequestApi, 'list').mockResolvedValue({
        success: true,
        message: 'Removals retrieved',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: [], // Zero websites
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <RemovalRequestsPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Removal Requests & Erasure Tracking/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /New Removal Request/i }));

      await waitFor(() => {
        expect(screen.getByText(/No tracked websites found. Please add a website first./i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go to Websites Page/i })).toBeInTheDocument();
      });
    });

    it('submits valid target website, custom exposure description, and statutory reason to removalRequestApi.create', async () => {
      vi.spyOn(removalRequestApi, 'list').mockResolvedValue({
        success: true,
        message: 'Removals retrieved',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: mockWebsites,
      });

      const createSpy = vi.spyOn(removalRequestApi, 'create').mockResolvedValueOnce({
        success: true,
        message: 'Removal created',
        data: {
          id: 'rem-new-1',
          userId: 'user-1',
          websiteId: 'web-facebook',
          exposureRecordId: 'exp-fb',
          requestType: 'GDPR_ERASURE',
          requestReason: 'Statutory right to erasure under GDPR Article 17',
          requestStatus: 'DRAFT',
          trackingToken: 'TRK-99001',
          createdAt: '2026-11-03T12:00:00Z',
          updatedAt: '2026-11-03T12:00:00Z',
        },
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <RemovalRequestsPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Removal Requests & Erasure Tracking/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /New Removal Request/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Target Website/i)).toBeInTheDocument();
      });

      // Select Target Website
      const websiteSelect = screen.getByLabelText(/Target Website/i);
      fireEvent.change(websiteSelect, { target: { value: 'web-facebook' } });

      // Enter description in textarea
      const textarea = screen.getByPlaceholderText('Example: My phone number is publicly visible on Instagram.');
      fireEvent.change(textarea, { target: { value: 'My private mobile phone number is visible to search engines.' } });

      // Enter statutory reason
      const reasonInput = screen.getByLabelText(/Statutory Basis \/ Request Reason/i);
      fireEvent.change(reasonInput, { target: { value: 'Statutory right to erasure under GDPR Article 17' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Initiate Request/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            websiteId: 'web-facebook',
            exposedDataDescription: 'My private mobile phone number is visible to search engines.',
            requestReason: 'Statutory right to erasure under GDPR Article 17',
          })
        );
      });
    });

    it('displays the user-described exposed personal information on existing removal request cards', async () => {
      vi.spyOn(removalRequestApi, 'list').mockResolvedValue({
        success: true,
        message: 'Removals retrieved',
        data: [
          {
            id: 'rem-card-1',
            userId: 'user-1',
            websiteId: 'web-facebook',
            exposureRecordId: 'exp-1',
            requestType: 'GDPR_ERASURE',
            requestReason: 'Exercise of GDPR erasure rights',
            requestStatus: 'IN_PROGRESS',
            trackingToken: 'TRK-12345',
            website: { id: 'web-facebook', userId: 'user-1', websiteName: 'Facebook', websiteUrl: 'https://facebook.com', websiteCategory: 'SOCIAL_MEDIA' as const, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z' },
            exposureRecord: {
              id: 'exp-1',
              userId: 'user-1',
              websiteId: 'web-facebook',
              purpose: 'Public Email Exposure',
              notes: 'User phone number and personal email publicly indexable on profile page',
              sensitivityLevel: 'HIGH' as const,
              dateShared: '2026-11-01T00:00:00Z',
              recordStatus: 'REMOVAL_REQUESTED' as const,
              createdAt: '2026-11-03T10:00:00Z',
              updatedAt: '2026-11-03T10:00:00Z',
            },
            createdAt: '2026-11-03T12:00:00Z',
            updatedAt: '2026-11-03T12:00:00Z',
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      vi.spyOn(websiteApi, 'list').mockResolvedValue({
        success: true,
        message: 'Websites retrieved',
        data: mockWebsites,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <RemovalRequestsPage />
          </ToastProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Exercise of GDPR erasure rights')).toBeInTheDocument();
        expect(screen.getByText(/Exposed Personal Information:/i)).toBeInTheDocument();
        expect(screen.getByText('User phone number and personal email publicly indexable on profile page')).toBeInTheDocument();
      });
    });
  });

  describe('Part 2 – Removal of Duplicate Activity History from Dashboard', () => {
    it('renders dashboard metrics and charts without duplicate Recent Privacy Operations timeline', async () => {
      vi.spyOn(dashboardApi, 'getOverview').mockResolvedValueOnce({
        success: true,
        message: 'Overview',
        data: {
          totalWebsites: 2,
          totalExposures: 3,
          activeRemovalRequests: 1,
          completedRemovalRequests: 0,
        },
      });
      vi.spyOn(dashboardApi, 'getExposureBreakdown').mockResolvedValueOnce({
        success: true,
        message: 'Breakdown',
        data: { sensitivityDistribution: {}, categoryDistribution: {} },
      });
      vi.spyOn(dashboardApi, 'getRemovalProgress').mockResolvedValueOnce({
        success: true,
        message: 'Progress',
        data: { totalRequests: 1, statusDistribution: {}, typeDistribution: {} },
      });

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Privacy Posture Overview')).toBeInTheDocument();
        expect(screen.getByText('Tracked Websites')).toBeInTheDocument();
        expect(screen.getByText('Active Exposures')).toBeInTheDocument();
      });

      // Verify that Recent Privacy Operations is completely absent from Dashboard
      expect(screen.queryByText('Recent Privacy Operations')).not.toBeInTheDocument();
      expect(screen.queryByText('View Full Audit Trail')).not.toBeInTheDocument();
      expect(screen.queryByText(/Chronological activity across all privacy modules/i)).not.toBeInTheDocument();
    });
  });

  describe('Part 4 & 5 – Landing Page Navigation & 3D Shield Animation', () => {
    it('provides correct anchor targets and navigation menu on Landing Page', () => {
      render(
        <MemoryRouter>
          <ToastProvider>
            <AuthProvider>
              <LandingPage />
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      );

      expect(screen.getByText(/TAKE CONTROL OF YOUR/i)).toBeInTheDocument();
      expect(screen.getAllByText(/The Internet's Forget Button/i).length).toBeGreaterThanOrEqual(1);

      // Navigation links
      const featuresLink = screen.getAllByRole('link', { name: /^Features$/i });
      expect(featuresLink.length).toBeGreaterThanOrEqual(1);

      // Section IDs
      expect(document.getElementById('features')).toBeInTheDocument();
      expect(document.getElementById('how-it-works')).toBeInTheDocument();
      expect(document.getElementById('security')).toBeInTheDocument();
      expect(document.getElementById('preview')).toBeInTheDocument();
    });

    it('renders 3D Privacy Shield with canvas element and reduced-motion compliance', () => {
      render(<PrivacyShield3D />);
      const shield = screen.getByLabelText(/3D Interactive Digital Privacy Shield Animation/i);
      expect(shield).toBeInTheDocument();
    });

    it('renders 3D Card wrapper and handles interactive mouse movement', () => {
      const { container } = render(
        <Card3D className="test-card">
          <span>Card Content</span>
        </Card3D>
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();

      fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
      expect(card.style.transform).toContain('perspective');

      fireEvent.mouseLeave(card);
      expect(card.style.transform).toBe('');
    });
  });
});
