import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Settings } from 'lucide-react';
import { MonitorGroup, Monitor } from '../../types';

interface SSLStatusWidgetProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function SSLStatusWidget({ data, config, onConfigChange }: SSLStatusWidgetProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonitors, setSelectedMonitors] = useState<number[]>(
    config.selectedMonitors || []
  );
  const [showMonitorList, setShowMonitorList] = useState(
    config.showMonitorList !== undefined ? config.showMonitorList : true
  );

  // Get all monitors with SSL certificates
  const sslMonitors = React.useMemo(() => {
    const allMonitors: Monitor[] = [];
    data.forEach(group => {
      group.monitors.forEach(monitor => {
        if (monitor.monitorTypeId === 1 && monitor.checkCertExpiry) { // HTTP monitors with SSL
          allMonitors.push(monitor);
        }
      });
    });
    return allMonitors;
  }, [data]);

  // Filter monitors based on selection
  const filteredMonitors = React.useMemo(() => {
    if (selectedMonitors.length === 0) return sslMonitors;
    return sslMonitors.filter(monitor => selectedMonitors.includes(monitor.id));
  }, [sslMonitors, selectedMonitors]);

  // Calculate SSL statistics
  const sslStats = React.useMemo(() => {
    const total = filteredMonitors.length;
    const expiring = filteredMonitors.filter(m => m.daysToExpireCert > 0 && m.daysToExpireCert < 30).length;
    const expired = filteredMonitors.filter(m => m.daysToExpireCert <= 0).length;
    const healthy = total - expiring - expired;

    return { total, expiring, expired, healthy };
  }, [filteredMonitors]);

  const getCertStatus = (daysToExpire: number) => {
    if (daysToExpire <= 0) return { status: 'expired', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20' };
    if (daysToExpire < 7) return { status: 'critical', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20' };
    if (daysToExpire < 30) return { status: 'warning', color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' };
    return { status: 'healthy', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20' };
  };

  const getStatusIcon = (daysToExpire: number) => {
    if (daysToExpire <= 0) return XCircle;
    if (daysToExpire < 30) return AlertTriangle;
    return CheckCircle;
  };

  const handleMonitorToggle = (monitorId: number) => {
    const newSelection = selectedMonitors.includes(monitorId)
      ? selectedMonitors.filter(id => id !== monitorId)
      : [...selectedMonitors, monitorId];
    
    setSelectedMonitors(newSelection);
    onConfigChange({ selectedMonitors: newSelection });
  };

  const handleSelectAll = () => {
    const allIds = sslMonitors.map(m => m.id);
    setSelectedMonitors(allIds);
    onConfigChange({ selectedMonitors: allIds });
  };

  const handleSelectNone = () => {
    setSelectedMonitors([]);
    onConfigChange({ selectedMonitors: [] });
  };

  const handleToggleMonitorList = () => {
    const newValue = !showMonitorList;
    setShowMonitorList(newValue);
    onConfigChange({ showMonitorList: newValue });
  };

  if (sslMonitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No SSL monitors found</p>
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
            SSL Widget Settings
          </h4>
          
          {/* Display Options */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showMonitorList}
                onChange={handleToggleMonitorList}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              Show monitor list
            </label>
          </div>

          {/* Monitor Selection */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Monitors ({selectedMonitors.length}/{sslMonitors.length})
            </h5>
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
              {sslMonitors.map(monitor => (
                <label key={monitor.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedMonitors.includes(monitor.id)}
                    onChange={() => handleMonitorToggle(monitor.id)}
                    className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="truncate">{monitor.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SSL Statistics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{sslStats.healthy}</div>
          <div className="text-xs text-green-600 dark:text-green-400">Healthy</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{sslStats.expiring}</div>
          <div className="text-xs text-yellow-600 dark:text-yellow-400">Expiring</div>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{sslStats.expired}</div>
          <div className="text-xs text-red-600 dark:text-red-400">Expired</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="text-lg font-bold text-gray-600 dark:text-gray-400">{sslStats.total}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
        </div>
      </div>

      {/* Monitor List - Conditional */}
      {showMonitorList && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {filteredMonitors.map((monitor) => {
              const certStatus = getCertStatus(monitor.daysToExpireCert);
              const StatusIcon = getStatusIcon(monitor.daysToExpireCert);
              
              return (
                <div
                  key={monitor.id}
                  className={`p-3 rounded-lg border border-gray-200 dark:border-gray-600 ${certStatus.bgColor}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-4 h-4 ${certStatus.color}`} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {monitor.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${certStatus.color}`}>
                        {monitor.daysToExpireCert > 0 
                          ? `${monitor.daysToExpireCert} days`
                          : 'Expired'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {monitor.urlToCheck}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
