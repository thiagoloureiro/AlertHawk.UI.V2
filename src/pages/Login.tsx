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

  const fieldClass = (invalid: boolean) =>
    `w-full h-10 rounded-lg border px-3 text-sm outline-none transition-shadow shadow-xs
     bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500
     disabled:opacity-60
     ${invalid
       ? 'border-red-400 focus:ring-4 focus:ring-red-500/15'
       : 'border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15'}`;

  const linkButtonClass =
    'font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors';

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-blue-500/15 dark:bg-blue-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(152 162 179 / 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgb(152 162 179 / 0.25) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 dark:bg-white/[0.06] shadow-lg ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
              <img src="/assets/logo.png" alt="AlertHawk" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to AlertHawk</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Uptime, alerts, and infrastructure metrics in one place.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xl shadow-gray-900/[0.04] dark:shadow-black/30 backdrop-blur p-6 sm:p-7">
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-white/[0.03]
                       text-sm font-medium text-gray-800 dark:text-gray-100 shadow-xs
                       hover:bg-gray-50 dark:hover:bg-white/[0.06]
                       disabled:opacity-60 disabled:cursor-not-allowed transition-colors
                       flex items-center justify-center gap-2.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                </svg>
              )}
              Continue with Microsoft
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs text-gray-400 dark:text-gray-500">or continue with email</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>

            {error?.field === 'general' && (
              <div className="mb-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-3 py-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error.message}</span>
              </div>
            )}

            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass(error?.field === 'email')}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
                {error?.field === 'email' && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {error.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className={`text-xs ${linkButtonClass}`}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass(error?.field === 'password')} pr-10`}
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error?.field === 'password' && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {error.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                         shadow-sm ring-1 ring-inset ring-white/10
                         disabled:opacity-60 disabled:cursor-not-allowed transition-colors
                         flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              Create one
            </button>
          </p>
        </div>
      </main>

      <footer className="relative px-6 py-5 text-center text-xs text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} AlertHawk · Self-hosted monitoring
      </footer>

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onLogin={onLogin}
        />
      )}

      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
}