import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CategoriesPage, PREDEFINED_CATEGORIES, getRiskLevelFromWeight } from '../pages/categories/CategoriesPage';
import { categoryApi } from '../api/category.api';
import { ToastProvider } from '../context/ToastContext';

describe('Personal Data Categories Catalog & Risk Weight System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps risk weights to sensitivity levels according to OBLIVION policy', () => {
    expect(getRiskLevelFromWeight(10)).toBe('CRITICAL');
    expect(getRiskLevelFromWeight(9)).toBe('CRITICAL');
    expect(getRiskLevelFromWeight(8)).toBe('HIGH');
    expect(getRiskLevelFromWeight(7)).toBe('HIGH');
    expect(getRiskLevelFromWeight(6)).toBe('MEDIUM');
    expect(getRiskLevelFromWeight(5)).toBe('MEDIUM');
    expect(getRiskLevelFromWeight(4)).toBe('MEDIUM');
    expect(getRiskLevelFromWeight(3)).toBe('LOW');
    expect(getRiskLevelFromWeight(1)).toBe('LOW');
  });

  it('defines exactly 12 predefined categories with exact names and risk weights', () => {
    expect(PREDEFINED_CATEGORIES).toHaveLength(12);

    const expectedCatalog = [
      { name: 'Government Identification', risk: 10, level: 'CRITICAL', sampleEx: 'Aadhaar' },
      { name: 'Financial Information', risk: 10, level: 'CRITICAL', sampleEx: 'Bank Account' },
      { name: 'Authentication Credentials', risk: 10, level: 'CRITICAL', sampleEx: 'Passwords' },
      { name: 'Identity Information', risk: 7, level: 'HIGH', sampleEx: 'Full Name' },
      { name: 'Contact Information', risk: 7, level: 'HIGH', sampleEx: 'Phone Number' },
      { name: 'Location Information', risk: 9, level: 'CRITICAL', sampleEx: 'Home Address' },
      { name: 'Biometric Information', risk: 10, level: 'CRITICAL', sampleEx: 'Face Data' },
      { name: 'Health Information', risk: 9, level: 'CRITICAL', sampleEx: 'Medical Records' },
      { name: 'Employment Information', risk: 6, level: 'MEDIUM', sampleEx: 'Employee ID' },
      { name: 'Education Information', risk: 5, level: 'MEDIUM', sampleEx: 'Student ID' },
      { name: 'Social Media Information', risk: 6, level: 'MEDIUM', sampleEx: 'Social Profiles' },
      { name: 'Family & Personal Relationships', risk: 7, level: 'HIGH', sampleEx: 'Family Details' },
    ];

    expectedCatalog.forEach((expected) => {
      const match = PREDEFINED_CATEGORIES.find((c) => c.name === expected.name);
      expect(match).toBeDefined();
      expect(match?.riskWeight).toBe(expected.risk);
      expect(match?.sensitivityLevel).toBe(expected.level);
      expect(match?.examples).toContain(expected.sampleEx);
    });
  });

  it('renders all 12 categories with real-world examples and risk weights when loaded from API', async () => {
    const mockApiCategories = PREDEFINED_CATEGORIES.map((c, i) => ({
      id: `uuid-${i + 1}`,
      categoryName: c.name,
      description: c.description,
      defaultSensitivity: c.sensitivityLevel as any,
      riskWeight: c.riskWeight,
      createdAt: '2026-11-05T00:00:00Z',
    }));

    vi.spyOn(categoryApi, 'list').mockResolvedValueOnce({
      success: true,
      message: 'Categories loaded',
      data: mockApiCategories,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Personal Data Categories/i })).toBeInTheDocument();
    expect(screen.getByText(/Classification Templates, Not Personal Records/i)).toBeInTheDocument();
    expect(screen.getByText(/Track an Exposure/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Government Identification')).toBeInTheDocument();
      expect(screen.getByText('Financial Information')).toBeInTheDocument();
      expect(screen.getByText('Authentication Credentials')).toBeInTheDocument();
      expect(screen.getByText('Identity Information')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Location Information')).toBeInTheDocument();
      expect(screen.getByText('Biometric Information')).toBeInTheDocument();
      expect(screen.getByText('Health Information')).toBeInTheDocument();
      expect(screen.getByText('Employment Information')).toBeInTheDocument();
      expect(screen.getByText('Education Information')).toBeInTheDocument();
      expect(screen.getByText('Social Media Information')).toBeInTheDocument();
      expect(screen.getByText('Family & Personal Relationships')).toBeInTheDocument();
    });

    // Check specific real-world examples
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText('PAN')).toBeInTheDocument();
    expect(screen.getByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('Voter ID')).toBeInTheDocument();
    expect(screen.getByText('UPI ID')).toBeInTheDocument();
    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Voiceprints')).toBeInTheDocument();
    expect(screen.getByText('Live Location')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();

    // Check risk weight badges
    expect(screen.getAllByText(/\+10 \/ 10/i).length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText(/\+9 \/ 10/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/\+7 \/ 10/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/\+6 \/ 10/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/\+5 \/ 10/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters categories by real-world example search term', async () => {
    const mockApiCategories = PREDEFINED_CATEGORIES.map((c, i) => ({
      id: `uuid-${i + 1}`,
      categoryName: c.name,
      description: c.description,
      defaultSensitivity: c.sensitivityLevel as any,
      riskWeight: c.riskWeight,
      createdAt: '2026-11-05T00:00:00Z',
    }));

    vi.spyOn(categoryApi, 'list').mockResolvedValue({
      success: true,
      message: 'Categories loaded',
      data: mockApiCategories,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Identification')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by category or real-world example/i);

    // Search for "Aadhaar"
    fireEvent.change(searchInput, { target: { value: 'Aadhaar' } });

    expect(screen.getByText('Government Identification')).toBeInTheDocument();
    expect(screen.queryByText('Financial Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Biometric Information')).not.toBeInTheDocument();

    // Search for "UPI"
    fireEvent.change(searchInput, { target: { value: 'UPI' } });

    expect(screen.getByText('Financial Information')).toBeInTheDocument();
    expect(screen.queryByText('Government Identification')).not.toBeInTheDocument();

    // Search for "GPS"
    fireEvent.change(searchInput, { target: { value: 'GPS' } });

    expect(screen.getByText('Location Information')).toBeInTheDocument();
    expect(screen.queryByText('Financial Information')).not.toBeInTheDocument();
  });

  it('filters categories by sensitivity level selection', async () => {
    const mockApiCategories = PREDEFINED_CATEGORIES.map((c, i) => ({
      id: `uuid-${i + 1}`,
      categoryName: c.name,
      description: c.description,
      defaultSensitivity: c.sensitivityLevel as any,
      riskWeight: c.riskWeight,
      createdAt: '2026-11-05T00:00:00Z',
    }));

    vi.spyOn(categoryApi, 'list').mockResolvedValue({
      success: true,
      message: 'Categories loaded',
      data: mockApiCategories,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Identification')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');

    // Filter by CRITICAL
    fireEvent.change(select, { target: { value: 'CRITICAL' } });

    expect(screen.getByText('Government Identification')).toBeInTheDocument();
    expect(screen.getByText('Financial Information')).toBeInTheDocument();
    expect(screen.getByText('Authentication Credentials')).toBeInTheDocument();
    expect(screen.getByText('Location Information')).toBeInTheDocument();
    expect(screen.getByText('Biometric Information')).toBeInTheDocument();
    expect(screen.getByText('Health Information')).toBeInTheDocument();

    // Non-critical should be filtered out
    expect(screen.queryByText('Identity Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Employment Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Education Information')).not.toBeInTheDocument();
  });

  it('displays empty state with reset filters button when no categories match', async () => {
    const mockApiCategories = PREDEFINED_CATEGORIES.map((c, i) => ({
      id: `uuid-${i + 1}`,
      categoryName: c.name,
      description: c.description,
      defaultSensitivity: c.sensitivityLevel as any,
      riskWeight: c.riskWeight,
      createdAt: '2026-11-05T00:00:00Z',
    }));

    vi.spyOn(categoryApi, 'list').mockResolvedValue({
      success: true,
      message: 'Categories loaded',
      data: mockApiCategories,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Identification')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by category or real-world example/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentCategory123' } });

    expect(screen.getByText('No matching categories found')).toBeInTheDocument();

    const resetButtons = screen.getAllByRole('button', { name: /reset filters|clear filters/i });
    expect(resetButtons.length).toBeGreaterThan(0);

    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Government Identification')).toBeInTheDocument();
    });
  });
});
