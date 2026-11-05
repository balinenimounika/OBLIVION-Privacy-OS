import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the OBLIVION backend server.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-rose-900/40 bg-rose-950/20">
      <div className="p-3 rounded-xl bg-rose-950/80 text-rose-400 mb-3 border border-rose-800/40">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-200 mb-1">{title}</h3>
      <p className="text-xs text-rose-300/80 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
