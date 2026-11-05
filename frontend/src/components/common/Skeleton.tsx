import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
}) => {
  const variants = {
    text: 'h-4 w-full rounded',
    rect: 'h-24 w-full rounded-xl',
    circle: 'h-10 w-10 rounded-full',
  };

  return (
    <div
      className={`animate-pulse bg-navy-800/80 ${variants[variant]} ${className}`}
    />
  );
};
