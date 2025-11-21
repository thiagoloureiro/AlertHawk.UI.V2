import React from 'react';
import { Monitor } from '../types';

interface CertificateExpirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  monitors: Monitor[];
  onDontShowAgain: () => void;
}

export function CertificateExpirationModal({ 
  isOpen, 
  onClose, 
  monitors, 
  onDontShowAgain 
}: CertificateExpirationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Certificate Expiration Warning
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {monitors.length} monitor{monitors.length !== 1 ? 's' : ''} with certificates expiring in less than 30 days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-4">
            {monitors.map((monitor) => (
              <div key={monitor.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1 min-w-0 mr-4">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {monitor.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={monitor.urlToCheck}>
                    {monitor.urlToCheck}
                  </p>
                </div>
                <div className="flex items-center space-x-4 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Days to expire:</span>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {monitor.daysToExpireCert}
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    monitor.daysToExpireCert <= 7 ? 'bg-red-500' : 
                    monitor.daysToExpireCert <= 14 ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
          <button
            onClick={onDontShowAgain}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Don't show this again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 