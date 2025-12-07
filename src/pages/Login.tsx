import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2, Mail, Lock, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 dark:bg-gray-900 bg-gradient-to-br from-gray-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 transition-colors duration-500 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#5CD4E2]/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Login Card with Glassmorphism */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-6 md:p-8 transform transition-all duration-500 hover:shadow-3xl">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-6 animate-fade-in">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-[#5CD4E2]/20 rounded-full blur-xl animate-pulse"></div>
              <img 
                src="../assets/logo.png" 
                alt="AlertHawk Logo" 
                className="w-20 h-20 md:w-24 md:h-24 object-contain relative z-10 transform transition-transform duration-300 hover:scale-110"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold dark:text-white text-gray-900 mb-1 bg-gradient-to-r from-[#5CD4E2] to-blue-600 bg-clip-text text-transparent">
              AlertHawk
            </h1>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#5CD4E2] animate-pulse" />
              <p className="text-base md:text-lg dark:text-gray-300 text-gray-700 font-medium">
                Keep an eye on your infrastructure
              </p>
            </div>
            <p className="text-xs dark:text-gray-400 text-gray-600 text-center max-w-sm leading-relaxed">
              AlertHawk is a self-hosted monitoring tool that allows you keep track of service uptime, alerts, infrastructure metrics and more.
            </p>
          </div>

          {/* Error Message */}
          {error?.field === 'general' && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 flex items-center gap-2 animate-slide-down shadow-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{error.message}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleStandardLogin} className="space-y-4 mb-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold dark:text-gray-300 text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-12 pr-4 py-2.5 rounded-xl dark:bg-gray-700/50 bg-white/90 border-2 
                           ${error?.field === 'email' 
                             ? 'border-red-500 dark:border-red-500 focus:border-red-500' 
                             : 'dark:border-gray-600 border-gray-200 focus:border-[#5CD4E2]'} 
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-[#5CD4E2]/20 
                           dark:focus:ring-[#5CD4E2]/30 transition-all duration-200 outline-none
                           placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              {error?.field === 'email' && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-slide-down">
                  <AlertCircle className="w-4 h-4" />
                  {error.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold dark:text-gray-300 text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-2.5 rounded-xl dark:bg-gray-700/50 bg-white/90 border-2 
                           ${error?.field === 'password' 
                             ? 'border-red-500 dark:border-red-500 focus:border-red-500' 
                             : 'dark:border-gray-600 border-gray-200 focus:border-[#5CD4E2]'} 
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-[#5CD4E2]/20 
                           dark:focus:ring-[#5CD4E2]/30 transition-all duration-200 outline-none
                           placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 dark:text-gray-400 text-gray-500 
                           hover:text-[#5CD4E2] dark:hover:text-[#5CD4E2] transition-colors duration-200 
                           p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error?.field === 'password' && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-slide-down">
                  <AlertCircle className="w-4 h-4" />
                  {error.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 
                       hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base
                       focus:ring-4 focus:ring-blue-500/30 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 
                       transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl
                       flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 text-sm gap-2">
            <span className="dark:text-gray-400 text-gray-600">
              Don't have an account?{' '}
              <button 
                onClick={() => setShowRegister(true)} 
                className="text-[#5CD4E2] hover:text-[#4BC3D1] font-semibold hover:underline transition-colors duration-200"
              >
                Register
              </button>
            </span>
            <button 
              onClick={() => setShowForgotPassword(true)}
              className="text-[#5CD4E2] hover:text-[#4BC3D1] font-semibold hover:underline transition-colors duration-200"
            >
              Forgot Password?
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t dark:border-gray-700 border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 dark:bg-gray-800/80 bg-white/80 dark:text-gray-400 text-gray-500 font-medium">
                Or continue with
              </span>
            </div>
          </div>

          {/* Microsoft Login Button */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
            className="w-full px-6 py-2.5 rounded-xl bg-[#2F2F2F] hover:bg-[#404040] text-white font-semibold
                     flex items-center justify-center gap-3 focus:ring-4 focus:ring-[#2F2F2F]/30 
                     focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 
                     disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] 
                     active:scale-[0.98] shadow-lg hover:shadow-xl border border-gray-600/50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                </svg>
                <span>Login with SSO (Microsoft)</span>
              </>
            )}
          </button>

          {/* Footer */}
          <p className="text-center mt-5 text-xs dark:text-gray-500 text-gray-500">
            AlertHawk © 2025
          </p>
        </div>
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

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        
        .delay-1000 {
          animation-delay: 1s;
        }
        
        .delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}