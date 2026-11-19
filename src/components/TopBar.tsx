import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, LogOut, Sparkles, Palette, AlertTriangle, Shield, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { LoadingSpinner } from './ui';
import { getPageTitle } from './navigation';
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
  const page = getPageTitle(useLocation().pathname);
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

  const menuPanelClass =
    'absolute top-full right-0 mt-2 p-1 rounded-xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 z-[10000]';
  const menuItemClass =
    'w-full px-2.5 py-2 rounded-lg text-left text-sm flex items-center gap-2.5 transition-colors';

  return (
    <header className="h-14 px-4 lg:px-6 flex items-center justify-between gap-4
                    border-b border-gray-200 dark:border-gray-800
                    bg-white/95 dark:bg-gray-950/95 backdrop-blur
                    transition-colors duration-200 relative z-[9999]">
      {/* Page context */}
      <div className="flex flex-1 basis-0 items-center gap-3 min-w-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-sm">
          <span className="hidden sm:inline text-gray-500 dark:text-gray-400">{page.section}</span>
          <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
          <h1 className="font-semibold text-gray-900 dark:text-white truncate">{page.title}</h1>
        </nav>
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${envInfo.className}`}
          title="Selected environment"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {envInfo.name}
        </span>
      </div>

      {/* Live status */}
      <div className="flex items-center justify-center shrink-0">
        {isLoadingStatus ? (
          <LoadingSpinner size="sm" text="Syncing" className="text-xs px-2" />
        ) : isMonitorExecutionDisabled ? (
          <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full
                          bg-amber-50 dark:bg-amber-500/10
                          ring-1 ring-inset ring-amber-200 dark:ring-amber-500/25
                          text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">
              <span className="hidden lg:inline">Execution disabled — monitors paused for maintenance</span>
              <span className="lg:hidden">Maintenance</span>
            </span>
          </div>
        ) : (
          <div
            className="hidden sm:inline-flex items-center h-8 rounded-full p-0.5
                       bg-gray-50 dark:bg-white/[0.03]
                       ring-1 ring-inset ring-gray-200 dark:ring-gray-800"
            title={`${totalMonitors} monitors`}
          >
            <StatusStat tone="online" count={monitorStatus.online} label="Online" />
            <StatusStat tone="offline" count={monitorStatus.offline} label="Offline" />
            <StatusStat tone="paused" count={monitorStatus.paused} label="Paused" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-1 basis-0 items-center justify-end gap-2 min-w-0">
        <div ref={themeMenuRef} className="relative z-[10000]">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg
                     text-gray-500 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-white/[0.06]
                     hover:text-gray-900 dark:hover:text-white
                     transition-colors"
            title="Select theme"
            aria-label="Select theme"
          >
            {theme === 'light' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          {showThemeMenu && (
            <div className={`${menuPanelClass} w-48`}>
              <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                Theme
              </div>
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    onThemeChange(t.value);
                    setShowThemeMenu(false);
                  }}
                  className={`${menuItemClass} ${
                    theme === t.value
                      ? 'bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-white font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-gray-400">{t.icon}</span>
                  <span className="flex-1">{t.label}</span>
                  {theme === t.value && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative z-[10000]">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 h-9 pl-1 pr-2 rounded-lg
                     hover:bg-gray-100 dark:hover:bg-white/[0.06]
                     transition-colors"
          >
            <Avatar photo={userPhoto} name={displayName} />
            <div className="text-left hidden md:block min-w-0">
              <div className="text-[13px] font-medium leading-tight text-gray-900 dark:text-white truncate max-w-[140px]">
                {displayName}
              </div>
              {userInfo?.isAdmin && (
                <div className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">Administrator</div>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className={`${menuPanelClass} w-64`}>
              <div className="flex items-center gap-3 px-2.5 py-2.5 mb-1 border-b border-gray-100 dark:border-gray-800">
                <Avatar photo={userPhoto} name={displayName} size="lg" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</div>
                  {userInfo?.isAdmin && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <Shield className="w-3 h-3" />
                      Administrator
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowWhatsNew(true);
                  setShowUserMenu(false);
                }}
                className={`${menuItemClass} text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]`}
              >
                <Sparkles className="w-4 h-4 text-gray-400" />
                What's new
              </button>
              <button
                onClick={handleLogout}
                className={`${menuItemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </header>
  );
}

function Avatar({ photo, name, size = 'md' }: { photo: string | null; name: string; size?: 'md' | 'lg' }) {
  return (
    <div
      className={`${size === 'lg' ? 'w-10 h-10 text-base' : 'w-7 h-7 text-xs'} rounded-full shrink-0 overflow-hidden
                  bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold
                  flex items-center justify-center ring-2 ring-white dark:ring-gray-950`}
    >
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
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

  const highlight =
    tone === 'offline' && count > 0
      ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
      : 'text-gray-700 dark:text-gray-300';

  return (
    <div
      className={`flex items-center gap-1.5 h-full px-2.5 rounded-full text-xs ${highlight}`}
      title={`${count} ${label.toLowerCase()}`}
    >
      <span className="relative flex w-1.5 h-1.5 shrink-0">
        {tone === 'offline' && count > 0 && (
          <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />
        )}
        <span className={`relative w-1.5 h-1.5 rounded-full ${dot}`} />
      </span>
      <span className="font-semibold tabular-nums">{count}</span>
      <span className="hidden lg:inline text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}
