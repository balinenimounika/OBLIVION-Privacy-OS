import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';

describe('OBLIVION Frontend Application Bootstrap', () => {
  it('renders public landing page with headline and action buttons', () => {
    render(<App />);
    expect(screen.getByText(/TAKE CONTROL OF YOUR/i)).toBeInTheDocument();
    expect(screen.getByText(/DIGITAL FOOTPRINT/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Get Started/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Sign In/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders features and security sections on landing page', () => {
    render(<App />);
    expect(screen.getByText(/Security Built Into Every Layer/i)).toBeInTheDocument();
    expect(screen.getByText(/Tenant-Scoped Access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Parameterized Queries/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Everything You Need to Manage Your Digital Privacy/i)).toBeInTheDocument();
  });
});
