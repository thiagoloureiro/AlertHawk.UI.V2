import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Save, Eye, Settings, BarChart3, PieChart, Activity, AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';
import './DashboardBuilder.css';
import { LoadingSpinner } from '../components/ui';
import { DashboardWidget } from '../components/dashboard/DashboardWidget';
import { WidgetLibrary } from '../components/dashboard/WidgetLibrary';
import { DashboardSettings } from '../components/dashboard/DashboardSettings';
import { SaveDashboardModal } from '../components/dashboard/SaveDashboardModal';
import { LoadDashboardModal } from '../components/dashboard/LoadDashboardModal';
import { MonitorGroup, AlertIncident } from '../types';
import monitorService from '../services/monitorService';
import alertService from '../services/alertService';

export interface DashboardData {
  monitorGroups: MonitorGroup[];
  alerts: AlertIncident[];
}

export interface DashboardWidget {
  id: string;
  type: 'uptime' | 'alert' | 'group-summary' | 'monitor-status' | 'ssl-status';
  title: string;
  dataSource: 'monitors' | 'alerts';
  config: any;
  position: { x: number; y: number; w: number; h: number };
}

export function DashboardBuilder() {
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({ monitorGroups: [], alerts: [] });
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [currentDashboard, setCurrentDashboard] = useState<{ id: string; name: string } | null>(null);

  // Load dashboard from URL parameter
  useEffect(() => {
    if (dashboardId) {
      const savedDashboards = JSON.parse(localStorage.getItem('savedDashboards') || '[]');
      const dashboard = savedDashboards.find((d: any) => d.id === dashboardId);
      
      if (dashboard) {
        setWidgets(dashboard.widgets);
        setCurrentDashboard({ id: dashboard.id, name: dashboard.name });
        // You could also load refreshInterval if saved
      } else {
        // Dashboard not found, redirect to new dashboard
        navigate('/dashboard-builder');
      }
    }
  }, [dashboardId, navigate]);

  // Fetch data from both sources
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [monitorGroups, alerts] = await Promise.all([
          monitorService.getDashboardGroups(6), // Production environment
          alertService.getAlerts(0, 90) // All environments, 90 days
        ]);
        
        setData({ monitorGroups, alerts });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-refresh data
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(async () => {
        try {
          const [monitorGroups, alerts] = await Promise.all([
            monitorService.getDashboardGroups(6),
            alertService.getAlerts(0, 90)
          ]);
          setData({ monitorGroups, alerts });
        } catch (err) {
          console.error('Failed to refresh data:', err);
        }
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  const handleAddWidget = (widgetType: string) => {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType as any,
      title: `New ${widgetType} Widget`,
      dataSource: widgetType === 'alert' ? 'alerts' : 'monitors',
      config: {},
      position: { x: 0, y: 0, w: 4, h: 3 }
    };
    
    setWidgets([...widgets, newWidget]);
    setShowWidgetLibrary(false);
  };

  const handleUpdateWidget = (id: string, updates: Partial<DashboardWidget>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const handleDeleteWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleSaveDashboard = () => {
    setShowSaveModal(true);
  };

  const handleLoadDashboard = (savedDashboard: any) => {
    setWidgets(savedDashboard.widgets);
    setCurrentDashboard({ id: savedDashboard.id, name: savedDashboard.name });
    setShowLoadModal(false);
    // Navigate to the dashboard URL
    navigate(`/dashboard-builder/${savedDashboard.id}`);
  };

  const handleSaveSuccess = (dashboardName: string, isUpdate: boolean = false) => {
    if (isUpdate && currentDashboard) {
      // Update existing dashboard
      const savedDashboards = JSON.parse(localStorage.getItem('savedDashboards') || '[]');
      const updatedDashboards = savedDashboards.map((d: any) => 
        d.id === currentDashboard.id 
          ? { ...d, name: dashboardName, widgets: widgets, updatedAt: new Date().toISOString() }
          : d
      );
      localStorage.setItem('savedDashboards', JSON.stringify(updatedDashboards));
      setCurrentDashboard({ ...currentDashboard, name: dashboardName });
    } else {
      // New dashboard - navigate to its URL
      const savedDashboards = JSON.parse(localStorage.getItem('savedDashboards') || '[]');
      const newDashboard = savedDashboards.find((d: any) => d.name === dashboardName);
      if (newDashboard) {
        setCurrentDashboard({ id: newDashboard.id, name: newDashboard.name });
        navigate(`/dashboard-builder/${newDashboard.id}`);
      }
    }
    console.log(`Dashboard "${dashboardName}" ${isUpdate ? 'updated' : 'saved'} successfully`);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <LoadingSpinner size="lg" text="Loading dashboard data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-gray-900 bg-gray-50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentDashboard ? currentDashboard.name : 'Dashboard Builder'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentDashboard ? 'Edit your dashboard' : 'Create custom dashboards with drag & drop widgets'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {refreshInterval && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <RefreshCw className="w-4 h-4" />
                Auto-refresh: {refreshInterval}s
              </div>
            )}
            
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isPreviewMode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Eye className="w-4 h-4" />
              {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
            </button>
            
            <button
              onClick={() => setShowLoadModal(true)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Load Dashboard
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            
            <button
              onClick={handleSaveDashboard}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Widget Library Sidebar */}
        {!isPreviewMode && (
          <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
            <WidgetLibrary onAddWidget={handleAddWidget} />
          </div>
        )}

        {/* Dashboard Canvas */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="min-h-full">
            {widgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <BarChart3 className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No widgets yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {isPreviewMode 
                    ? 'Switch to edit mode to add widgets' 
                    : 'Add widgets from the library to start building your dashboard'
                  }
                </p>
                {!isPreviewMode && (
                  <button
                    onClick={() => setShowWidgetLibrary(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Widget
                  </button>
                )}
              </div>
              ) : (
                <div className="dashboard-grid">
                  {widgets.map((widget) => (
                    <div
                      key={widget.id}
                      className="widget-container"
                      style={{
                        gridColumn: `span ${widget.position.w}`,
                        gridRow: `span ${widget.position.h}`,
                      }}
                    >
                      <DashboardWidget
                        widget={widget}
                        data={data}
                        isPreviewMode={isPreviewMode}
                        onUpdate={handleUpdateWidget}
                        onDelete={handleDeleteWidget}
                      />
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showWidgetLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <WidgetLibrary onAddWidget={handleAddWidget} onClose={() => setShowWidgetLibrary(false)} />
          </div>
        </div>
      )}

      {showSettings && (
        <DashboardSettings
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSaveModal && (
        <SaveDashboardModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveSuccess}
          widgets={widgets}
          currentDashboard={currentDashboard}
        />
      )}

      {showLoadModal && (
        <LoadDashboardModal
          isOpen={showLoadModal}
          onClose={() => setShowLoadModal(false)}
          onLoad={handleLoadDashboard}
        />
      )}
    </div>
  );
}
