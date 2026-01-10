import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, LogOut, Sparkles, Activity, Palette, AlertTriangle, Shield } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { useMsal } from "@azure/msal-react";
import { msalService } from '../services/msalService';
import { WhatsNewModal } from './WhatsNewModal';
import monitorService from '../services/monitorService';

// Helper function to get environment from localStorage
const getStoredEnvironment = (): number => {
  try {
    const stored = localStorage.getItem('selectedEnvironment');
    return stored ? parseInt(stored, 10) : 6; // Default to Production (6)
  } catch {
    return 6; // Default to Production (6) if localStorage fails
  }
};

// Helper function to get environment info
const getEnvironmentInfo = (environmentId: number) => {
  switch (environmentId) {
    case 1:
      return { name: 'DEV', bgColor: 'bg-blue-500/20 dark:bg-blue-600/20', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500/30 dark:border-blue-400/30' };
    case 2:
      return { name: 'STG', bgColor: 'bg-yellow-500/20 dark:bg-yellow-600/20', textColor: 'text-yellow-600 dark:text-yellow-400', borderColor: 'border-yellow-500/30 dark:border-yellow-400/30' };
    case 3:
      return { name: 'QA', bgColor: 'bg-purple-500/20 dark:bg-purple-600/20', textColor: 'text-purple-600 dark:text-purple-400', borderColor: 'border-purple-500/30 dark:border-purple-400/30' };
    case 4:
      return { name: 'TEST', bgColor: 'bg-orange-500/20 dark:bg-orange-600/20', textColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-500/30 dark:border-orange-400/30' };
    case 5:
      return { name: 'PRE', bgColor: 'bg-indigo-500/20 dark:bg-indigo-600/20', textColor: 'text-indigo-600 dark:text-indigo-400', borderColor: 'border-indigo-500/30 dark:border-indigo-400/30' };
    case 6:
      return { name: 'PROD', bgColor: 'bg-green-500/20 dark:bg-green-600/20', textColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-500/30 dark:border-green-400/30' };
    default:
      return { name: 'UNK', bgColor: 'bg-gray-500/20 dark:bg-gray-600/20', textColor: 'text-gray-600 dark:text-gray-400', borderColor: 'border-gray-500/30 dark:border-gray-400/30' };
  }
};

interface TopBarProps {
  theme: 'light' | 'dark' | 'darcula' | 'monokai' | 'github-dark';
  onThemeChange: (theme: 'light' | 'dark' | 'darcula' | 'monokai' | 'github-dark') => void;
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

export function TopBar({ theme, onThemeChange }: TopBarProps) {
  const { accounts, instance } = useMsal();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>({ online: 0, offline: 0, paused: 0 });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState<number>(getStoredEnvironment());
  const [isMonitorExecutionDisabled, setIsMonitorExecutionDisabled] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  
  const userInfo: UserInfo | null = (() => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  })();

  const displayName = userInfo?.username || accounts[0]?.name || 'User';
  const email = userInfo?.email || accounts[0]?.username || '';

  // Poll for environment changes in localStorage
  useEffect(() => {
    let currentEnvironment = getStoredEnvironment();
    setSelectedEnvironment(currentEnvironment);

    const checkEnvironmentChange = () => {
      const newEnvironment = getStoredEnvironment();
      if (newEnvironment !== currentEnvironment) {
        currentEnvironment = newEnvironment;
        setSelectedEnvironment(newEnvironment);
      }
    };

    // Check every 100ms for environment changes
    const interval = setInterval(checkEnvironmentChange, 100);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchMonitorStatus() {
      try {
        setIsLoadingStatus(true);
        const groups = await monitorService.getDashboardGroups(selectedEnvironment);
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

    async function fetchMonitorExecutionStatus() {
      try {
        const status = await monitorService.getMonitorExecutionStatus();
        setIsMonitorExecutionDisabled(status.isDisabled);
      } catch (error) {
        console.error('Failed to fetch monitor execution status:', error);
      }
    }

    fetchMonitorStatus();
    fetchMonitorExecutionStatus();
    
    // Listen for maintenance window updates
    const handleMaintenanceWindowUpdate = () => {
      fetchMonitorExecutionStatus();
    };
    
    // Listen for monitor execution status updates
    const handleMonitorExecutionUpdate = () => {
      fetchMonitorExecutionStatus();
    };
    
    window.addEventListener('maintenanceWindowUpdated', handleMaintenanceWindowUpdate);
    window.addEventListener('monitorExecutionStatusUpdated', handleMonitorExecutionUpdate);
    
    // Refresh every 30 seconds
    const statusInterval = setInterval(fetchMonitorStatus, 30000);
    const executionInterval = setInterval(fetchMonitorExecutionStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(executionInterval);
      window.removeEventListener('maintenanceWindowUpdated', handleMaintenanceWindowUpdate);
      window.removeEventListener('monitorExecutionStatusUpdated', handleMonitorExecutionUpdate);
    };
  }, [selectedEnvironment]);

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
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getThemeIcon = () => {
    return <Palette className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
  };

  const themes = [
    { value: 'light' as const, label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark' as const, label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'darcula' as const, label: 'Darcula', icon: <Palette className="w-4 h-4" /> },
    { value: 'monokai' as const, label: 'Monokai', icon: <Palette className="w-4 h-4" /> },
    { value: 'github-dark' as const, label: 'GitHub Dark', icon: <Palette className="w-4 h-4" /> },
  ];

  return (
    <div className="h-16 px-6 py-2 border-b dark:border-gray-800/50 border-gray-200/50 flex items-center justify-between
                    dark:bg-gray-900/95 bg-white/95 backdrop-blur-sm transition-colors duration-200
                    shadow-sm dark:shadow-gray-900/20 relative z-[9999]">
      {/* Logo and App Name */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <img 
            src="../assets/logo.png" 
            alt="AlertHawk Logo" 
            className="w-9 h-9 object-contain drop-shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">
            AlertHawk
          </span>
          {(() => {
            const envInfo = getEnvironmentInfo(selectedEnvironment);
            return (
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${envInfo.bgColor} ${envInfo.textColor} ${envInfo.borderColor} shadow-sm`}>
                {envInfo.name}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Monitor Status */}
      <div className="flex items-center gap-3">
        {isLoadingStatus ? (
          <LoadingSpinner size="sm" text="Loading status..." />
        ) : isMonitorExecutionDisabled ? (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200/50 dark:border-yellow-800/50 shadow-sm backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-yellow-100 dark:bg-yellow-900/50">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 leading-tight">
                Monitor Execution Disabled
              </span>
              <span className="text-[10px] text-yellow-600/80 dark:text-yellow-400/80 leading-tight">
                All monitors are paused for maintenance
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/30 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/40">
                <Activity className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-green-600 dark:text-green-400 leading-tight">
                  {monitorStatus.online}
                </span>
                <span className="text-[10px] font-medium text-green-700/70 dark:text-green-300/70 leading-tight">
                  Online
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200/50 dark:border-red-800/30 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/40">
                <Activity className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-red-600 dark:text-red-400 leading-tight">
                  {monitorStatus.offline}
                </span>
                <span className="text-[10px] font-medium text-red-700/70 dark:text-red-300/70 leading-tight">
                  Offline
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/30 border border-gray-200/50 dark:border-gray-700/30 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800/50">
                <Activity className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-gray-500 dark:text-gray-400 leading-tight">
                  {monitorStatus.paused}
                </span>
                <span className="text-[10px] font-medium text-gray-600/70 dark:text-gray-400/70 leading-tight">
                  Paused
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side: Theme Toggle, Notifications, and User Menu */}
      <div className="flex items-center gap-3">
        {/* Theme Selector */}
        <div ref={themeMenuRef} className="relative z-[10000]">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Select theme"
          >
            {getThemeIcon()}
          </button>
          {showThemeMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl border dark:border-gray-800/50 border-gray-200/50 z-[10000] animate-in fade-in slide-in-from-top-2 duration-200">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    onThemeChange(t.value);
                    setShowThemeMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-all duration-150 ${
                    theme === t.value
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {t.icon}
                  <span className="flex-1">{t.label}</span>
                  {theme === t.value && (
                    <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
       {/* <button className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 hover:scale-105 active:scale-95 relative">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
        </button>
        */}
        {/* User Menu */}
        <div ref={menuRef} className="relative z-[10000]">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 hover:scale-105 active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white overflow-hidden shadow-md ring-2 ring-blue-100 dark:ring-blue-900/50">
              {userPhoto ? (
                <img src={userPhoto} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold dark:text-white text-gray-900">
                {displayName}
              </div>
              <div className="text-xs dark:text-gray-400 text-gray-600">
                {email}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl border dark:border-gray-800/50 border-gray-200/50 z-[10000] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
              {userInfo?.isAdmin && (
                <div className="px-4 py-2 mb-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 border-b dark:border-gray-800/50 border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    Administrator
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setShowWhatsNew(true);
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-3 transition-colors duration-150"
              >
                <Sparkles className="w-4 h-4" />
                What's New
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-800/50 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors duration-150"
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