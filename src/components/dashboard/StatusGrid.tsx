import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Activity } from 'lucide-react';
import { MonitorGroup } from '../../types';

interface StatusGridProps {
  data: MonitorGroup[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function StatusGrid({ data, config }: StatusGridProps) {
  // Process data for status grid
  const statusData = React.useMemo(() => {
    return data.map(group => {
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
  }, [data]);

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
    <div className="h-full overflow-y-auto">
      <div className="space-y-3">
        {statusData.map((group) => {
          const StatusIcon = getStatusIcon(group.uptimePercentage);
          return (
            <div
              key={group.id}
              className={`p-4 rounded-lg border ${getStatusColor(group.uptimePercentage)}`}
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
  );
}
