import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Activity, Settings } from 'lucide-react';
import { MonitorGroup } from '../../types';

interface GroupStatusGridProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function GroupStatusGrid({ data, config, onConfigChange }: GroupStatusGridProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<number[]>(
    config.selectedGroups || []
  );

  // Filter groups based on selection
  const filteredGroups = React.useMemo(() => {
    if (selectedGroups.length === 0) return data;
    return data.filter(group => selectedGroups.includes(group.id));
  }, [data, selectedGroups]);

  // Process data for status grid
  const statusData = React.useMemo(() => {
    return filteredGroups.map(group => {
      const totalMonitors = group.monitors.length;
      const onlineMonitors = group.monitors.filter(monitor => monitor.status).length;
      const offlineMonitors = totalMonitors - onlineMonitors;
      const uptimePercentage = totalMonitors > 0 ? (onlineMonitors / totalMonitors) * 100 : 0;

      return {
        id: group.id,
        name: group.name,
        totalMonitors,
        onlineMonitors,
        offlineMonitors,
        uptimePercentage,
        avgUptime24Hrs: group.avgUptime24Hrs,
        avgUptime7Days: group.avgUptime7Days
      };
    });
  }, [filteredGroups]);

  const getStatusColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-500 bg-green-50 dark:bg-green-900/20';
    if (uptime >= 95) return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-red-500 bg-red-50 dark:bg-red-900/20';
  };

  const getStatusIcon = (uptime: number) => {
    if (uptime >= 99) return CheckCircle;
    if (uptime >= 95) return AlertTriangle;
    return XCircle;
  };

  const handleGroupToggle = (groupId: number) => {
    const newSelection = selectedGroups.includes(groupId)
      ? selectedGroups.filter(id => id !== groupId)
      : [...selectedGroups, groupId];
    
    setSelectedGroups(newSelection);
    onConfigChange({ selectedGroups: newSelection });
  };

  const handleSelectAll = () => {
    const allIds = data.map(g => g.id);
    setSelectedGroups(allIds);
    onConfigChange({ selectedGroups: allIds });
  };

  const handleSelectNone = () => {
    setSelectedGroups([]);
    onConfigChange({ selectedGroups: [] });
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No monitor groups available</p>
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
            Select Groups ({selectedGroups.length}/{data.length})
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
            {data.map(group => (
              <label key={group.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={() => handleGroupToggle(group.id)}
                  className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="truncate">{group.name}</span>
                <span className="text-gray-500 dark:text-gray-400">({group.monitors.length} monitors)</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {statusData.map((group) => {
            const StatusIcon = getStatusIcon(group.uptimePercentage);
            return (
              <div
                key={group.id}
                className={`p-3 rounded-lg border ${getStatusColor(group.uptimePercentage)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-5 h-5" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {group.name}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {group.uptimePercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {group.onlineMonitors}/{group.totalMonitors} online
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      group.uptimePercentage >= 99 ? 'bg-green-500' :
                      group.uptimePercentage >= 95 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${group.uptimePercentage}%` }}
                  />
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">24h:</span>
                    <span className="font-medium">{group.avgUptime24Hrs.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">7d:</span>
                    <span className="font-medium">{group.avgUptime7Days.toFixed(1)}%</span>
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
