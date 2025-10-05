import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, CheckCircle, XCircle, AlertTriangle, Settings } from 'lucide-react';
import { MonitorGroup, Monitor } from '../../types';

interface MetricCardProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function MetricCard({ data, config, onConfigChange }: MetricCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonitors, setSelectedMonitors] = useState<number[]>(
    config.selectedMonitors || []
  );

  // Get all monitors
  const allMonitors = React.useMemo(() => {
    const monitors: Monitor[] = [];
    data.forEach(group => {
      group.monitors.forEach(monitor => {
        monitors.push({ ...monitor, groupName: group.name });
      });
    });
    return monitors;
  }, [data]);

  // Filter monitors based on selection
  const filteredMonitors = React.useMemo(() => {
    if (selectedMonitors.length === 0) return allMonitors;
    return allMonitors.filter(monitor => selectedMonitors.includes(monitor.id));
  }, [allMonitors, selectedMonitors]);

  // Calculate metrics based on filtered monitors
  const metrics = React.useMemo(() => {
    if (filteredMonitors.length === 0) return null;

    const totalMonitors = filteredMonitors.length;
    const onlineMonitors = filteredMonitors.filter(monitor => monitor.status).length;
    const avgUptime24Hrs = filteredMonitors.reduce((sum, monitor) => 
      sum + (monitor.monitorStatusDashboard?.uptime24Hrs || 0), 0) / totalMonitors;
    const avgUptime7Days = filteredMonitors.reduce((sum, monitor) => 
      sum + (monitor.monitorStatusDashboard?.uptime7Days || 0), 0) / totalMonitors;
    const avgUptime30Days = filteredMonitors.reduce((sum, monitor) => 
      sum + (monitor.monitorStatusDashboard?.uptime30Days || 0), 0) / totalMonitors;

    // Calculate trend (comparing 7 days to 30 days)
    const trend = avgUptime7Days - avgUptime30Days;
    const trendDirection = trend > 1 ? 'up' : trend < -1 ? 'down' : 'stable';

    return {
      totalMonitors,
      onlineMonitors,
      avgUptime24Hrs,
      avgUptime7Days,
      avgUptime30Days,
      trend,
      trendDirection
    };
  }, [filteredMonitors]);

  const getStatusColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-500';
    if (uptime >= 95) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = (uptime: number) => {
    if (uptime >= 99) return CheckCircle;
    if (uptime >= 95) return AlertTriangle;
    return XCircle;
  };

  const handleMonitorToggle = (monitorId: number) => {
    const newSelection = selectedMonitors.includes(monitorId)
      ? selectedMonitors.filter(id => id !== monitorId)
      : [...selectedMonitors, monitorId];
    
    setSelectedMonitors(newSelection);
    onConfigChange({ selectedMonitors: newSelection });
  };

  const handleSelectAll = () => {
    const allIds = allMonitors.map(m => m.id);
    setSelectedMonitors(allIds);
    onConfigChange({ selectedMonitors: allIds });
  };

  const handleSelectNone = () => {
    setSelectedMonitors([]);
    onConfigChange({ selectedMonitors: [] });
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const TrendIcon = metrics.trendDirection === 'up' ? TrendingUp : 
                   metrics.trendDirection === 'down' ? TrendingDown : Minus;

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
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Monitors ({selectedMonitors.length}/{allMonitors.length})
          </h4>
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleSelectAll}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Select All
            </button>
            <button
              onClick={handleSelectNone}
              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Select None
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {allMonitors.map(monitor => (
              <label key={monitor.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedMonitors.includes(monitor.id)}
                  onChange={() => handleMonitorToggle(monitor.id)}
                  className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="truncate">{monitor.name}</span>
                <span className="text-gray-500 dark:text-gray-400">({monitor.groupName})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Main Metric */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center mb-2">
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {metrics.totalMonitors}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedMonitors.length > 0 ? 'Selected Monitors' : 'Total Monitors'}
          </div>
        </div>

        {/* Uptime Metrics */}
        <div className="grid grid-cols-1 gap-3 w-full">
          {[
            { label: '24 Hours', value: metrics.avgUptime24Hrs, period: '24Hrs' },
            { label: '7 Days', value: metrics.avgUptime7Days, period: '7Days' },
            { label: '30 Days', value: metrics.avgUptime30Days, period: '30Days' }
          ].map(({ label, value, period }) => {
            const StatusIcon = getStatusIcon(value);
            return (
              <div key={period} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${getStatusColor(value)}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </div>
                <span className={`text-sm font-medium ${getStatusColor(value)}`}>
                  {value.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-600">
        <TrendIcon className={`w-4 h-4 ${
          metrics.trendDirection === 'up' ? 'text-green-500' : 
          metrics.trendDirection === 'down' ? 'text-red-500' : 
          'text-gray-500'
        }`} />
        <span className={`text-xs ${
          metrics.trendDirection === 'up' ? 'text-green-500' : 
          metrics.trendDirection === 'down' ? 'text-red-500' : 
          'text-gray-500'
        }`}>
          {metrics.trendDirection === 'up' ? 'Improving' : 
           metrics.trendDirection === 'down' ? 'Declining' : 
           'Stable'} vs 30 days
        </span>
      </div>
    </div>
  );
}
