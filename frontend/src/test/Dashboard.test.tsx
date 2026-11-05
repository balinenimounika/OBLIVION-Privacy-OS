import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Badge, SensitivityBadge, StatusBadge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

describe('Common UI Components Rendering', () => {
  it('renders buttons with proper labels and variant styles', () => {
    render(<Button variant="primary">Orchestrate Erasure</Button>);
    expect(screen.getByRole('button', { name: /Orchestrate Erasure/i })).toBeInTheDocument();
  });

  it('renders badges with appropriate sensitivity colors', () => {
    const { rerender } = render(<SensitivityBadge level="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();

    rerender(<SensitivityBadge level="LOW" />);
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('renders status badges with appropriate status labels', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('renders cards with children', () => {
    render(
      <Card>
        <span data-testid="card-child">Privacy Metric</span>
      </Card>
    );
    expect(screen.getByTestId('card-child')).toHaveTextContent('Privacy Metric');
  });
});
