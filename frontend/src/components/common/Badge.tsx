import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variants = {
    primary: 'bg-electric-500/15 text-electric-400 border border-electric-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    info: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    neutral: 'bg-slate-800/60 text-slate-300 border border-slate-700/50',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const SensitivityBadge: React.FC<{ level: string; className?: string }> = ({
  level,
  className = '',
}) => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL':
      return <Badge variant="danger" size="sm" className={className}>CRITICAL</Badge>;
    case 'HIGH':
      return <Badge variant="warning" size="sm" className={className}>HIGH</Badge>;
    case 'MEDIUM':
      return <Badge variant="info" size="sm" className={className}>MEDIUM</Badge>;
    case 'LOW':
    default:
      return <Badge variant="success" size="sm" className={className}>LOW</Badge>;
  }
};

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({
  status,
  className = '',
}) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'COMPLETED':
      return <Badge variant="success" size="sm" className={className}>{status.replace('_', ' ')}</Badge>;
    case 'SUBMITTED':
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return <Badge variant="info" size="sm" className={className}>{status.replace('_', ' ')}</Badge>;
    case 'PENDING':
    case 'PENDING_REVIEW':
    case 'FOLLOW_UP_REQUIRED':
      return <Badge variant="warning" size="sm" className={className}>{status.replace('_', ' ')}</Badge>;
    case 'REJECTED':
    case 'SUSPENDED':
    case 'DEACTIVATED':
      return <Badge variant="danger" size="sm" className={className}>{status.replace('_', ' ')}</Badge>;
    case 'DRAFT':
    case 'ARCHIVED':
    default:
      return <Badge variant="neutral" size="sm" className={className}>{status?.replace('_', ' ') || 'UNKNOWN'}</Badge>;
  }
};

export const VisibilityBadge: React.FC<{ visibility?: string; className?: string }> = ({
  visibility,
  className = '',
}) => {
  switch (visibility?.toUpperCase()) {
    case 'PUBLIC':
      return <Badge variant="danger" size="sm" className={className}>PUBLIC</Badge>;
    case 'RESTRICTED':
      return <Badge variant="warning" size="sm" className={className}>RESTRICTED</Badge>;
    case 'PRIVATE':
      return <Badge variant="success" size="sm" className={className}>PRIVATE</Badge>;
    case 'UNKNOWN':
    default:
      return <Badge variant="neutral" size="sm" className={className}>UNKNOWN</Badge>;
  }
};

export const RemediationBadge: React.FC<{ status?: string; className?: string }> = ({
  status,
  className = '',
}) => {
  switch (status?.toUpperCase()) {
    case 'RESOLVED':
      return <Badge variant="success" size="sm" className={className}>RESOLVED</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="warning" size="sm" className={className}>IN PROGRESS</Badge>;
    case 'NOT_STARTED':
    default:
      return <Badge variant="neutral" size="sm" className={className}>NOT STARTED</Badge>;
  }
};
