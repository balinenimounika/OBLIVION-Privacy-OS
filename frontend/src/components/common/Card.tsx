import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'bordered';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variants = {
    default:
      'bg-navy-900 border border-navy-750/80 rounded-2xl shadow-sm',
    glass:
      'bg-navy-900/70 backdrop-blur-md border border-navy-700/60 rounded-2xl shadow-glass',
    interactive:
      'bg-navy-900 border border-navy-750/80 hover:border-electric-500/40 rounded-2xl shadow-sm hover:shadow-glow-purple transition-all duration-200 cursor-pointer',
    bordered:
      'bg-transparent border border-navy-700/80 rounded-2xl',
  };

  return (
    <div className={`p-5 ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
