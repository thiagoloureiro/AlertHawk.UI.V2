import React, { useState, useEffect } from 'react';
import { Upload, Download, Save, AlertTriangle, Loader2, Calendar, X } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import monitorService from '../services/monitorService';
import { metricsHttp } from '../services/httpClient';
import { toast } from 'react-hot-toast';

// Helper function to format date in 24-hour format (UTC)
const formatDateTime24Hour = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// Custom 24-hour time input component
const TimeInput24Hour: React.FC<{
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}> = ({ value, onChange, required, className }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove any non-digit characters except colon
    inputValue = inputValue.replace(/[^\d:]/g, '');
    
    // Auto-format as user types (HH:MM)
    if (inputValue.length === 1 && parseInt(inputValue) > 2) {
      inputValue = '0' + inputValue + ':';
    } else if (inputValue.length === 2 && !inputValue.includes(':')) {
      const hours = parseInt(inputValue);
      if (hours > 23) {
        inputValue = '23:';
      } else {
        inputValue = inputValue + ':';
      }
    } else if (inputValue.length === 3 && !inputValue.includes(':')) {
      inputValue = inputValue.slice(0, 2) + ':' + inputValue.slice(2);
    } else if (inputValue.length > 5) {
      inputValue = inputValue.slice(0, 5);
    }
    
    // Validate format
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (inputValue.length === 5 && !timePattern.test(inputValue)) {
      // If invalid, don't update
      return;
    }
    
    onChange(inputValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    
    if (inputValue && !timePattern.test(inputValue)) {
      // Reset to empty or last valid value
      onChange('');
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="HH:MM"
      pattern="^([01]\d|2[0-3]):([0-5]\d)$"
      required={required}
      maxLength={5}
      className={className}
    />
  );
};

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
  const [metricsCleanupDays, setMetricsCleanupDays] = useState<number>(7);
  const [isClearingMetrics, setIsClearingMetrics] = useState(false);
  const [showClearMetricsModal, setShowClearMetricsModal] = useState(false);
  const [isMonitorExecutionDisabled, setIsMonitorExecutionDisabled] = useState<boolean>(false);
  const [isTogglingExecution, setIsTogglingExecution] = useState(false);
  const [showExecutionConfirmationModal, setShowExecutionConfirmationModal] = useState(false);
  const [maintenanceWindow, setMaintenanceWindow] = useState<{
    startUtc: string | null;
    endUtc: string | null;
    isInMaintenanceWindow: boolean;
  }>({
    startUtc: null,
    endUtc: null,
    isInMaintenanceWindow: false
  });
  const [isLoadingMaintenanceWindow, setIsLoadingMaintenanceWindow] = useState(false);
  const [isSavingMaintenanceWindow, setIsSavingMaintenanceWindow] = useState(false);
  const [showMaintenanceWindowModal, setShowMaintenanceWindowModal] = useState(false);
  const [maintenanceStartDate, setMaintenanceStartDate] = useState<string>('');
  const [maintenanceStartTime, setMaintenanceStartTime] = useState<string>('');
  const [maintenanceEndDate, setMaintenanceEndDate] = useState<string>('');
  const [maintenanceEndTime, setMaintenanceEndTime] = useState<string>('');

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

    const loadMonitorExecutionStatus = async () => {
      try {
        const status = await monitorService.getMonitorExecutionStatus();
        setIsMonitorExecutionDisabled(status.isDisabled);
      } catch (error) {
        console.error('Failed to load monitor execution status:', error);
        toast.error('Failed to load monitor execution status', { position: 'bottom-right' });
      }
    };

    const loadMaintenanceWindow = async () => {
      setIsLoadingMaintenanceWindow(true);
      try {
        const window = await monitorService.getMaintenanceWindow();
        setMaintenanceWindow({
          startUtc: window.startUtc,
          endUtc: window.endUtc,
          isInMaintenanceWindow: window.isInMaintenanceWindow
        });
      } catch (error) {
        console.error('Failed to load maintenance window:', error);
        toast.error('Failed to load maintenance window', { position: 'bottom-right' });
      } finally {
        setIsLoadingMaintenanceWindow(false);
      }
    };

    loadRetention();
    loadMonitorExecutionStatus();
    loadMaintenanceWindow();
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

  const handleClearMetrics = async () => {
    setIsClearingMetrics(true);
    try {
      const days = metricsCleanupDays || 0;
      await metricsHttp.delete(`/api/metrics/cleanup?days=${days}`);
      setShowClearMetricsModal(false);
      const message = days === 0 
        ? 'All metrics data cleared successfully' 
        : `Metrics data older than ${days} days cleared successfully`;
      toast.success(message, { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to clear metrics:', error);
      toast.error('Failed to clear metrics', { position: 'bottom-right' });
    } finally {
      setIsClearingMetrics(false);
    }
  };

  const handleToggleMonitorExecution = async () => {
    setIsTogglingExecution(true);
    try {
      const newStatus = !isMonitorExecutionDisabled;
      await monitorService.setMonitorExecutionDisabled(newStatus);
      setIsMonitorExecutionDisabled(newStatus);
      
      // If enabling monitors, clear the maintenance window
      if (!newStatus) {
        try {
          await monitorService.setMaintenanceWindow(null, null);
          // Reload maintenance window state
          const maintenanceWindowData = await monitorService.getMaintenanceWindow();
          setMaintenanceWindow({
            startUtc: maintenanceWindowData.startUtc,
            endUtc: maintenanceWindowData.endUtc,
            isInMaintenanceWindow: maintenanceWindowData.isInMaintenanceWindow
          });
          // Notify TopBar to refresh
          window.dispatchEvent(new CustomEvent('maintenanceWindowUpdated'));
        } catch (error) {
          console.error('Failed to clear maintenance window:', error);
          // Don't fail the whole operation if clearing maintenance window fails
        }
      }
      
      // Notify TopBar to refresh monitor execution status
      window.dispatchEvent(new CustomEvent('monitorExecutionStatusUpdated'));
      
      toast.success(
        `Monitor execution has been ${newStatus ? 'disabled' : 'enabled'}${!newStatus ? ' and maintenance window cleared' : ''}`,
        { position: 'bottom-right' }
      );
    } catch (error) {
      console.error('Failed to toggle monitor execution:', error);
      toast.error('Failed to update monitor execution status', { position: 'bottom-right' });
    } finally {
      setIsTogglingExecution(false);
    }
  };

  const handleOpenMaintenanceWindowModal = () => {
    if (maintenanceWindow.startUtc && maintenanceWindow.endUtc) {
      const startDate = new Date(maintenanceWindow.startUtc);
      const endDate = new Date(maintenanceWindow.endUtc);
      
      // Convert UTC to local date/time strings for display
      const startYear = startDate.getUTCFullYear();
      const startMonth = String(startDate.getUTCMonth() + 1).padStart(2, '0');
      const startDay = String(startDate.getUTCDate()).padStart(2, '0');
      const startHours = String(startDate.getUTCHours()).padStart(2, '0');
      const startMinutes = String(startDate.getUTCMinutes()).padStart(2, '0');
      
      const endYear = endDate.getUTCFullYear();
      const endMonth = String(endDate.getUTCMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getUTCDate()).padStart(2, '0');
      const endHours = String(endDate.getUTCHours()).padStart(2, '0');
      const endMinutes = String(endDate.getUTCMinutes()).padStart(2, '0');
      
      setMaintenanceStartDate(`${startYear}-${startMonth}-${startDay}`);
      setMaintenanceStartTime(`${startHours}:${startMinutes}`);
      setMaintenanceEndDate(`${endYear}-${endMonth}-${endDay}`);
      setMaintenanceEndTime(`${endHours}:${endMinutes}`);
    } else {
      setMaintenanceStartDate('');
      setMaintenanceStartTime('');
      setMaintenanceEndDate('');
      setMaintenanceEndTime('');
    }
    setShowMaintenanceWindowModal(true);
  };

  const handleSaveMaintenanceWindow = async () => {
    // Validate that all fields are filled
    if (!maintenanceStartDate || !maintenanceStartTime || !maintenanceEndDate || !maintenanceEndTime) {
      toast.error('Please fill in all date and time fields', { position: 'bottom-right' });
      return;
    }

    setIsSavingMaintenanceWindow(true);
    try {
      // Parse the date/time strings as UTC
      const [startYear, startMonth, startDay] = maintenanceStartDate.split('-').map(Number);
      const [startHours, startMinutes] = maintenanceStartTime.split(':').map(Number);
      const startDateTime = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHours, startMinutes, 0));
      
      const [endYear, endMonth, endDay] = maintenanceEndDate.split('-').map(Number);
      const [endHours, endMinutes] = maintenanceEndTime.split(':').map(Number);
      const endDateTime = new Date(Date.UTC(endYear, endMonth - 1, endDay, endHours, endMinutes, 0));
      
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        toast.error('Invalid date/time format', { position: 'bottom-right' });
        setIsSavingMaintenanceWindow(false);
        return;
      }

      if (endDateTime <= startDateTime) {
        toast.error('End time must be after start time', { position: 'bottom-right' });
        setIsSavingMaintenanceWindow(false);
        return;
      }

      const startUtc = startDateTime.toISOString();
      const endUtc = endDateTime.toISOString();

      await monitorService.setMaintenanceWindow(startUtc, endUtc);
      
      // Reload maintenance window
      const maintenanceWindowData = await monitorService.getMaintenanceWindow();
      setMaintenanceWindow({
        startUtc: maintenanceWindowData.startUtc,
        endUtc: maintenanceWindowData.endUtc,
        isInMaintenanceWindow: maintenanceWindowData.isInMaintenanceWindow
      });
      
      // Notify TopBar to refresh
      window.dispatchEvent(new CustomEvent('maintenanceWindowUpdated'));
      
      setShowMaintenanceWindowModal(false);
      toast.success(
        startUtc && endUtc 
          ? 'Maintenance window set successfully' 
          : 'Maintenance window cleared successfully',
        { position: 'bottom-right' }
      );
    } catch (error) {
      console.error('Failed to save maintenance window:', error);
      toast.error('Failed to save maintenance window', { position: 'bottom-right' });
    } finally {
      setIsSavingMaintenanceWindow(false);
    }
  };

  const handleClearMaintenanceWindow = async () => {
    setIsSavingMaintenanceWindow(true);
    try {
      await monitorService.setMaintenanceWindow(null, null);
      
      // Reload maintenance window
      const maintenanceWindowData = await monitorService.getMaintenanceWindow();
      setMaintenanceWindow({
        startUtc: maintenanceWindowData.startUtc,
        endUtc: maintenanceWindowData.endUtc,
        isInMaintenanceWindow: maintenanceWindowData.isInMaintenanceWindow
      });
      
      // Notify TopBar to refresh
      window.dispatchEvent(new CustomEvent('maintenanceWindowUpdated'));
      
      toast.success('Maintenance window cleared successfully', { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to clear maintenance window:', error);
      toast.error('Failed to clear maintenance window', { position: 'bottom-right' });
    } finally {
      setIsSavingMaintenanceWindow(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading settings..." />
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
                <LoadingSpinner size="sm" />
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
                  <LoadingSpinner size="sm" />
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

      {/* Monitor Execution Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Monitor Execution</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="dark:text-blue-200 text-blue-800 text-sm mb-3">
              {isMonitorExecutionDisabled ? (
                <>
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  <strong>Monitor execution is currently disabled.</strong> All monitor runners (HTTP, TCP, K8s) are paused. 
                  This is typically used for system maintenance.
                </>
              ) : (
                <>
                  Monitor execution is currently <strong>enabled</strong>. All monitors are running normally.
                </>
              )}
            </p>
          </div>

          <div>
            <button
              onClick={() => setShowExecutionConfirmationModal(true)}
              disabled={isTogglingExecution}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed ${
                         isMonitorExecutionDisabled
                           ? 'bg-green-500 hover:bg-green-600'
                           : 'bg-red-500 hover:bg-red-600'
                       }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {isMonitorExecutionDisabled ? 'Enable Monitor Execution' : 'Disable Monitor Execution'}
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Window Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Maintenance Window</h2>
        
        <div className="space-y-4">
          {isLoadingMaintenanceWindow ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <>
              <div className={`p-4 rounded-lg border ${
                maintenanceWindow.isInMaintenanceWindow
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : maintenanceWindow.startUtc && maintenanceWindow.endUtc
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
              }`}>
                <p className={`text-sm ${
                  maintenanceWindow.isInMaintenanceWindow
                    ? 'dark:text-yellow-200 text-yellow-800'
                    : maintenanceWindow.startUtc && maintenanceWindow.endUtc
                    ? 'dark:text-blue-200 text-blue-800'
                    : 'dark:text-gray-300 text-gray-600'
                }`}>
                  {maintenanceWindow.isInMaintenanceWindow ? (
                    <>
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      <strong>Currently in maintenance window.</strong>
                      {maintenanceWindow.endUtc && (
                        <> Scheduled until {formatDateTime24Hour(maintenanceWindow.endUtc)} UTC</>
                      )}
                    </>
                  ) : maintenanceWindow.startUtc && maintenanceWindow.endUtc ? (
                    <>
                      <Calendar className="w-4 h-4 inline mr-2" />
                      <strong>Maintenance window scheduled:</strong>
                      <br />
                      From {formatDateTime24Hour(maintenanceWindow.startUtc)} UTC
                      <br />
                      To {formatDateTime24Hour(maintenanceWindow.endUtc)} UTC
                    </>
                  ) : (
                    <>
                      No maintenance window is currently set. Monitors will run continuously.
                    </>
                  )}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleOpenMaintenanceWindowModal}
                  disabled={isSavingMaintenanceWindow}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                           text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-4 h-4" />
                  {maintenanceWindow.startUtc && maintenanceWindow.endUtc ? 'Edit Maintenance Window' : 'Set Maintenance Window'}
                </button>
                
                {maintenanceWindow.startUtc && maintenanceWindow.endUtc && (
                  <button
                    onClick={handleClearMaintenanceWindow}
                    disabled={isSavingMaintenanceWindow}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 
                             text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                    Clear Maintenance Window
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Metrics</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Cleanup Days
            </label>
            <input
              type="number"
              min="0"
              value={metricsCleanupDays}
              onChange={(e) => setMetricsCleanupDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter number of days (0 to truncate all)"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metricsCleanupDays === 0 
                ? 'Setting to 0 will truncate all metrics tables' 
                : `Metrics older than ${metricsCleanupDays} days will be deleted`}
            </p>
          </div>

          <div>
            <button
              onClick={() => setShowClearMetricsModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 
                       text-white transition-colors duration-200"
            >
              <AlertTriangle className="w-4 h-4" />
              {metricsCleanupDays === 0 ? 'Truncate All Metrics' : `Clear Metrics Older Than ${metricsCleanupDays} Days`}
            </button>
          </div>
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
                  <LoadingSpinner size="sm" />
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
                  <LoadingSpinner size="sm" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Metrics Modal */}
      {showClearMetricsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              {metricsCleanupDays === 0 ? 'Truncate All Metrics' : 'Clear Metrics Data'}
            </h3>
            <p className="dark:text-gray-300 text-gray-600 mb-6">
              {metricsCleanupDays === 0 ? (
                <>
                  Are you sure you want to <span className="text-red-500 font-medium">truncate all metrics tables</span>?
                  <br />
                  <span className="text-red-500 font-medium">
                    This will delete ALL metrics data and cannot be undone.
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to delete metrics data older than <span className="font-medium">{metricsCleanupDays} days</span>?
                  <br />
                  <span className="text-red-500 font-medium">
                    This operation cannot be undone.
                  </span>
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearMetricsModal(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClearMetrics}
                disabled={isClearingMetrics}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isClearingMetrics ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {isClearingMetrics ? 'Clearing...' : metricsCleanupDays === 0 ? 'Truncate All' : 'Clear Metrics'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monitor Execution Confirmation Modal */}
      {showExecutionConfirmationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              {isMonitorExecutionDisabled ? 'Enable Monitor Execution' : 'Disable Monitor Execution'}
            </h3>
            
            <div className="mb-6">
              {isMonitorExecutionDisabled ? (
                <p className="dark:text-gray-300 text-gray-600">
                  Are you sure you want to <span className="font-medium text-green-600 dark:text-green-400">enable</span> monitor execution?
                  <br />
                  <br />
                  This will resume all monitor runners (HTTP, TCP, K8s) and monitoring will continue normally.
                </p>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 
                            text-yellow-800 dark:text-yellow-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Warning: This will pause all monitors</p>
                    <p className="text-sm">
                      Disabling monitor execution will pause all monitor runners (HTTP, TCP, K8s). 
                      This is typically used for system maintenance. Monitors will not execute until execution is re-enabled.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExecutionConfirmationModal(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                         transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowExecutionConfirmationModal(false);
                  await handleToggleMonitorExecution();
                }}
                disabled={isTogglingExecution}
                className={`px-4 py-2 rounded-lg text-white transition-colors duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                           isMonitorExecutionDisabled
                             ? 'bg-green-500 hover:bg-green-600'
                             : 'bg-red-500 hover:bg-red-600'
                         }`}
              >
                {isTogglingExecution ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {isMonitorExecutionDisabled ? 'Enabling...' : 'Disabling...'}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {isMonitorExecutionDisabled ? 'Enable' : 'Disable'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Window Modal */}
      {showMaintenanceWindowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Set Maintenance Window
            </h3>
            
            <div className="mb-6 space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 
                            text-blue-800 dark:text-blue-200 text-sm">
                <p className="font-medium mb-1">Maintenance Window Information</p>
                <p>
                  During the maintenance window, monitor execution will be automatically disabled. 
                  All times should be entered in UTC.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                  Start Date & Time (UTC) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={maintenanceStartDate}
                    onChange={(e) => setMaintenanceStartDate(e.target.value)}
                    required
                    className="px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <TimeInput24Hour
                    value={maintenanceStartTime}
                    onChange={(value) => setMaintenanceStartTime(value)}
                    required
                    className="px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                  End Date & Time (UTC) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={maintenanceEndDate}
                    onChange={(e) => setMaintenanceEndDate(e.target.value)}
                    required
                    className="px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <TimeInput24Hour
                    value={maintenanceEndTime}
                    onChange={(value) => setMaintenanceEndTime(value)}
                    required
                    className="px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMaintenanceWindowModal(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                         transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMaintenanceWindow}
                disabled={
                  isSavingMaintenanceWindow || 
                  !maintenanceStartDate || 
                  !maintenanceStartTime || 
                  !maintenanceEndDate || 
                  !maintenanceEndTime
                }
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white
                         transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed 
                         flex items-center gap-2"
              >
                {isSavingMaintenanceWindow ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Maintenance Window
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