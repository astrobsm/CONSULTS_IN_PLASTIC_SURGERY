/**
 * PS Consult – UNTH: Main Layout Component
 *
 * Sidebar navigation + top bar + main content area.
 */
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  ClipboardList,
  Calendar,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import { useInstallPrompt } from '../context/InstallPromptContext';
import { dashboardAPI } from '../api/client';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/app/consults/new', label: 'New Consult', icon: FilePlus, roles: null },
  { to: '/app/consults', label: 'Consult List', icon: ClipboardList, roles: null },
  { to: '/app/schedule', label: 'Schedule', icon: Calendar, roles: null },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, roles: null },
  { to: '/app/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { isOnline, pendingCount, syncing, attemptSync } = useOnlineStatus();
  const { isInstallable, promptInstall } = useInstallPrompt();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOnline) {
      dashboardAPI
        .notifications(true)
        .then((res) => setUnreadCount(res.data.length))
        .catch(() => {});
    }
  }, [isOnline]);

  // Poll for notifications every 30 seconds when online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      dashboardAPI
        .notifications(true)
        .then((res) => setUnreadCount(res.data.length))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => hasRole(r))
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-primary-800 text-white
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="p-5 border-b border-primary-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/unth-logo.png" alt="UNTH" className="w-10 h-10 rounded-lg object-contain bg-white/10 p-0.5" />
              <div>
                <h1 className="text-lg font-bold tracking-tight">PS Consult</h1>
                <p className="text-xs text-blue-200 mt-0.5">UNTH, Ituku-Ozalla</p>
              </div>
            </div>
            <button
              className="lg:hidden p-1 hover:bg-primary-700 rounded"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 flex-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                 transition-colors duration-150 mb-1
                 ${
                   isActive
                     ? 'bg-primary-700 text-white'
                     : 'text-blue-100 hover:bg-primary-700/50 hover:text-white'
                 }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.to === '/app/notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Install App Button */}
        {isInstallable && (
          <div className="px-3 pb-2">
            <button
              onClick={promptInstall}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Download size={18} />
              Install App
            </button>
          </div>
        )}

        {/* User info + logout */}
        <div className="p-4 border-t border-primary-700">
          <div className="text-sm font-medium truncate">{user?.full_name}</div>
          <div className="text-xs text-blue-200 capitalize mt-0.5">
            {user?.role?.replace('_', ' ')}
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />

          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium bg-amber-50 px-2.5 py-1.5 rounded-full">
              <WifiOff size={14} />
              Offline
            </div>
          )}
          {isOnline && pendingCount > 0 && (
            <button
              onClick={attemptSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-blue-600 text-xs font-medium bg-blue-50 px-2.5 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              Sync ({pendingCount})
            </button>
          )}
          {isOnline && pendingCount === 0 && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
              <Wifi size={14} />
              Online
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto relative">
          {/* Page watermark */}
          <div className="fixed bottom-4 right-4 pointer-events-none z-0 opacity-[0.04]">
            <img src="/unth-logo.png" alt="" className="w-40 h-40" />
          </div>
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
