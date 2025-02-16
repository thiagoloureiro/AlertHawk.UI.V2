import React from 'react';
import { Bell, Settings, User, Sun, Moon } from 'lucide-react';

interface TopBarProps {
  toggleSidebar: () => void;
  isDarkTheme: boolean;
  toggleTheme: () => void;
}

export function TopBar({ isDarkTheme, toggleTheme }: TopBarProps) {
  return (
    <div className={`h-16 ${isDarkTheme ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} flex items-center justify-between px-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <img 
          src="../assets/logo.png" 
          alt="AlertHawk Logo" 
          className="w-8 h-8 object-contain"
        />
        <span className="text-3xl font-semibold">AlertHawk</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDarkTheme 
              ? 'hover:bg-gray-800 text-yellow-400 hover:text-yellow-300' 
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
          aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDarkTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
          <Bell className="w-5 h-5" />
        </button>
        <button className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
          <Settings className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-4">
          <User className={`w-8 h-8 p-1 rounded-full ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`} />
          <span className="text-sm">Admin</span>
        </div>
      </div>
    </div>
  );
}