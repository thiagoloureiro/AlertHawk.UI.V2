import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, LogOut, Sparkles, Activity, Loader2 } from 'lucide-react';
import { useMsal } from "@azure/msal-react";
import { msalService } from '../services/msalService';
import { WhatsNewModal } from './WhatsNewModal';
import monitorService from '../services/monitorService';
import { MonitorGroup } from '../types';

interface TopBarProps {
  isDarkTheme: boolean;
  onThemeToggle: () => void;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

interface MonitorStatus {
  online: number;
  offline: number;
  paused: number;
}

export function TopBar({ isDarkTheme, onThemeToggle }: TopBarProps) {
  const { accounts, instance } = useMsal();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>({ online: 0, offline: 0, paused: 0 });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const userInfo: UserInfo | null = (() => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  })();

  const displayName = userInfo?.username || accounts[0]?.name || 'User';
  const email = userInfo?.email || accounts[0]?.username || '';

  useEffect(() => {
    async function fetchMonitorStatus() {
      try {
        setIsLoadingStatus(true);
        const groups = await monitorService.getDashboardGroups(6); // Production environment
        const status = groups.reduce((acc, group) => {
          group.monitors.forEach(monitor => {
            if (monitor.paused) {
              acc.paused++;
            } else if (monitor.status) {
              acc.online++;
            } else {
              acc.offline++;
            }
          });
          return acc;
        }, { online: 0, offline: 0, paused: 0 });
        setMonitorStatus(status);
      } catch (error) {
        console.error('Failed to fetch monitor status:', error);
      } finally {
        setIsLoadingStatus(false);
      }
    }

    fetchMonitorStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonitorStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const hasMsalAccount = accounts.length > 0;
    
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');

    // Only do MSAL logout if we're using MSAL
    if (hasMsalAccount) {
      await instance.logoutRedirect();
    } else {
      // For standard auth, just redirect to login
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    async function fetchUserPhoto() {
      const photo = await msalService.getUserPhoto();
      setUserPhoto(photo);
    }
    fetchUserPhoto();
  }, []);

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="h-16 px-4 border-b dark:border-gray-700 border-gray-200 flex items-center justify-between
                    dark:bg-gray-900 bg-white transition-colors duration-200">
      {/* Logo and App Name */}
      <div className="flex items-center gap-2">
        <img 
          src="../assets/logo.png" 
          alt="AlertHawk Logo" 
          className="w-8 h-8 object-contain"
        />
        <span className="text-2xl font-semibold dark:text-white text-gray-900">
          AlertHawk
        </span>
      </div>

      {/* Monitor Status */}
      <div className="flex items-center gap-6">
        {isLoadingStatus ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-gray-500 dark:text-gray-400 animate-spin" />
            <span className="text-sm font-medium dark:text-white text-gray-900">
              Loading status...
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500 dark:text-green-400" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-green-500 dark:text-green-400">
                  {monitorStatus.online}
                </span>
                <span className="text-sm font-medium dark:text-white text-gray-900">
                  Online
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-500 dark:text-red-400" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-red-500 dark:text-red-400">
                  {monitorStatus.offline}
                </span>
                <span className="text-sm font-medium dark:text-white text-gray-900">
                  Offline
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                  {monitorStatus.paused}
                </span>
                <span className="text-sm font-medium dark:text-white text-gray-900">
                  Paused
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side: Theme Toggle, Notifications, and User Menu */}
      <div className="flex items-center gap-4">
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {isDarkTheme ? (
            <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
       {/* <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        */}
        {/* User Menu */}
        <div ref={menuRef} className="relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white overflow-hidden">
              {userPhoto ? (
                <img src={userPhoto} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium dark:text-white text-gray-900">
                {displayName}
              </div>
              <div className="text-xs dark:text-gray-400 text-gray-600">
                {email}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 border-gray-200">
              {userInfo?.isAdmin && (
                <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                  Administrator
                </div>
              )}
              <button
                onClick={() => {
                  setShowWhatsNew(true);
                  setShowUserMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                What's New
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </div>
  );
}