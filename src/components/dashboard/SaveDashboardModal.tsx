import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { DashboardWidget } from '../../pages/DashboardBuilder';

interface SaveDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, isUpdate: boolean) => void;
  widgets: DashboardWidget[];
  currentDashboard?: { id: string; name: string } | null;
}

export function SaveDashboardModal({ isOpen, onClose, onSave, widgets, currentDashboard }: SaveDashboardModalProps) {
  const [dashboardName, setDashboardName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isUpdate = !!currentDashboard;

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setDashboardName(currentDashboard?.name || '');
      setError('');
    }
  }, [isOpen, currentDashboard]);

  const handleSave = async () => {
    if (!dashboardName.trim()) {
      setError('Dashboard name is required');
      return;
    }

    if (widgets.length === 0) {
      setError('Cannot save empty dashboard');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const existingDashboards = JSON.parse(localStorage.getItem('savedDashboards') || '[]');
      
      if (isUpdate) {
        // Update existing dashboard
        const updatedDashboards = existingDashboards.map((dash: any) => 
          dash.id === currentDashboard?.id 
            ? { ...dash, name: dashboardName.trim(), widgets: widgets, updatedAt: new Date().toISOString() }
            : dash
        );
        localStorage.setItem('savedDashboards', JSON.stringify(updatedDashboards));
        onSave(dashboardName.trim(), true);
      } else {
        // Check if name already exists (only for new dashboards)
        const nameExists = existingDashboards.some((dash: any) => 
          dash.name.toLowerCase() === dashboardName.toLowerCase()
        );

        if (nameExists) {
          setError('A dashboard with this name already exists');
          setIsLoading(false);
          return;
        }

        // Create new dashboard object
        const dashboard = {
          id: Date.now().toString(),
          name: dashboardName.trim(),
          widgets: widgets,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save to localStorage
        const updatedDashboards = [...existingDashboards, dashboard];
        localStorage.setItem('savedDashboards', JSON.stringify(updatedDashboards));
        onSave(dashboardName.trim(), false);
      }

      setDashboardName('');
      onClose();
    } catch (err) {
      setError('Failed to save dashboard');
      console.error('Save dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setDashboardName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
          <div className="flex items-center gap-3">
            <Save className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xl font-semibold dark:text-white text-gray-900">
              {isUpdate ? 'Update Dashboard' : 'Save Dashboard'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="dashboard-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dashboard Name
            </label>
            <input
              id="dashboard-name"
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Enter dashboard name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <div className="font-medium mb-1">Dashboard Summary:</div>
              <div className="text-xs space-y-1">
                <div>• {widgets.length} widget{widgets.length !== 1 ? 's' : ''}</div>
                <div>• Will be saved locally in your browser</div>
                <div>• Can be loaded and shared later</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700 border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !dashboardName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isUpdate ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isUpdate ? 'Update Dashboard' : 'Save Dashboard'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
