import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-electric-600 hover:bg-electric-500 text-white shadow-glow-purple border border-electric-400/30 focus:ring-electric-500 focus:ring-offset-navy-950 active:scale-[0.98]',
    secondary:
      'bg-navy-800 hover:bg-navy-750 text-slate-100 border border-slate-700/50 hover:border-slate-600 focus:ring-slate-500 focus:ring-offset-navy-950 active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-navy-800/60 text-slate-200 border border-navy-700 hover:border-electric-500/50 focus:ring-electric-500 focus:ring-offset-navy-950 active:scale-[0.98]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/30 focus:ring-rose-500 focus:ring-offset-navy-950 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-slate-800/40 text-slate-300 hover:text-white focus:ring-slate-600 focus:ring-offset-navy-950',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
