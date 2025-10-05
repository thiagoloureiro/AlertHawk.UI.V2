import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Activity, Settings, Pause } from 'lucide-react';
import { MonitorGroup, Monitor } from '../../types';

interface MonitorStatusGridProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function MonitorStatusGrid({ data, config, onConfigChange }: MonitorStatusGridProps) {
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

  const getStatusColor = (monitor: Monitor) => {
    if (monitor.paused) return 'text-gray-500 bg-gray-50 dark:bg-gray-800';
    if (monitor.status) return 'text-green-500 bg-green-50 dark:bg-green-900/20';
    return 'text-red-500 bg-red-50 dark:bg-red-900/20';
  };

  const getStatusIcon = (monitor: Monitor) => {
    if (monitor.paused) return Pause;
    if (monitor.status) return CheckCircle;
    return XCircle;
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600 dark:text-green-400';
    if (uptime >= 95) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
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

  if (allMonitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No monitors available</p>
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
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Monitors ({selectedMonitors.length}/{allMonitors.length})
          </h4>
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleSelectAll}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleSelectNone}
              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
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

      {/* Monitors List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {filteredMonitors.map((monitor) => {
            const StatusIcon = getStatusIcon(monitor);
            const statusColor = getStatusColor(monitor);
            const uptime24Hrs = monitor.monitorStatusDashboard?.uptime24Hrs || 0;
            const uptime7Days = monitor.monitorStatusDashboard?.uptime7Days || 0;
            
            return (
              <div
                key={monitor.id}
                className={`p-3 rounded-lg border border-gray-200 dark:border-gray-600 ${statusColor}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-5 h-5" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        {monitor.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {monitor.groupName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${getUptimeColor(uptime24Hrs)}`}>
                      {uptime24Hrs.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      24h uptime
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    monitor.paused 
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      : monitor.status 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                  }`}>
                    {monitor.paused ? 'Paused' : monitor.status ? 'Online' : 'Offline'}
                  </span>
                  
                  {monitor.monitorTypeId === 1 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      HTTP Monitor
                    </span>
                  )}
                </div>

                {/* Uptime Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">24h:</span>
                    <span className={`font-medium ${getUptimeColor(uptime24Hrs)}`}>
                      {uptime24Hrs.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">7d:</span>
                    <span className={`font-medium ${getUptimeColor(uptime7Days)}`}>
                      {uptime7Days.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
