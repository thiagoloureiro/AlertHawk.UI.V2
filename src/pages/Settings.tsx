import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

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

  // Get all available timezones
  const timezones = Intl.supportedValuesOf('timeZone');

  const handleSave = () => {
    localStorage.setItem('userTimezone', selectedTimezone);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Settings</h1>
        <p className="dark:text-gray-400 text-gray-600">Customize your monitoring experience</p>
      </div>

      <div className="max-w-2xl">
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
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
      </div>
    </div>
  );
} 