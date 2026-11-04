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
    `w-full bg-transparent border px-3 py-2.5 text-sm outline-none transition-colors
     text-gray-900 dark:text-[#f2f1ee] placeholder:text-gray-400
     ${invalid
       ? 'border-red-500 focus:border-red-500'
       : 'border-gray-300 dark:border-white/20 focus:border-gray-900 dark:focus:border-[#f2f1ee]'}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-[#f2f1ee]">
      <header className="h-12 border-b border-gray-200 dark:border-white/15 flex items-center px-4 sm:px-5">
        <img src="/assets/logo.png" alt="" className="h-7 w-7 object-contain" />
        <span className="font-display ml-2.5 text-[1.35rem] leading-none">AlertHawk</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md border border-gray-200 dark:border-white/15 bg-white dark:bg-[#101014]">
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-white/15 px-6 py-3">
            <p className="hud-label text-gray-500 dark:text-gray-400">Sign in</p>
            <p className="hud-label text-gray-400 dark:text-gray-500">01 / Access</p>
          </div>

          <div className="px-6 py-8 md:px-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <img
                src="/assets/logo.png"
                alt=""
                className="h-28 w-28 object-contain"
              />
              <h1 className="font-display mt-4 text-4xl leading-none text-gray-900 dark:text-[#f2f1ee]">
                AlertHawk
              </h1>
            </div>
            <p className="font-display text-2xl leading-[1.05] text-gray-900 dark:text-[#f2f1ee]">
              Keep an eye <span className="font-serif italic font-normal text-gray-500 dark:text-gray-400">on it.</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Self-hosted monitoring for uptime, alerts, and infrastructure metrics.
            </p>

            {error?.field === 'general' && (
              <div className="mt-5 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-200 px-3 py-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error.message}</span>
              </div>
            )}

            <form onSubmit={handleStandardLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="hud-label text-gray-500 dark:text-gray-400">
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
                <label htmlFor="password" className="hud-label text-gray-500 dark:text-gray-400">
                  Password
                </label>
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-900 dark:hover:text-[#f2f1ee]"
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
                className="hud-label !font-bold w-full h-12 bg-[#101014] text-[#f2f1ee] dark:bg-[#f2f1ee] dark:text-[#101014]
                         hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity
                         flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="text-gray-600 dark:text-gray-400 underline decoration-gray-300 dark:decoration-white/30 underline-offset-4 hover:text-gray-900 dark:hover:text-[#f2f1ee]"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-gray-600 dark:text-gray-400 underline decoration-gray-300 dark:decoration-white/30 underline-offset-4 hover:text-gray-900 dark:hover:text-[#f2f1ee]"
              >
                Forgot password
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-white/15" />
              </div>
              <div className="relative flex justify-center">
                <span className="hud-label bg-white dark:bg-[#101014] px-3 text-gray-400">
                  Or
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="hud-label !font-bold w-full h-12 border border-gray-900 dark:border-[#f2f1ee] bg-transparent
                       text-gray-900 dark:text-[#f2f1ee] hover:bg-[#101014] hover:text-[#f2f1ee]
                       dark:hover:bg-[#f2f1ee] dark:hover:text-[#101014]
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       flex items-center justify-center gap-2.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                    <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                    <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                    <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                  </svg>
                  <span>Microsoft SSO</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-white/15 px-5 py-3 flex items-center justify-between">
        <p className="hud-label text-gray-400">AlertHawk</p>
        <p className="hud-label text-gray-400">Monitoring</p>
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