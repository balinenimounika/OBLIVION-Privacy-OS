import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  ShieldAlert,
  Trash2,
  FolderTree,
  BellRing,
  Bell,
  ScrollText,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { unreadCount } = useNotifications();

  const navItems = [
    { label: 'Overview', to: '/app', icon: LayoutDashboard },
    { label: 'Websites', to: '/app/websites', icon: Globe },
    { label: 'Exposures', to: '/app/exposures', icon: ShieldAlert },
    { label: 'Removal Requests', to: '/app/removal-requests', icon: Trash2 },
    { label: 'Data Categories', to: '/app/categories', icon: FolderTree },
    { label: 'Reminders', to: '/app/reminders', icon: BellRing },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
    { label: 'Audit Logs', to: '/app/audit-logs', icon: ScrollText },
    { label: 'Settings', to: '/app/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-900 border-r border-navy-800/80 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Header */}
        <div className="h-16 px-6 border-b border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30 shadow-glow-purple">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider text-slate-100 font-mono">
                OBLIVION
              </div>
              <div className="text-[9px] font-medium tracking-widest text-electric-400 uppercase">
                Privacy OS
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/app'}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-electric-600 text-white shadow-glow-purple font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-navy-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/app/notifications' && unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white min-w-[18px] text-center leading-tight shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer Badge / Account Status */}
        <div className="p-4 border-t border-navy-800">
          <div className="p-3 rounded-xl bg-navy-850/90 border border-navy-750 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="text-[11px] text-slate-300">
              <span className="font-semibold text-slate-200">Privacy Active</span>
              <div className="text-[9px] text-slate-400">Account Protected</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
