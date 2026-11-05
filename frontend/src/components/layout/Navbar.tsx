import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: 'features' },
    { label: 'How It Works', href: 'how-it-works' },
    { label: 'Security', href: 'security' },
    { label: 'Dashboard Preview', href: 'preview' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

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
    <nav className="h-20 border-b border-navy-800/80 bg-navy-950/85 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group"
          onClick={() => {
            setIsMobileMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30 shadow-glow-purple group-hover:border-electric-400/50 transition-colors">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-wider text-slate-100 font-mono">
              OBLIVION
            </div>
            <div className="text-[10px] font-semibold tracking-widest text-electric-400 uppercase">
              The Internet's Forget Button
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-300">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              onClick={(e) => handleNavClick(e, link.href)}
              className="hover:text-electric-400 transition-colors cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Open Dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/register')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-electric-500"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-navy-800 bg-navy-950/95 backdrop-blur-xl px-4 pt-2 pb-6 space-y-4 shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-2 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={`#${link.href}`}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-navy-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-4 border-t border-navy-800/80 flex flex-col gap-2.5">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('/app');
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Open Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="md"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/login');
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/register');
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Get Started Free
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
