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
  Network
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
  { id: '12', name: 'Clusters Diagram', icon: 'Network', path: '/clusters-diagram' },
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
  Network,
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
      const metricsItemIds = ['3', '4', '12']; // Cluster Metrics, Application Metrics, Clusters Diagram
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
      className={`bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out flex flex-col
        ${isCollapsed ? 'w-[60px]' : 'w-[250px]'}`}
    >
      <div className="flex-none p-4">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-white"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isNew = item.id === '3' || item.id === '4' || item.id === '12'; // Cluster Metrics, Application Metrics, and Clusters Diagram
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 mx-3 px-3 py-3 rounded-lg transition-colors text-gray-700 dark:text-white relative",
                isActive 
                  ? "bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-white" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="relative flex-none">
                <Icon className="w-5 h-5" />
                {isNew && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.name}
                  </span>
                  {isNew && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded flex-shrink-0">
                      NEW
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}