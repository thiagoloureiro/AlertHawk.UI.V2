import React, { useState, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppRoutes } from './routes';
import { Login } from './pages/Login';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { useMsal } from "@azure/msal-react";

interface UserInfo {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

function AppContent() {
  const { accounts } = useMsal();
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

  const location = useLocation();
  const isStatusPage = location.pathname.startsWith('/status');

  // Effect to check and fetch user info if needed
  useEffect(() => {
    const fetchUserInfo = async () => {
      const authToken = localStorage.getItem('authToken');
      const userInfo = localStorage.getItem('userInfo');
      
      if (authToken && !userInfo) {
        try {
          // Try to get email from MSAL first
          let email = accounts[0]?.username;
          
          if (!email) {
            // If no MSAL account, try to decode the JWT token to get the email
            try {
              const tokenData = JSON.parse(atob(authToken.split('.')[1]));
              email = tokenData.email || tokenData.unique_name || tokenData.preferred_username;
            } catch (e) {
              console.error('Failed to decode token:', e);
              return;
            }
          }

          if (email) {
            const response = await axios.get<UserInfo>(
              `${import.meta.env.VITE_APP_AUTH_API_URL}api/user/${email}`,
              {
                headers: {
                  Authorization: `Bearer ${authToken}`
                }
              }
            );
            localStorage.setItem('userInfo', JSON.stringify(response.data));
          }
        } catch (error) {
          console.error('Failed to fetch user info:', error);
        }
      }
    };

    if (isAuthenticated) {
      fetchUserInfo();
    }
  }, [isAuthenticated, accounts]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkTheme);
  }, [isDarkTheme]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  // If it's the status page, render without authentication or layout
  if (isStatusPage) {
    return (
      <div className={isDarkTheme ? 'dark' : ''}>
        <AppRoutes />
      </div>
    );
  }

  // For login page
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // For protected routes
  return (
    <div className={isDarkTheme ? 'dark' : ''}>
      <Layout isDarkTheme={isDarkTheme} onThemeToggle={() => setIsDarkTheme(!isDarkTheme)}>
        <AppRoutes />
      </Layout>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white'
        }}
      />
    </BrowserRouter>
  );
}