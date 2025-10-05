import React, { useState } from 'react';
import { Save, Trash2, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import { useMsal } from '@azure/msal-react';
import { authHttp } from '../services/httpClient';

// List of common timezones
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export function Settings() {
  const [selectedTimezone, setSelectedTimezone] = useState(() => {
    return localStorage.getItem('userTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { accounts, instance } = useMsal();

  // Get all available timezones (fallback to static list if not supported)
  const hasSupportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf !== undefined;
  const timezones: string[] = hasSupportedValuesOf
    ? (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
    : COMMON_TIMEZONES;

  const handleSave = () => {
    localStorage.setItem('userTimezone', selectedTimezone);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // Call the delete endpoint (no user ID needed, token is used)
      await authHttp.delete('/api/user/delete');
      // Logout user
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      if (accounts.length > 0) {
        await instance.logoutRedirect();
      } else {
        window.location.href = '/login';
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setDeleteError(error?.response?.data?.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Settings</h1>
        <p className="dark:text-gray-400 text-gray-600">Customize your monitoring experience</p>
      </div>

      <div className="max-w-2xl">
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6">
          <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Time Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                Timezone
              </label>
              
              <div className="space-y-4">
                {/* Common timezones */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {COMMON_TIMEZONES.map(tz => (
                    <button
                      key={tz}
                      onClick={() => setSelectedTimezone(tz)}
                      className={`px-3 py-2 rounded-lg text-sm text-left transition-colors
                                ${selectedTimezone === tz
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 text-gray-700'
                                }`}
                    >
                      {tz.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* All timezones dropdown */}
                <div>
                  <label className="block text-sm dark:text-gray-400 text-gray-600 mb-1">
                    Or select from all timezones:
                  </label>
                  <select
                    value={selectedTimezone}
                    onChange={(e) => setSelectedTimezone(e.target.value)}
                    className="w-full rounded-lg dark:bg-gray-700 bg-white border dark:border-gray-600 border-gray-300
                             dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                             transition-colors duration-200"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Current time preview */}
            <div className="text-sm dark:text-gray-400 text-gray-600">
              Current time: {new Date().toLocaleTimeString('default', { timeZone: selectedTimezone })}
            </div>
          </div>

          {/* Save button */}
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white
                       hover:bg-blue-600 transition-colors duration-200"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>

            {showSuccess && (
              <span className="text-green-500 dark:text-green-400">
                Settings saved successfully!
              </span>
            )}
          </div>
        </div>

        {/* App Version Section */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mt-6">
          <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">About</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm dark:text-gray-400 text-gray-600">Version</span>
              <span className="text-sm font-medium dark:text-white text-gray-900">
                {import.meta.env.VITE_APP_VERSION || 'Not available'}
              </span>
            </div>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mt-6">
          <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Danger Zone</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Deleting your account is irreversible. All your data will be permanently removed.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-gray-500 dark:text-gray-400"
              title="Close"
            >
              <span className="sr-only">Close</span>
              ×
            </button>
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Delete Account
            </h3>
            <p className="dark:text-gray-300 text-gray-700 mb-6">
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100 dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 