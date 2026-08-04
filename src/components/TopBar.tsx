import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, LogOut, Sparkles, Palette, AlertTriangle, Shield, Check, ChevronDown } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { useMsal } from "@azure/msal-react";
import { msalService } from '../services/msalService';
import { WhatsNewModal } from './WhatsNewModal';
import monitorService from '../services/monitorService';

const getStoredEnvironment = (): number => {
  try {
    const stored = localStorage.getItem('selectedEnvironment');
    return stored ? parseInt(stored, 10) : 6;
  } catch {
    return 6;
  }
};

const getEnvironmentInfo = (environmentId: number) => {
  switch (environmentId) {
    case 1:
      return { name: 'DEV', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20' };
    case 2:
      return { name: 'STG', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' };
    case 3:
      return { name: 'QA', className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20' };
    case 4:
      return { name: 'TEST', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20' };
    case 5:
      return { name: 'PRE', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20' };
    case 6:
      return { name: 'PROD', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' };
    default:
      return { name: 'UNK', className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-gray-500/20' };
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
  const envInfo = getEnvironmentInfo(selectedEnvironment);
  const totalMonitors = monitorStatus.online + monitorStatus.offline + monitorStatus.paused;

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
    
    const handleMaintenanceWindowUpdate = () => {
      fetchMonitorExecutionStatus();
    };
    
    const handleMonitorExecutionUpdate = () => {
      fetchMonitorExecutionStatus();
    };
    
    window.addEventListener('maintenanceWindowUpdated', handleMaintenanceWindowUpdate);
    window.addEventListener('monitorExecutionStatusUpdated', handleMonitorExecutionUpdate);
    
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
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');

    if (hasMsalAccount) {
      await instance.logoutRedirect();
    } else {
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

  const themes = [
    { value: 'light' as const, label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark' as const, label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'darcula' as const, label: 'Darcula', icon: <Palette className="w-4 h-4" /> },
    { value: 'monokai' as const, label: 'Monokai', icon: <Palette className="w-4 h-4" /> },
    { value: 'github-dark' as const, label: 'GitHub Dark', icon: <Palette className="w-4 h-4" /> },
  ];

  return (
    <header className="h-14 px-4 lg:px-5 flex items-center justify-between gap-4
                    border-b border-gray-200/80 dark:border-gray-800
                    bg-white dark:bg-gray-950
                    transition-colors duration-200 relative z-[9999]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <img 
          src="../assets/logo.png" 
          alt="AlertHawk" 
          className="w-8 h-8 object-contain shrink-0"
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            AlertHawk
          </span>
          <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset ${envInfo.className}`}>
            {envInfo.name}
          </span>
        </div>
      </div>

      {/* Live status strip */}
      <div className="flex items-center justify-center flex-1 min-w-0">
        {isLoadingStatus ? (
          <LoadingSpinner size="sm" text="Syncing..." />
        ) : isMonitorExecutionDisabled ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md
                          bg-amber-50 dark:bg-amber-950/40
                          ring-1 ring-inset ring-amber-200 dark:ring-amber-800/60
                          text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">
              Execution disabled — all monitors paused for maintenance
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 sm:gap-0
                          rounded-lg bg-gray-50 dark:bg-gray-900
                          ring-1 ring-inset ring-gray-200/80 dark:ring-gray-800
                          px-1 py-1">
            <StatusStat tone="online" count={monitorStatus.online} label="Online" />
            <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-800 mx-0.5" />
            <StatusStat tone="offline" count={monitorStatus.offline} label="Offline" />
            <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-800 mx-0.5" />
            <StatusStat tone="paused" count={monitorStatus.paused} label="Paused" />
            {totalMonitors > 0 && (
              <>
                <div className="hidden md:block w-px h-5 bg-gray-200 dark:bg-gray-800 mx-0.5" />
                <span className="hidden md:inline-flex px-2.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {totalMonitors} total
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div ref={themeMenuRef} className="relative z-[10000]">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     hover:text-gray-700 dark:hover:text-gray-200
                     transition-colors"
            title="Select theme"
            aria-label="Select theme"
          >
            <Palette className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </button>
          {showThemeMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-48 py-1
                            bg-white dark:bg-gray-900
                            rounded-lg shadow-lg
                            ring-1 ring-gray-200 dark:ring-gray-800
                            z-[10000]">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    onThemeChange(t.value);
                    setShowThemeMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${
                    theme === t.value
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80'
                  }`}
                >
                  {t.icon}
                  <span className="flex-1">{t.label}</span>
                  {theme === t.value && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div ref={menuRef} className="relative z-[10000]">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500
                            flex items-center justify-center text-white overflow-hidden
                            text-sm font-medium shrink-0">
              {userPhoto ? (
                <img src={userPhoto} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="text-left hidden md:block min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                {displayName}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-56 py-1
                            bg-white dark:bg-gray-900
                            rounded-lg shadow-lg
                            ring-1 ring-gray-200 dark:ring-gray-800
                            z-[10000] overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {email}
                </div>
                {userInfo?.isAdmin && (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium
                                  text-blue-600 dark:text-blue-400">
                    <Shield className="w-3 h-3" />
                    Administrator
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowWhatsNew(true);
                  setShowUserMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-800
                         flex items-center gap-2.5 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-gray-400" />
                What's New
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-950/30
                         flex items-center gap-2.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </header>
  );
}

function StatusStat({
  tone,
  count,
  label,
}: {
  tone: 'online' | 'offline' | 'paused';
  count: number;
  label: string;
}) {
  const dot =
    tone === 'online'
      ? 'bg-emerald-500'
      : tone === 'offline'
        ? 'bg-red-500'
        : 'bg-gray-400 dark:bg-gray-500';

  const value =
    tone === 'online'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'offline'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400';

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 min-w-[4.5rem]">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className={`text-sm font-semibold tabular-nums leading-none ${value}`}>
        {count}
      </span>
      <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-none hidden sm:inline">
        {label}
      </span>
    </div>
  );
}
