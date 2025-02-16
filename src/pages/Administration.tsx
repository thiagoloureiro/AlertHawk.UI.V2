import React, { useState } from 'react';
import { Upload, Download, Save, AlertTriangle } from 'lucide-react';

export function Administration() {
  const [retentionDays, setRetentionDays] = useState<string>('30');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleExportBackup = () => {
    // In a real application, this would trigger a backup download
    const dummyData = {
      monitors: [],
      settings: {},
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dummyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerthawk-backup-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real application, this would handle the backup import
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          JSON.parse(content); // Validate JSON format
          setShowConfirmation(true);
        } catch (error) {
          alert('Invalid backup file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveRetention = () => {
    // In a real application, this would save the retention period
    const days = parseInt(retentionDays);
    if (isNaN(days) || days < 0) {
      alert('Please enter a valid number of days');
      return;
    }
    // Save retention period logic would go here
  };

  const handleClearStatistics = () => {
    if (window.confirm('Are you sure you want to clear all statistics? This action cannot be undone!')) {
      // Clear statistics logic would go here
    }
  };

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Administration</h1>
        <p className="dark:text-gray-400 text-gray-600">System backup and maintenance settings</p>
      </div>

      {/* Backup Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Backup</h2>
        
        <div className="space-y-6">
          <div>
            <p className="dark:text-gray-300 text-gray-700 mb-3">
              You can backup all monitors into a JSON file.
            </p>
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                       text-white transition-colors duration-200"
            >
              <Download className="w-5 h-5" />
              Export Backup
            </button>
          </div>

          <div>
            <p className="dark:text-gray-300 text-gray-700 mb-3">
              You can import your JSON backup file - ALL EXISTING DATA WILL BE LOST!
            </p>
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                            text-white transition-colors duration-200 cursor-pointer w-fit">
              <Upload className="w-5 h-5" />
              Import Backup
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Monitor History Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Monitor History</h2>
        
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1 max-w-xs">
            <label htmlFor="retention" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
              Number of days to keep monitor data (0 for infinite retention)
            </label>
            <input
              type="number"
              id="retention"
              min="0"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-full px-4 py-2 rounded-lg dark:bg-gray-700 bg-white border dark:border-gray-600 
                       border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                       dark:focus:ring-blue-400 transition-colors duration-200"
            />
          </div>
          <button
            onClick={handleSaveRetention}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                     text-white transition-colors duration-200"
          >
            <Save className="w-5 h-5" />
            Save
          </button>
        </div>

        <div>
          <button
            onClick={handleClearStatistics}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 
                     text-white transition-colors duration-200"
          >
            <AlertTriangle className="w-5 h-5" />
            Clear All Statistics
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Confirm Import
            </h3>
            
            <div className="mb-6">
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 
                            text-yellow-800 dark:text-yellow-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Warning: All existing data will be lost</p>
                  <p className="text-sm">
                    This action will replace all current monitors and settings with the data from your backup file.
                    This cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                         transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Import logic would go here
                  setShowConfirmation(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white
                         transition-colors duration-200"
              >
                Import and Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}