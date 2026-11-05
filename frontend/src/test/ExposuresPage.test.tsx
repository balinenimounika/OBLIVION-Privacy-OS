import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ExposuresPage } from '../pages/exposures/ExposuresPage';
import { exposureApi } from '../api/exposure.api';
import { websiteApi } from '../api/website.api';
import { categoryApi } from '../api/category.api';
import { ToastProvider } from '../context/ToastContext';
import { ExposureRecord, ExposureSummaryResponse, Website, DataCategory } from '../types';

const mockSummary: ExposureSummaryResponse = {
  totalExposures: 4,
  activeExposures: 3,
  criticalExposures: 1,
  resolvedExposures: 1,
  riskDistribution: {
    low: 1,
    medium: 1,
    high: 1,
    critical: 1,
  },
  byPlatform: [
    {
      platformId: 'web-1',
      platformName: 'Facebook Data Broker',
      platformUrl: 'https://broker.example.com',
      exposureCount: 2,
      highestRisk: 82,
      hasCritical: true,
    },
    {
      platformId: 'web-2',
      platformName: 'LinkedIn Corp',
      platformUrl: 'https://linkedin.com',
      exposureCount: 1,
      highestRisk: 12,
      hasCritical: false,
    },
  ],
};

const mockWebsites: Website[] = [
  {
    id: 'web-1',
    userId: 'user-1',
    websiteName: 'Facebook Data Broker',
    websiteUrl: 'https://broker.example.com',
    websiteCategory: 'SOCIAL_MEDIA',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'web-2',
    userId: 'user-1',
    websiteName: 'LinkedIn Corp',
    websiteUrl: 'https://linkedin.com',
    websiteCategory: 'EMPLOYMENT',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
];

const mockCategories: DataCategory[] = [
  {
    id: 'cat-1',
    categoryName: 'Contact Information',
    name: 'Contact Information',
    description: 'Phone numbers and email addresses',
    defaultSensitivity: 'HIGH',
    sensitivityLevel: 'HIGH',
    riskWeight: 7,
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    categoryName: 'Identity Information',
    name: 'Identity Information',
    description: 'Full name, date of birth, gender',
    defaultSensitivity: 'HIGH',
    sensitivityLevel: 'HIGH',
    riskWeight: 7,
    createdAt: '2026-11-01T00:00:00Z',
  },
];

const mockExposures: ExposureRecord[] = [
  {
    id: 'exp-1',
    userId: 'user-1',
    websiteId: 'web-1',
    purpose: 'Marketing Profiling & Lead Generation',
    platformUrl: 'https://broker.example.com/user/profile',
    dataDescription: 'Full Name, Phone: +1 •••• 9921',
    exposureSource: 'ONLINE_PURCHASE',
    visibility: 'PUBLIC',
    sharingStatus: 'ACTIVE',
    remediationStatus: 'NOT_STARTED',
    sensitivityLevel: 'CRITICAL',
    dateShared: '2026-11-01T00:00:00Z',
    lastVerifiedDate: '2026-11-05T00:00:00Z',
    evidenceAttachment: 'https://archive.is/sample-evidence',
    notes: 'Discovered in public marketing aggregation database',
    recordStatus: 'ACTIVE',
    calculatedRiskScore: 82,
    calculatedRiskRating: 'CRITICAL',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
    website: mockWebsites[0],
    categories: [
      {
        dataCategory: mockCategories[0],
      },
      {
        dataCategory: mockCategories[1],
      },
    ],
    riskBreakdown: {
      baseCategoryWeight: 14,
      categoryCount: 2,
      categoryVolumeFactor: 1.05,
      platformSensitivityMultiplier: 2.2,
      visibilityMultiplier: 1.5,
      sharingStatusMultiplier: 1.0,
      remediationMultiplier: 1.0,
      rawScore: 49.35,
      normalizedScore: 82,
      riskLevel: 'CRITICAL',
      keyFactors: [
        '+5% multi-category correlation penalty',
        'CRITICAL platform sensitivity (2.2x)',
        'PUBLIC visibility profile (1.5x)',
      ],
    },
    removalRequests: [],
    activityTimeline: [
      {
        id: 'audit-1',
        action: 'EXPOSURE_CREATED',
        entityType: 'EXPOSURE_RECORD',
        createdAt: '2026-11-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'exp-2',
    userId: 'user-1',
    websiteId: 'web-2',
    purpose: 'Professional Networking & Job History',
    platformUrl: 'https://linkedin.com/in/sample',
    dataDescription: 'Professional profile details',
    exposureSource: 'ACCOUNT_REGISTRATION',
    visibility: 'RESTRICTED',
    sharingStatus: 'ACTIVE',
    remediationStatus: 'RESOLVED',
    sensitivityLevel: 'LOW',
    dateShared: '2026-10-15T00:00:00Z',
    recordStatus: 'REMOVED',
    calculatedRiskScore: 12,
    calculatedRiskRating: 'LOW',
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
    website: mockWebsites[1],
    categories: [],
  },
];

function renderExposuresPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ExposuresPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('OBLIVION Personal Exposure Management Upgrade – Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(exposureApi, 'getSummary').mockResolvedValue({
      success: true,
      message: 'Summary retrieved',
      data: mockSummary,
    });

    vi.spyOn(exposureApi, 'list').mockResolvedValue({
      success: true,
      message: 'Exposures retrieved',
      data: mockExposures,
    });

    vi.spyOn(websiteApi, 'list').mockResolvedValue({
      success: true,
      message: 'Websites retrieved',
      data: mockWebsites,
    });

    vi.spyOn(categoryApi, 'list').mockResolvedValue({
      success: true,
      message: 'Categories retrieved',
      data: mockCategories,
    });
  });

  it('renders summary KPI cards, risk distribution bar, and platform listings', async () => {
    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByText('Personal Exposure Records')).toBeInTheDocument();
    });

    // Summary KPI metric values
    expect(screen.getByText('Total Exposures')).toBeInTheDocument();
    expect(screen.getByText('Active Exposures')).toBeInTheDocument();
    expect(screen.getByText('Critical Exposures')).toBeInTheDocument();
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Table rows & platform information
    expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
    expect(screen.getAllByText('Facebook Data Broker').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Professional Networking & Job History')).toBeInTheDocument();
    expect(screen.getAllByText('LinkedIn Corp').length).toBeGreaterThanOrEqual(1);

    // Badges
    expect(screen.getByText('PUBLIC')).toBeInTheDocument();
    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(1);
  });

  it('filters exposure records by search input and dropdown filters', async () => {
    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
    });

    // Mock search-filtered list
    vi.spyOn(exposureApi, 'list').mockResolvedValue({
      success: true,
      message: 'Filtered exposures',
      data: [mockExposures[0]],
    });

    const searchInput = screen.getByPlaceholderText(/search purpose, notes, platform/i);
    fireEvent.change(searchInput, { target: { value: 'Marketing' } });

    await waitFor(() => {
      expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
      expect(screen.queryByText('Professional Networking & Job History')).not.toBeInTheDocument();
    });
  });

  it('opens detailed exposure dossier view modal with risk breakdown, linked removals, and timeline', async () => {
    vi.spyOn(exposureApi, 'getById').mockResolvedValue({
      success: true,
      message: 'Exposure details retrieved',
      data: mockExposures[0],
    });

    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
    });

    // Click "Details" button on the first exposure card
    const detailsButtons = screen.getAllByRole('button', { name: /details/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Exposure Record Full Dossier')).toBeInTheDocument();
    });

    // Verify dossier sections
    expect(screen.getByText(/Dynamic Risk Breakdown & Explanatory Factors/i)).toBeInTheDocument();
    expect(screen.getByText('Base Category')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('2.2x')).toBeInTheDocument();
    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText(/Key Risk Factors:/i)).toBeInTheDocument();
    expect(screen.getByText(/\+5% multi-category correlation penalty/i)).toBeInTheDocument();
    expect(screen.getByText('Exposure Activity Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('EXPOSURE_CREATED')).toBeInTheDocument();
  });

  it('allows marking an active exposure as resolved', async () => {
    const resolveSpy = vi.spyOn(exposureApi, 'markAsResolved').mockResolvedValue({
      success: true,
      message: 'Exposure marked as resolved',
      data: { ...mockExposures[0], remediationStatus: 'RESOLVED', calculatedRiskScore: 16 } as any,
    });

    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
    });

    const resolveBtn = screen.getByTitle('Mark Exposure as Resolved');
    fireEvent.click(resolveBtn);

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Exposure Resolution')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith('exp-1');
    });
  });

  it('opens Direct Removal Request modal pre-populated with exposure context and creates request', async () => {
    const createRemovalSpy = vi.spyOn(exposureApi, 'createRemovalRequest').mockResolvedValue({
      success: true,
      message: 'Removal request created successfully',
      data: {
        id: 'rem-1',
        userId: 'user-1',
        websiteId: 'web-1',
        exposureRecordId: 'exp-1',
        requestStatus: 'DRAFT',
      } as any,
    });

    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByText('Marketing Profiling & Lead Generation')).toBeInTheDocument();
    });

    const removalBtn = screen.getAllByRole('button', { name: /removal/i })[0];
    fireEvent.click(removalBtn);

    await waitFor(() => {
      expect(screen.getByText('Initiate Data Removal Request')).toBeInTheDocument();
    });

    expect(screen.getByText(/Legal Request Type \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Reason \/ Legal Justification \*/i)).toBeInTheDocument();

    const submitRemovalBtn = screen.getByRole('button', { name: /initiate removal request/i });
    fireEvent.click(submitRemovalBtn);

    await waitFor(() => {
      expect(createRemovalSpy).toHaveBeenCalledWith('exp-1', expect.objectContaining({
        requestType: 'GDPR_ERASURE',
      }));
    });
  });

  it('opens Create Exposure modal with dynamic risk preview box and submits new exposure', async () => {
    const createSpy = vi.spyOn(exposureApi, 'create').mockResolvedValue({
      success: true,
      message: 'Exposure created successfully',
      data: mockExposures[0],
    });

    renderExposuresPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /catalog exposure/i })).toBeInTheDocument();
    });

    const catalogBtn = screen.getByRole('button', { name: /catalog exposure/i });
    fireEvent.click(catalogBtn);

    await waitFor(() => {
      expect(screen.getByText('Catalog Personal Data Exposure')).toBeInTheDocument();
    });

    // Check presence of newly added fields
    expect(screen.getByText(/Platform URL \(Optional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Exposure Source/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Visibility/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Remediation Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Dynamic Risk Engine Preview/i)).toBeInTheDocument();

    // Fill form
    const purposeInput = screen.getByPlaceholderText(/e\.g\. Account profile registration, job application/i);
    fireEvent.change(purposeInput, { target: { value: 'New Test Account Exposure' } });

    const createSubmitBtn = screen.getByRole('button', { name: /catalog exposure record/i });
    fireEvent.click(createSubmitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        purpose: 'New Test Account Exposure',
      }));
    });
  });
});
