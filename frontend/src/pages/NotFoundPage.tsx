import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="p-4 rounded-2xl bg-electric-600/10 text-electric-400 border border-electric-500/20 mb-4 shadow-glow-purple">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h1 className="text-4xl font-extrabold text-white font-mono mb-2">404</h1>
      <h2 className="text-lg font-semibold text-slate-200 mb-2">Resource Not Found</h2>
      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
        The requested path does not exist or has been securely removed in accordance with your privacy preferences.
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={() => navigate('/')}
        leftIcon={<ArrowLeft className="w-4 h-4" />}
      >
        Return to Safety
      </Button>
    </div>
  );
};
