import { useState, useEffect } from 'react';
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
  const [isSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'darcula' | 'monokai'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'darcula' || saved === 'monokai') {
      return saved;
    }
    return 'dark'; // default to dark theme
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
    localStorage.setItem('theme', theme);
    // Remove all theme classes
    document.documentElement.classList.remove('dark', 'darcula', 'monokai');
    // Add the current theme class (except for light which has no class)
    if (theme !== 'light') {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  // If it's the status page, render without authentication or layout
  if (isStatusPage) {
    return (
      <div className={theme !== 'light' ? theme : ''}>
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
    <div className={theme !== 'light' ? theme : ''}>
      <Layout theme={theme} onThemeChange={setTheme}>
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