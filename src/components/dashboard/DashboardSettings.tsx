import React from 'react';
import { X, RefreshCw, Clock, Settings } from 'lucide-react';

interface DashboardSettingsProps {
  refreshInterval: number | null;
  onRefreshIntervalChange: (interval: number | null) => void;
  onClose: () => void;
}

const refreshOptions = [
  { label: 'No auto-refresh', value: null },
  { label: '10 seconds', value: 10 },
  { label: '20 seconds', value: 20 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
];

export function DashboardSettings({ refreshInterval, onRefreshIntervalChange, onClose }: DashboardSettingsProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Auto-refresh Settings */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Auto-refresh</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically refresh dashboard data at regular intervals
            </p>
            
            <div className="space-y-2">
              {refreshOptions.map((option) => (
                <label
                  key={option.value || 'none'}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="refreshInterval"
                    value={option.value || ''}
                    checked={refreshInterval === option.value}
                    onChange={() => onRefreshIntervalChange(option.value)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div className="flex items-center gap-2">
                    {option.value && <Clock className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {option.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
