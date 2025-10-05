import React, { useState } from 'react';
import { CheckCircle, XCircle, Pause, Settings } from 'lucide-react';
import { MonitorGroup, Monitor } from '../../types';

interface StatusBlocksProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function StatusBlocks({ data, config, onConfigChange }: StatusBlocksProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<number[]>(
    config.selectedGroups || []
  );

  // Get all monitors from selected groups
  const allMonitors = React.useMemo(() => {
    const monitors: Monitor[] = [];
    const groupsToProcess = selectedGroups.length === 0 ? data : data.filter(g => selectedGroups.includes(g.id));
    
    groupsToProcess.forEach(group => {
      group.monitors.forEach(monitor => {
        monitors.push({ ...monitor, groupName: group.name });
      });
    });
    return monitors;
  }, [data, selectedGroups]);

  // Calculate status counts
  const statusCounts = React.useMemo(() => {
    const online = allMonitors.filter(monitor => monitor.status && !monitor.paused).length;
    const offline = allMonitors.filter(monitor => !monitor.status && !monitor.paused).length;
    const paused = allMonitors.filter(monitor => monitor.paused).length;
    const total = allMonitors.length;

    return { online, offline, paused, total };
  }, [allMonitors]);

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
            Select Groups ({selectedGroups.length}/{data.length})
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

      {/* Status Blocks */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 gap-2">
          {/* Online Block */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4 text-center">
            <div className="flex items-center justify-center gap-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {statusCounts.online}
              </div>
              <div className="text-sm font-medium text-green-700 dark:text-green-300">
                ONLINE
              </div>
              {statusCounts.total > 0 && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  {((statusCounts.online / statusCounts.total) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>

          {/* Offline Block */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 text-center">
            <div className="flex items-center justify-center gap-4">
              <XCircle className="w-6 h-6 text-red-500" />
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {statusCounts.offline}
              </div>
              <div className="text-sm font-medium text-red-700 dark:text-red-300">
                OFFLINE
              </div>
              {statusCounts.total > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {((statusCounts.offline / statusCounts.total) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>

          {/* Paused Block */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 text-center">
            <div className="flex items-center justify-center gap-4">
              <Pause className="w-6 h-6 text-gray-500" />
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {statusCounts.paused}
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                PAUSED
              </div>
              {statusCounts.total > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {((statusCounts.paused / statusCounts.total) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="mt-4 text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {statusCounts.total} Total Monitors
          </div>
        </div>
      </div>
    </div>
  );
}
