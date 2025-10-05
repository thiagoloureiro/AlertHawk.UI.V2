import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { authHttp } from '../services/httpClient';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

export function ForgotPasswordModal({ onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      await authHttp.post(`/api/user/resetpassword/${email}`);
      setIsSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Reset Password</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 
                       text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 
                           flex items-center justify-center text-green-600 dark:text-green-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-center dark:text-white">
                Password Reset Email Sent
              </h3>
              <p className="text-center text-gray-500 dark:text-gray-400">
                Instructions to reset your password have been sent to:
                <br />
                <span className="font-medium dark:text-gray-300">{email}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-[#5CD4E2] hover:bg-[#4BC3D1] 
                       text-white font-medium transition-colors duration-200"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                         dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                We'll send password reset instructions to this email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 rounded-lg bg-[#5CD4E2] hover:bg-[#4BC3D1] text-white 
                       font-medium focus:ring-2 focus:ring-[#5CD4E2] focus:ring-offset-2 
                       dark:focus:ring-offset-gray-800 disabled:opacity-50 
                       disabled:cursor-not-allowed transition-all duration-200
                       flex items-center justify-center"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
} 