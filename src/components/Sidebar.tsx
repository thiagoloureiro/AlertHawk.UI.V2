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
  HardDrive
} from 'lucide-react';
import { MenuItem } from '../types';
import { NavLink } from 'react-router-dom';
import { cn, isMetricsEnabled } from '../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

// Add base menu items that are always shown
const baseMenuItems: MenuItem[] = [
  { id: '1', name: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  { id: '2', name: 'Dashboard Builder', icon: 'BarChart3', path: '/dashboard-builder' },
  { id: '3', name: 'Cluster Metrics', icon: 'LineChart', path: '/metrics' },
  { id: '4', name: 'Application Metrics', icon: 'Package', path: '/application-metrics' },
  { id: '15', name: 'Volume Metrics', icon: 'HardDrive', path: '/volume-metrics' },
  { id: '12', name: 'Clusters Diagram', icon: 'Network', path: '/clusters-diagram' },
  { id: '13', name: 'Cluster Events', icon: 'Activity', path: '/cluster-events' },
  { id: '14', name: 'Cluster Prices', icon: 'DollarSign', path: '/cluster-prices' },
  { id: '5', name: 'Monitor Agents', icon: 'Monitor', path: '/agents' },
  { id: '6', name: 'Monitor Alert', icon: 'Bell', path: '/alerts' },
  { id: '7', name: 'SSL Certificate Monitor', icon: 'Shield', path: '/ssl-certificates' },
  { id: '8', name: 'Notification Management', icon: 'MessageSquare', path: '/notifications' },
  { id: '9', name: 'Monitor Groups', icon: 'Users', path: '/groups' },
];

// Add admin-only menu items
const adminMenuItems: MenuItem[] = [
  { id: '10', name: 'User Management', icon: 'UserCircle', path: '/users' },
  { id: '11', name: 'Administration', icon: 'Bell', path: '/admin' },
];

// Settings is shown to all users
const settingsMenuItem: MenuItem = 
  { id: 'settings', name: 'Settings', icon: 'Settings', path: '/settings' };

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  BarChart3,
  Monitor,
  Bell,
  LineChart,
  MessageSquare,
  Users,
  UserCircle,
  Settings,
  Shield,
  Package,
  HardDrive,
  Network,
  Activity,
  DollarSign,
};

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  // Get user info from localStorage
  const userInfo = React.useMemo(() => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  }, []);

  // Combine menu items based on user role and metrics enabled
  const menuItems = React.useMemo(() => {
    let items = [...baseMenuItems];
    
    // Filter out metrics-related items if metrics are disabled
    if (!isMetricsEnabled()) {
      const metricsItemIds = ['3', '4', '15', '12', '13', '14']; // Cluster Metrics, Application Metrics, Volume Metrics, Clusters Diagram, Cluster Events, Cluster Prices
      items = items.filter(item => !metricsItemIds.includes(item.id));
    }
    
    if (userInfo?.isAdmin) {
      items.push(...adminMenuItems);
    }
    items.push(settingsMenuItem);
    return items;
  }, [userInfo]);

  return (
    <div 
      className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm text-gray-900 dark:text-white border-r border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col shadow-sm
        ${isCollapsed ? 'w-[70px]' : 'w-[260px]'}`}
    >
      <div className="flex-none p-4 border-b border-gray-200/50 dark:border-gray-800/50">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-xl transition-all duration-200 text-gray-700 dark:text-white hover:scale-105 active:scale-95"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isNew = item.id === '3' || item.id === '4' || item.id === '15' || item.id === '12' || item.id === '13' || item.id === '14'; // Cluster Metrics, Application Metrics, Volume Metrics, Clusters Diagram, Cluster Events, and Cluster Prices
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => {
                return cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-gray-700 dark:text-white relative group",
                  isActive 
                    ? "bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/30" 
                    : "hover:bg-gray-100/80 dark:hover:bg-gray-800/50 hover:translate-x-1"
                );
              }}
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex-none">
                    <Icon className={cn(
                      "w-5 h-5 transition-transform duration-200",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    {isNew && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={cn(
                        "text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis",
                        isActive && "font-semibold"
                      )}>
                        {item.name}
                      </span>
                      {isNew && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md flex-shrink-0 shadow-sm">
                          NEW
                        </span>
                      )}
                    </div>
                  )}
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full"></div>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}