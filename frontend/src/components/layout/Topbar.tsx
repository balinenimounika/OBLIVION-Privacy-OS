import React, { useEffect, useState } from 'react';
import { Menu, Sun, Moon, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationApi } from '../../api/notification.api';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await notificationApi.list({ isRead: false, limit: 1 });
        if (isMounted && res.meta?.unreadCount !== undefined) {
          setUnreadCount(res.meta.unreadCount);
        }
      } catch {
        // Silently handle
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // 30s poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-16 bg-navy-900/90 backdrop-blur-md border-b border-navy-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-slate-200">
            OBLIVION Privacy Dashboard
          </div>
          <div className="text-[10px] text-slate-400">
            Tenant: {user?.fullName || 'User'}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-electric-400" />}
        </button>

        {/* Notifications Icon with Badge */}
        <button
          onClick={() => navigate('/app/notifications')}
          className="relative p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-electric-500 text-white text-[9px] font-bold flex items-center justify-center shadow-glow-purple">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-navy-800" />

        {/* User Profile Pill & Logout */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/settings')}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl hover:bg-navy-800/80 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-electric-600/30 border border-electric-500/30 text-electric-300 flex items-center justify-center font-bold text-xs">
              {user?.fullName?.charAt(0) || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-medium text-slate-100 leading-tight">
                {user?.fullName}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">
                {user?.email}
              </div>
            </div>
          </button>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
