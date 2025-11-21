import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Trash2, Calendar, Grid } from 'lucide-react';
import { DashboardWidget } from '../../pages/DashboardBuilder';

interface SavedDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

interface LoadDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (dashboard: SavedDashboard) => void;
}

export function LoadDashboardModal({ isOpen, onClose, onLoad }: LoadDashboardModalProps) {
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedDashboards();
    }
  }, [isOpen]);

  const loadSavedDashboards = () => {
    try {
      const saved = localStorage.getItem('savedDashboards');
      if (saved) {
        const dashboards = JSON.parse(saved);
        setSavedDashboards(dashboards.sort((a: SavedDashboard, b: SavedDashboard) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ));
      }
    } catch (err) {
      console.error('Error loading saved dashboards:', err);
      setError('Failed to load saved dashboards');
    }
  };

  const handleLoad = (dashboard: SavedDashboard) => {
    onLoad(dashboard);
    onClose();
  };

  const handleDelete = (dashboardId: string) => {
    if (!confirm('Are you sure you want to delete this dashboard? This action cannot be undone.')) {
      return;
    }

    try {
      const updatedDashboards = savedDashboards.filter(dash => dash.id !== dashboardId);
      setSavedDashboards(updatedDashboards);
      localStorage.setItem('savedDashboards', JSON.stringify(updatedDashboards));
    } catch (err) {
      console.error('Error deleting dashboard:', err);
      setError('Failed to delete dashboard');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl dark:bg-gray-900 bg-gray-50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xl font-semibold dark:text-white text-gray-900">Load Dashboard</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}

          {savedDashboards.length === 0 ? (
            <div className="text-center py-8">
              <Grid className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Saved Dashboards</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Create and save a dashboard to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {savedDashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                          {dashboard.name}
                        </h4>
                        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full">
                          {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Created: {formatDate(dashboard.createdAt)}
                        </div>
                        {dashboard.updatedAt !== dashboard.createdAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Updated: {formatDate(dashboard.updatedAt)}
                          </div>
                        )}
                      </div>

                      {/* Widget Types Preview */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dashboard.widgets.slice(0, 5).map((widget, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                          >
                            {widget.type}
                          </span>
                        ))}
                        {dashboard.widgets.length > 5 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                            +{dashboard.widgets.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleLoad(dashboard)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors duration-200"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(dashboard.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-200"
                        title="Delete dashboard"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t dark:border-gray-700 border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
