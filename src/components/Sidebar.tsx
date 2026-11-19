import React from 'react';
import { PanelLeftClose, PanelLeftOpen, QrCode } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn, isMetricsEnabled, isQrCodeEnabled } from '../lib/utils';
import { MobileAppQrDialog } from './MobileAppQrDialog';
import {
  ADMIN_ITEMS,
  METRICS_ITEMS,
  MONITORING_ITEMS,
  SETTINGS_ITEM,
  type NavItem,
  type NavSection,
} from './navigation';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const itemClass = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    'group relative flex items-center h-9 rounded-lg text-[13px] font-medium transition-colors',
    isCollapsed ? 'justify-center w-10 mx-auto' : 'gap-3 px-2.5 w-full',
    isActive
      ? 'bg-gray-100 text-gray-900 dark:bg-white/[0.07] dark:text-white'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100'
  );

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const [qrDialogOpen, setQrDialogOpen] = React.useState(false);

  const userInfo = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('userInfo');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const sections = React.useMemo((): NavSection[] => {
    const result: NavSection[] = [
      { id: 'monitoring', label: 'Monitoring', items: MONITORING_ITEMS },
    ];

    if (isMetricsEnabled()) {
      result.push({ id: 'metrics', label: 'Metrics', items: METRICS_ITEMS });
    }

    if (userInfo?.isAdmin) {
      result.push({ id: 'admin', label: 'Admin', items: ADMIN_ITEMS });
    }

    return result;
  }, [userInfo]);

  const footerItems = React.useMemo((): NavItem[] => {
    const items: NavItem[] = [];
    if (isQrCodeEnabled()) {
      items.push({
        id: 'qr-mobile',
        name: 'Mobile app',
        icon: QrCode,
        path: '#',
        action: 'qr',
      });
    }
    items.push(SETTINGS_ITEM);
    return items;
  }, []);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;

    if (item.action === 'qr') {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => setQrDialogOpen(true)}
          title={item.name}
          aria-label="Install mobile app"
          className={itemClass(false, isCollapsed)}
        >
          <Icon className="w-[18px] h-[18px] shrink-0 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300" />
          {!isCollapsed && <span className="truncate">{item.name}</span>}
        </button>
      );
    }

    return (
      <NavLink
        key={item.id}
        to={item.path}
        title={isCollapsed ? item.name : undefined}
        className={({ isActive }) => itemClass(isActive, isCollapsed)}
      >
        {({ isActive }) => (
          <>
            {isActive && !isCollapsed && (
              <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-blue-500" />
            )}
            <Icon
              className={cn(
                'w-[18px] h-[18px] shrink-0 transition-colors',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
              )}
            />
            {!isCollapsed && <span className="truncate">{item.name}</span>}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full shrink-0 border-r border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-gray-950 text-gray-900 dark:text-white',
        'transition-[width] duration-200 ease-out',
        isCollapsed ? 'w-[64px]' : 'w-[244px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex-none h-14 flex items-center border-b border-gray-200 dark:border-gray-800',
          isCollapsed ? 'justify-center' : 'gap-2.5 px-4'
        )}
      >
        <div className="w-8 h-8 shrink-0 rounded-lg bg-gray-900 dark:bg-white/[0.06] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
          <img src="/assets/logo.png" alt="AlertHawk" className="w-6 h-6 object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">
              AlertHawk
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Monitoring platform
            </div>
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">
        {sections.map((section, index) => (
          <div key={section.id}>
            {!isCollapsed && (
              <div className="px-2.5 mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                {section.label}
              </div>
            )}
            {isCollapsed && index > 0 && (
              <div className="mx-2 mb-3 border-t border-gray-200 dark:border-gray-800" />
            )}
            <div className="space-y-0.5">{section.items.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>

      {/* Footer nav */}
      <div className="flex-none border-t border-gray-200 dark:border-gray-800 p-3 space-y-0.5">
        {footerItems.map(renderNavItem)}
        <button
          type="button"
          onClick={toggleSidebar}
          className={itemClass(false, isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : undefined}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px] shrink-0 text-gray-400 dark:text-gray-500" />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px] shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>

      {isQrCodeEnabled() && (
        <MobileAppQrDialog isOpen={qrDialogOpen} onClose={() => setQrDialogOpen(false)} />
      )}
    </aside>
  );
}
