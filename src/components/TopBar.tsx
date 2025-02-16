import React, { useState } from 'react';
import { Bell, Sun, Moon, User, LogOut } from 'lucide-react';
import { useMsal } from "@azure/msal-react";

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

export function TopBar({ isDarkTheme, onThemeToggle }: TopBarProps) {
  const { accounts, instance } = useMsal();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const userInfo: UserInfo | null = (() => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  })();

  const displayName = userInfo?.username || accounts[0]?.name || 'User';
  const email = userInfo?.email || accounts[0]?.username || '';

  const handleLogout = async () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    await instance.logoutRedirect();
  };

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
        <span className="text-xl font-semibold dark:text-white text-gray-900">
          AlertHawk
        </span>
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
        
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* User Menu */}
        <div 
          className="relative"
          onMouseEnter={() => setShowUserMenu(true)}
          onMouseLeave={() => setShowUserMenu(false)}
        >
          <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white">
              {displayName.charAt(0).toUpperCase()}
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

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 border-gray-200">
              {userInfo?.isAdmin && (
                <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                  Administrator
                </div>
              )}
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
    </div>
  );
}