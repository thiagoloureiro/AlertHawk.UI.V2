import React, { useState, useEffect } from 'react';
import { Upload, Download, Save, AlertTriangle, Loader2 } from 'lucide-react';
import monitorService from '../services/monitorService';
import { toast } from 'react-hot-toast';

export function Administration() {
  const [retentionDays, setRetentionDays] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showClearStatsModal, setShowClearStatsModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRetention = async () => {
      try {
        setIsLoading(true);
        const days = await monitorService.getMonitorHistoryRetention();
        setRetentionDays(days);
      } catch (error) {
        console.error('Failed to load retention days:', error);
        toast.error('Failed to load retention settings', { position: 'bottom-right' });
      } finally {
        setIsLoading(false);
      }
    };

    loadRetention();
  }, []);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const response = await monitorService.getMonitorJsonBackup();
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitor-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Backup exported successfully', { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to export backup:', error);
      toast.error('Failed to export backup', { position: 'bottom-right' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        if (!file.type.includes('json')) {
          toast.error('Please select a JSON file', { position: 'bottom-right' });
          return;
        }
        setSelectedFile(file);
        setShowConfirmation(true);
      } catch {
        toast.error('Invalid backup file', { position: 'bottom-right' });
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await monitorService.setMonitorHistoryRetention(retentionDays);
      toast.success('Retention settings updated successfully', { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to update retention days:', error);
      toast.error('Failed to update retention settings', { position: 'bottom-right' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStatistics = async () => {
    setIsClearing(true);
    try {
      await monitorService.clearAllStatistics();
      setShowClearStatsModal(false);
      toast.success('All statistics cleared successfully', { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to clear statistics:', error);
      toast.error('Failed to clear statistics', { position: 'bottom-right' });
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Administration</h1>
        <p className="dark:text-gray-400 text-gray-600">System backup and maintenance settings</p>
      </div>

      {/* Backup Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Backup</h2>
        
        <div className="space-y-6">
          <div>
            <p className="dark:text-gray-300 text-gray-700 mb-3">
              You can backup all monitors into a JSON file.
            </p>
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                       text-white transition-colors duration-200 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Exporting...' : 'Export Backup'}
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
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Monitor History</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Retention Period (Days)
            </label>
            <input
              type="number"
              min="1"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowClearStatsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 
                     text-white transition-colors duration-200"
          >
            <AlertTriangle className="w-4 h-4" />
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
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
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
                onClick={async () => {
                  if (!selectedFile) return;
                  
                  setIsImporting(true);
                  try {
                    await monitorService.uploadMonitorBackup(selectedFile);
                    setShowConfirmation(false);
                    setSelectedFile(null);
                    toast.success('Backup imported successfully', { position: 'bottom-right' });
                  } catch (error) {
                    console.error('Failed to import backup:', error);
                    toast.error('Failed to import backup', { position: 'bottom-right' });
                  } finally {
                    setIsImporting(false);
                  }
                }}
                disabled={isImporting}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white
                         transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed 
                         flex items-center gap-2"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isImporting ? 'Importing...' : 'Import and Replace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Statistics Modal */}
      {showClearStatsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Clear All Statistics
            </h3>
            <p className="dark:text-gray-300 text-gray-600 mb-6">
              Are you sure you want to delete all statistics?
              <br />
              <span className="text-red-500 font-medium">
                Please be aware that this operation cannot be undone.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearStatsModal(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClearStatistics}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isClearing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}