import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppRoutes } from './routes';
import { Login } from './pages/Login';
import { Toaster } from 'react-hot-toast';

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

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className={`${isDarkTheme ? 'dark' : ''}`}>
        <Layout isDarkTheme={isDarkTheme} onThemeToggle={() => setIsDarkTheme(!isDarkTheme)}>
          <AppRoutes />
        </Layout>
      </div>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white'
        }}
      />
    </BrowserRouter>
  );
}