import React, { useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { AlertIncident } from '../../types';

interface AlertTimelineProps {
  data: AlertIncident[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function AlertTimeline({ data, config, onConfigChange }: AlertTimelineProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedEnvironments, setSelectedEnvironments] = useState<number[]>(
    config.selectedEnvironments || []
  );
  const [timeRange, setTimeRange] = useState(
    config.timeRange || '24h'
  );
  const [topMonitorsCount, setTopMonitorsCount] = useState(
    config.topMonitorsCount || 5
  );

  // Get unique environments
  const environments = React.useMemo(() => {
    const envs = [...new Set(data.map(alert => alert.environment))];
    return envs.sort();
  }, [data]);

  // Filter alerts based on selection and time range
  const filteredAlerts = React.useMemo(() => {
    let filtered = data;

    // Filter by environment
    if (selectedEnvironments.length > 0) {
      filtered = filtered.filter(alert => selectedEnvironments.includes(alert.environment));
    }

    // Filter by time range
    const now = new Date();
    const timeRanges = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const timeLimit = timeRanges[timeRange as keyof typeof timeRanges] || timeRanges['24h'];
    const cutoffTime = new Date(now.getTime() - timeLimit);

    filtered = filtered.filter(alert => new Date(alert.timeStamp) >= cutoffTime);

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime());
  }, [data, selectedEnvironments, timeRange]);

  // Calculate alert statistics
  const alertStats = React.useMemo(() => {
    const totalAlerts = filteredAlerts.length;
    const onlineAlerts = filteredAlerts.filter(alert => alert.status).length;
    const offlineAlerts = totalAlerts - onlineAlerts;
    
    // Count alerts by monitor
    const monitorAlertCounts: { [key: string]: { count: number; monitorName: string; environment: number } } = {};
    filteredAlerts.forEach(alert => {
      const key = `${alert.monitorId}-${alert.environment}`;
      if (!monitorAlertCounts[key]) {
        monitorAlertCounts[key] = {
          count: 0,
          monitorName: alert.monitorName,
          environment: alert.environment
        };
      }
      monitorAlertCounts[key].count++;
    });

    // Get top monitors with most alerts
    const topMonitors = Object.values(monitorAlertCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, topMonitorsCount);

    return {
      totalAlerts,
      onlineAlerts,
      offlineAlerts,
      topMonitors
    };
  }, [filteredAlerts, topMonitorsCount]);

  const getEnvironmentName = (envId: number) => {
    const envNames: { [key: number]: string } = {
      1: 'Development',
      2: 'Staging',
      3: 'QA',
      4: 'Testing',
      5: 'PreProd',
      6: 'Production',
    };
    return envNames[envId] || `Env ${envId}`;
  };

  const handleEnvironmentToggle = (envId: number) => {
    const newSelection = selectedEnvironments.includes(envId)
      ? selectedEnvironments.filter(id => id !== envId)
      : [...selectedEnvironments, envId];
    
    setSelectedEnvironments(newSelection);
    onConfigChange({ selectedEnvironments: newSelection });
  };

  const handleTimeRangeChange = (newRange: string) => {
    setTimeRange(newRange);
    onConfigChange({ timeRange: newRange });
  };

  const handleSelectAllEnvironments = () => {
    const allIds = environments;
    setSelectedEnvironments(allIds);
    onConfigChange({ selectedEnvironments: allIds });
  };

  const handleSelectNoEnvironments = () => {
    setSelectedEnvironments([]);
    onConfigChange({ selectedEnvironments: [] });
  };

  const handleTopMonitorsChange = (count: number) => {
    setTopMonitorsCount(count);
    onConfigChange({ topMonitorsCount: count });
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No alert data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Settings Button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Alert Timeline Settings
          </h4>
          
          {/* Time Range */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* Top Monitors Count */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Top Monitors Count
            </label>
            <select
              value={topMonitorsCount}
              onChange={(e) => handleTopMonitorsChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
            </select>
          </div>

          {/* Environment Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Environments ({selectedEnvironments.length}/{environments.length})
              </label>
              <div className="flex gap-1">
                <button
                  onClick={handleSelectAllEnvironments}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  All
                </button>
                <button
                  onClick={handleSelectNoEnvironments}
                  className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {environments.map(envId => (
                <label key={envId} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedEnvironments.includes(envId)}
                    onChange={() => handleEnvironmentToggle(envId)}
                    className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span>{getEnvironmentName(envId)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alert Statistics */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{alertStats.totalAlerts}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400">Total Alerts</div>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{alertStats.offlineAlerts}</div>
          <div className="text-xs text-red-600 dark:text-red-400">Offline Alerts</div>
        </div>
      </div>

      {/* Top Monitors */}
      {alertStats.topMonitors.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Top {topMonitorsCount} Monitors with Most Alerts
          </h3>
          <div className="space-y-2">
            {alertStats.topMonitors.map((monitor, index) => (
              <div
                key={`${monitor.monitorName}-${monitor.environment}`}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {monitor.monitorName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {getEnvironmentName(monitor.environment)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {monitor.count}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    alerts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Information */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between mb-1">
            <span>Time Period:</span>
            <span className="font-medium">
              {timeRange === '1h' ? 'Last Hour' :
               timeRange === '24h' ? 'Last 24 Hours' :
               timeRange === '7d' ? 'Last 7 Days' :
               timeRange === '30d' ? 'Last 30 Days' : timeRange}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span>Environments:</span>
            <span className="font-medium">
              {selectedEnvironments.length === 0 
                ? 'All' 
                : selectedEnvironments.map(env => getEnvironmentName(env)).join(', ')
              }
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Monitors Tracked:</span>
            <span className="font-medium">
              {alertStats.topMonitors.length} monitors
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
