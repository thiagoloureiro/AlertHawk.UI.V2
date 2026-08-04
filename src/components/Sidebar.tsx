import React from 'react';
import {
  LayoutDashboard,
  Monitor,
  Bell,
  LineChart,
  MessageSquare,
  Users,
  UserCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  Package,
  Network,
  Activity,
  DollarSign,
  HardDrive,
  QrCode,
  Wrench,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn, isMetricsEnabled, isQrCodeEnabled } from '../lib/utils';
import { MobileAppQrDialog } from './MobileAppQrDialog';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

type NavItem = {
  id: string;
  name: string;
  icon: React.ElementType;
  path: string;
  action?: 'qr';
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const MONITORING_ITEMS: NavItem[] = [
  { id: '1', name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: '2', name: 'Dashboard builder', icon: BarChart3, path: '/dashboard-builder' },
  { id: '9', name: 'Groups', icon: Users, path: '/groups' },
  { id: '5', name: 'Agents', icon: Monitor, path: '/agents' },
  { id: '6', name: 'Alerts', icon: Bell, path: '/alerts' },
  { id: '7', name: 'SSL certificates', icon: Shield, path: '/ssl-certificates' },
  { id: '8', name: 'Notifications', icon: MessageSquare, path: '/notifications' },
];

const METRICS_ITEMS: NavItem[] = [
  { id: '3', name: 'Cluster metrics', icon: LineChart, path: '/metrics' },
  { id: '4', name: 'Application metrics', icon: Package, path: '/application-metrics' },
  { id: '15', name: 'Volume metrics', icon: HardDrive, path: '/volume-metrics' },
  { id: '12', name: 'Clusters diagram', icon: Network, path: '/clusters-diagram' },
  { id: '13', name: 'Cluster events', icon: Activity, path: '/cluster-events' },
  { id: '16', name: 'FinOps', icon: DollarSign, path: '/finops-metrics' },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: '10', name: 'Users', icon: UserCircle, path: '/users' },
  { id: '11', name: 'Administration', icon: Wrench, path: '/admin' },
];

const itemButtonClass = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    'group relative flex items-center rounded-md text-[13px] font-medium transition-colors',
    isCollapsed ? 'justify-center px-0 py-2 mx-auto w-10' : 'gap-2.5 px-2.5 py-2 w-full',
    isActive
      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100'
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
    items.push({
      id: 'settings',
      name: 'Settings',
      icon: Settings,
      path: '/settings',
    });
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
          className={itemButtonClass(false, isCollapsed)}
        >
          <Icon className="w-4 h-4 shrink-0 opacity-80" />
          {!isCollapsed && (
            <span className="truncate">{item.name}</span>
          )}
        </button>
      );
    }

    return (
      <NavLink
        key={item.id}
        to={item.path}
        title={item.name}
        className={({ isActive }) => itemButtonClass(isActive, isCollapsed)}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-blue-500"
                aria-hidden
              />
            )}
            <Icon
              className={cn(
                'w-4 h-4 shrink-0',
                isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
              )}
            />
            {!isCollapsed && (
              <span className="truncate">{item.name}</span>
            )}
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
        isCollapsed ? 'w-[56px]' : 'w-[220px]'
      )}
    >
      {/* Collapse control */}
      <div
        className={cn(
          'flex-none border-b border-gray-200 dark:border-gray-800',
          isCollapsed ? 'px-1.5 py-2' : 'px-2.5 py-2'
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex items-center rounded-md text-gray-500 dark:text-gray-400',
            'hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-800 dark:hover:text-gray-200',
            'transition-colors',
            isCollapsed ? 'justify-center w-10 h-9 mx-auto' : 'w-full gap-2 px-2.5 py-1.5'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5 space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            {!isCollapsed && (
              <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {section.label}
              </div>
            )}
            {isCollapsed && section.id !== sections[0]?.id && (
              <div className="mx-2 mb-1.5 border-t border-gray-100 dark:border-gray-900" />
            )}
            <div className="space-y-0.5">
              {section.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer nav */}
      {footerItems.length > 0 && (
        <div
          className={cn(
            'flex-none border-t border-gray-200 dark:border-gray-800 py-2 space-y-0.5',
            isCollapsed ? 'px-1.5' : 'px-1.5'
          )}
        >
          {footerItems.map(renderNavItem)}
        </div>
      )}

      {isQrCodeEnabled() && (
        <MobileAppQrDialog isOpen={qrDialogOpen} onClose={() => setQrDialogOpen(false)} />
      )}
    </aside>
  );
}
