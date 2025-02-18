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
  ChevronRight
} from 'lucide-react';
import { MenuItem } from '../types';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems: MenuItem[] = [
  { id: '1', name: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  { id: '2', name: 'Monitor Agents', icon: 'Monitor', path: '/agents' },
  { id: '3', name: 'Monitor Alert', icon: 'Bell', path: '/alerts' },
  { id: '5', name: 'Notification Management', icon: 'MessageSquare', path: '/notifications' },
  { id: '6', name: 'Monitor Groups', icon: 'Users', path: '/groups' },
  { id: '7', name: 'User Management', icon: 'UserCircle', path: '/users' },
  { id: '8', name: 'Administration', icon: 'Bell', path: '/admin' },
  { id: 'settings', name: 'Settings', icon: 'Settings', path: '/settings' },
];

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Monitor,
  Bell,
  LineChart,
  MessageSquare,
  Users,
  UserCircle,
  Settings,
};

export function Sidebar({ isCollapsed, toggleSidebar, currentPage, onNavigate }: SidebarProps) {
  return (
    <div 
      className={`bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col
        ${isCollapsed ? 'w-[60px]' : 'w-[250px]'}`}
    >
      <div className="flex-none p-4">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 hover:bg-gray-800 rounded-lg transition-colors"
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
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 mx-3 px-3 py-3 rounded-lg transition-colors",
                isActive ? "bg-gray-800" : "hover:bg-gray-800"
              )}
            >
              <Icon className="w-5 h-5 flex-none" />
              {!isCollapsed && (
                <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.name}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}