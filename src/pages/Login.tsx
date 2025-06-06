import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from '../auth/msalConfig';
import axios from 'axios';
import { RegisterModal } from '../components/RegisterModal';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';

interface LoginProps {
  onLogin: () => void;
}

interface LoginError {
  field: 'email' | 'password' | 'general';
  message: string;
}

interface LoginResponse {
  token: string;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export function Login({ onLogin }: LoginProps) {
  const { instance } = useMsal();
  const [isMsalInitialized, setIsMsalInitialized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Initialize MSAL
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        await instance.initialize();
        setIsMsalInitialized(true);
      } catch (error) {
        console.error('Failed to initialize MSAL:', error);
        setError({
          field: 'general',
          message: 'Failed to initialize Microsoft authentication'
        });
      }
    };

    initializeMsal();
  }, [instance]);

  // Handle redirect after initialization
  useEffect(() => {
    const handleRedirect = async () => {
      if (!isMsalInitialized) {
        return;
      }

      try {
        const response = await instance.handleRedirectPromise();
        if (response) {
          // Store MSAL token
          localStorage.setItem('authToken', response.accessToken);

          // Get user email from MSAL account
          const userEmail = response.account?.username;
          
          if (userEmail) {
            try {
              // Fetch user info from your API
              const userResponse = await axios.get<UserInfo>(
                `${import.meta.env.VITE_APP_AUTH_API_URL}api/user/${userEmail}`,
                {
                  headers: {
                    Authorization: `Bearer ${response.accessToken}`
                  }
                }
              );

              // Store user info in localStorage
              localStorage.setItem('userInfo', JSON.stringify(userResponse.data));
              
              // Complete login
              onLogin();
            } catch (error) {
              console.error('Error fetching user info:', error);
              setError({
                field: 'general',
                message: 'Failed to fetch user information'
              });
            }
          } else {
            setError({
              field: 'general',
              message: 'No email found in Microsoft account'
            });
          }
        }
      } catch (err) {
        console.error('Error handling redirect:', err);
        setError({
          field: 'general',
          message: 'Failed to complete Microsoft authentication'
        });
      }
    };

    handleRedirect();
  }, [instance, isMsalInitialized, onLogin]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setError(null);

    // Validate email
    if (!email) {
      setError({ field: 'email', message: 'Email is required' });
      return;
    }
    if (!validateEmail(email)) {
      setError({ field: 'email', message: 'Please enter a valid email address' });
      return;
    }

    // Validate password
    if (!password) {
      setError({ field: 'password', message: 'Password is required' });
      return;
    }
    if (password.length < 8) {
      setError({ field: 'password', message: 'Password must be at least 8 characters' });
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post<LoginResponse>(
        `${import.meta.env.VITE_APP_AUTH_API_URL}api/auth/login`,
        {
          username: email,
          password: password
        }
      );
      
      // Store the token in localStorage
      localStorage.setItem('authToken', response.data.token);

      try {
        // Fetch user info using the new token
        const userResponse = await axios.get<UserInfo>(
          `${import.meta.env.VITE_APP_AUTH_API_URL}api/user/${email}`,
          {
            headers: {
              Authorization: `Bearer ${response.data.token}`
            }
          }
        );

        // Store user info in localStorage
        localStorage.setItem('userInfo', JSON.stringify(userResponse.data));
      } catch (error) {
        console.error('Error fetching user info:', error);
        // Even if user info fetch fails, we can still proceed with login
        // The httpClient interceptor will handle re-fetching user info later
      }
      
      // Handle successful login
      onLogin();
    } catch (err) {
      setError({ field: 'general', message: 'Invalid email or password' });
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!isMsalInitialized) {
      setError({
        field: 'general',
        message: 'Microsoft authentication is not ready yet'
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Initiate login redirect
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error('Microsoft login error:', err);
      setError({
        field: 'general',
        message: 'Failed to start Microsoft authentication'
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="../assets/logo.png" 
            alt="AlertHawk Logo" 
            className="w-32 h-32 mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold dark:text-white text-gray-900 mb-2">AlertHawk</h1>
          <p className="text-xl dark:text-gray-400 text-gray-600 mb-2">Keep an eye on your infrastructure</p>
          <p className="text-sm dark:text-gray-400 text-gray-600 text-center max-w-sm">
            AlertHawk is a self-hosted monitoring tool that allows you keep track of service uptime
          </p>
        </div>

        {/* Error Message */}
        {error?.field === 'general' && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error.message}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleStandardLogin} className="space-y-4 mb-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       ${error?.field === 'email' 
                         ? 'border-red-500 dark:border-red-500' 
                         : 'dark:border-gray-700 border-gray-300'} 
                       dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                       dark:focus:ring-blue-400 transition-colors duration-200`}
              placeholder="Enter your email"
              disabled={isLoading}
            />
            {error?.field === 'email' && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                         ${error?.field === 'password' 
                           ? 'border-red-500 dark:border-red-500' 
                           : 'dark:border-gray-700 border-gray-300'} 
                         dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                         dark:focus:ring-blue-400 transition-colors duration-200`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 dark:text-gray-400 text-gray-500 hover:text-gray-700 
                         dark:hover:text-gray-300 transition-colors duration-200"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error?.field === 'password' && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg bg-[#5CD4E2] hover:bg-[#4BC3D1] text-white font-medium
                     focus:ring-2 focus:ring-[#5CD4E2] focus:ring-offset-2 dark:focus:ring-offset-gray-900
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              'Next Step'
            )}
          </button>
        </form>

        {/* Links */}
        <div className="flex items-center justify-between mb-6 text-sm">
          <span className="dark:text-gray-400 text-gray-600">
            Not have an account yet?{' '}
            <button 
              onClick={() => setShowRegister(true)} 
              className="text-[#5CD4E2] hover:underline"
            >
              Register
            </button>
          </span>
          <button 
            onClick={() => setShowForgotPassword(true)}
            className="text-[#5CD4E2] hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t dark:border-gray-700 border-gray-300"></div>
          </div>
        </div>

        {/* Microsoft Login Button */}
        <button
          onClick={handleMicrosoftLogin}
          disabled={isLoading}
          className="w-full px-4 py-2 rounded-lg bg-[#2F2F2F] hover:bg-[#404040] text-white font-medium
                   flex items-center justify-center gap-2 focus:ring-2 focus:ring-[#2F2F2F] 
                   focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 
                   disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
              </svg>
              Log in with Microsoft Account
            </>
          )}
        </button>

        {/* Footer */}
        <p className="text-center mt-8 text-sm dark:text-gray-400 text-gray-600">
          AlertHawk © 2025
        </p>
      </div>

      {/* Add the RegisterModal */}
      {showRegister && (
        <RegisterModal 
          onClose={() => setShowRegister(false)} 
          onLogin={onLogin}
        />
      )}

      {/* Add the ForgotPasswordModal */}
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
}