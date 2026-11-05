import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center text-slate-100">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-electric-500/20 border-t-electric-500 animate-spin" />
          <Loader2 className="w-6 h-6 text-electric-400 absolute" />
        </div>
        <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">
          Verifying OBLIVION Security Token...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
