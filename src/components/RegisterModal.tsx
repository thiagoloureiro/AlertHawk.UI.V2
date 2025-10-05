import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { authHttp } from '../services/httpClient';
import { toast } from 'react-hot-toast';

interface RegisterModalProps {
  onClose: () => void;
  onLogin: () => void;
}

interface RegisterError {
  field: 'email' | 'username' | 'password' | 'repeatPassword' | 'general';
  message: string;
}

interface LoginResponse {
  token: string;
}

export function RegisterModal({ onClose, onLogin }: RegisterModalProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<RegisterError | null>(null);

  const validateForm = () => {
    if (!email) {
      setError({ field: 'email', message: 'Email is required' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ field: 'email', message: 'Please enter a valid email address' });
      return false;
    }
    if (!username) {
      setError({ field: 'username', message: 'Name is required' });
      return false;
    }
    if (password.length < 8) {
      setError({ field: 'password', message: 'Password must be at least 8 characters' });
      return false;
    }
    if (password !== repeatPassword) {
      setError({ field: 'repeatPassword', message: 'Passwords do not match' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    try {
      setIsLoading(true);
      
      // Register the user
      await authHttp.post('/api/user/create', {
        userEmail: email,
        username,
        password,
        repeatPassword
      });

      // After successful registration, attempt to login
      const loginResponse = await authHttp.post<LoginResponse>('/api/auth/login', {
        username: email,
        password: password
      });

      // Store the token
      localStorage.setItem('authToken', loginResponse.data.token);

      // Get user info using the new token
      const userResponse = await authHttp.get(`/api/user/${email}`);

      // Store user info
      localStorage.setItem('userInfo', JSON.stringify(userResponse.data));

      toast.success('Registration successful!', { position: 'bottom-right' });
      
      // Call the login callback instead of reloading
      onLogin();
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError({
        field: 'general',
        message: err.response?.data?.message || 'Failed to register. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Create Account</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error?.field === 'general' && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 
                       text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                       ${error?.field === 'email' ? 'border-red-500' : 'dark:border-gray-600'} 
                       dark:text-white focus:ring-2 focus:ring-blue-500`}
              disabled={isLoading}
            />
            {error?.field === 'email' && (
              <p className="mt-1 text-sm text-red-500">{error.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                       ${error?.field === 'username' ? 'border-red-500' : 'dark:border-gray-600'} 
                       dark:text-white focus:ring-2 focus:ring-blue-500`}
              disabled={isLoading}
            />
            {error?.field === 'username' && (
              <p className="mt-1 text-sm text-red-500">{error.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                       ${error?.field === 'password' ? 'border-red-500' : 'dark:border-gray-600'} 
                       dark:text-white focus:ring-2 focus:ring-blue-500`}
              disabled={isLoading}
            />
            {error?.field === 'password' && (
              <p className="mt-1 text-sm text-red-500">{error.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Repeat Password
            </label>
            <input
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                       ${error?.field === 'repeatPassword' ? 'border-red-500' : 'dark:border-gray-600'} 
                       dark:text-white focus:ring-2 focus:ring-blue-500`}
              disabled={isLoading}
            />
            {error?.field === 'repeatPassword' && (
              <p className="mt-1 text-sm text-red-500">{error.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg bg-blue-500 text-white font-medium
                     hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                     flex items-center justify-center"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 