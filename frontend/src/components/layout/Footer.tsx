import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    if (location.pathname === '/') {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(`/#${id}`);
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <footer className="border-t border-navy-800 bg-navy-950 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Brand Information */}
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 font-mono tracking-wider">OBLIVION</div>
            <div className="text-xs text-slate-400 mt-1">
              Personal Privacy Management Platform.
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-300">
          <a
            href="#features"
            onClick={(e) => handleNavClick(e, 'features')}
            className="hover:text-electric-400 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => handleNavClick(e, 'how-it-works')}
            className="hover:text-electric-400 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#security"
            onClick={(e) => handleNavClick(e, 'security')}
            className="hover:text-electric-400 transition-colors"
          >
            Security
          </a>
          <Link to="/login" className="hover:text-electric-400 transition-colors">
            Sign In
          </Link>
          <Link to="/register" className="hover:text-electric-400 transition-colors">
            Create Account
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-xs text-slate-400 font-mono">
          © 2026 OBLIVION. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
