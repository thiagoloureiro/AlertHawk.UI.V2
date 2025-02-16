import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { MetricsList } from './components/MetricsList';
import { MetricDetails } from './components/MetricDetails';
import { MonitorAlerts } from './pages/MonitorAlerts';
import { UserManagement } from './pages/UserManagement';
import { MonitorGroups } from './pages/MonitorGroups';
import { MonitorAgents } from './pages/MonitorAgents';
import { Administration } from './pages/Administration';
import { NotificationManagement } from './pages/NotificationManagement';
import { Login } from './pages/Login';
import { Monitor } from './types';
import { Settings } from './pages/Settings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('authToken') !== null;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
    return true; // default to dark theme
  });

  const [selectedMetric, setSelectedMetric] = useState<Monitor | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkTheme);
  }, [isDarkTheme]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`flex h-screen ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={toggleSidebar}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          toggleSidebar={toggleSidebar} 
          isDarkTheme={isDarkTheme}
          toggleTheme={toggleTheme}
        />
        
        {currentPage === 'dashboard' ? (
          <div className="flex-1 flex overflow-hidden">
            <div className={`w-[30%] border-r ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
              <MetricsList
                selectedMetric={selectedMetric}
                onSelectMetric={setSelectedMetric}
              />
            </div>
            
            <div className="flex-1">
              {selectedMetric ? (
                <MetricDetails metric={selectedMetric} />
              ) : (
                <div className={`h-full flex items-center justify-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                  Select a metric to view details
                </div>
              )}
            </div>
          </div>
        ) : currentPage === 'alerts' ? (
          <div className="flex-1 h-full overflow-hidden">
            <MonitorAlerts />
          </div>
        ) : currentPage === 'users' ? (
          <UserManagement />
        ) : currentPage === 'groups' ? (
          <MonitorGroups />
        ) : currentPage === 'agents' ? (
          <MonitorAgents />
        ) : currentPage === 'admin' ? (
          <Administration />
        ) : currentPage === 'notifications' ? (
          <NotificationManagement />
        ) : currentPage === 'settings' ? (
          <div className="flex-1 h-full overflow-hidden">
            <Settings />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center dark:text-gray-400 text-gray-500">
            Page under construction
          </div>
        )}
      </div>
    </div>
  );
}