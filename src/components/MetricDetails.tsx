import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Monitor } from '../types';
import { 
  Clock, Activity, CheckCircle, Globe, Network, 
  Pause, Play, Edit, Bell, MessageSquare, Trash2 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { convertUTCToLocalTime } from '../utils/dateUtils';

interface MetricDetailsProps {
  metric: Monitor;
}

const StatusTimeline = ({ historyData }: { historyData: { status: boolean; timeStamp: string }[] }) => {
  const userTimeZone = localStorage.getItem('userTimezone') || 
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get the last hour of data (should be 60 points), maintain chronological order (older to newer)
  const lastHourData = [...historyData]
    .slice(-60)  // Take last 60 entries
    .filter(point => point.timeStamp)  // Remove any invalid entries
    .sort((a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime()); // Sort by time ascending

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm dark:text-gray-400 text-gray-600 mb-2">
        <span>Last Hour Status Timeline ({userTimeZone})</span>
        <span>{lastHourData.length} checks</span>
      </div>
      <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex gap-px p-px">
        {lastHourData.map((point, index) => {
          const timeString = convertUTCToLocalTime(point.timeStamp);
          
          return (
            <div
              key={index}
              className="group relative flex-1"
            >
              <div
                className={cn(
                  "w-full h-full rounded transition-colors",
                  point.status
                    ? "bg-green-500 dark:bg-green-400"
                    : "bg-red-500 dark:bg-red-400"
                )}
              />
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                  <div>Time: {timeString}</div>
                  <div>Status: {point.status ? 'Online' : 'Offline'}</div>
                </div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          );
        })}
      </div>
      {/* Timeline labels */}
      <div className="flex justify-between text-xs dark:text-gray-400 text-gray-600 mt-1">
        <span>1 hour ago</span>
        <span>Now</span>
      </div>
    </div>
  );
};

// Update helper function to get monitor type info
const getMonitorTypeInfo = (typeId: number) => {
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className="w-6 h-6 dark:text-blue-400 text-blue-500" />,
        label: 'HTTP(S)'
      };
    case 3:  // Changed from 2 to 3 for TCP
      return {
        icon: <Network className="w-6 h-6 dark:text-purple-400 text-purple-500" />,
        label: 'TCP'
      };
    default:
      return {
        icon: <Globe className="w-6 h-6 dark:text-gray-400 text-gray-500" />,
        label: 'Unknown'
      };
  }
};

const UptimeBlock = ({ label, value }: { label: string; value: number }) => {
  // Function to determine color based on uptime value
  const getColorClass = (uptime: number) => {
    if (uptime >= 99) return "bg-green-500 dark:bg-green-400";
    if (uptime >= 95) return "bg-yellow-500 dark:bg-yellow-400";
    return "bg-red-500 dark:bg-red-400";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full h-24 dark:bg-gray-700 bg-gray-100 rounded-lg p-3 flex flex-col items-center justify-center">
        <div className={`text-2xl font-bold mb-1 ${value >= 95 ? 'dark:text-white text-gray-900' : 'text-red-600 dark:text-red-400'}`}>
          {value.toFixed(2)}%
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${getColorClass(value)}`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <span className="mt-2 text-sm dark:text-gray-400 text-gray-600">{label}</span>
    </div>
  );
};

export function MetricDetails({ metric }: MetricDetailsProps) {
  const typeInfo = getMonitorTypeInfo(metric.monitorTypeId);

  const uptimeMetrics = [
    { label: '1 Hour', value: metric.monitorStatusDashboard.uptime1Hr },
    { label: '24 Hours', value: metric.monitorStatusDashboard.uptime24Hrs },
    { label: '7 Days', value: metric.monitorStatusDashboard.uptime7Days },
    { label: '30 Days', value: metric.monitorStatusDashboard.uptime30Days },
    { label: '3 Months', value: metric.monitorStatusDashboard.uptime3Months },
    { label: '6 Months', value: metric.monitorStatusDashboard.uptime6Months },
  ];

  // Transform history data and find offline periods
  const chartData = metric.monitorStatusDashboard.historyData
    .slice()
    .reverse()
    .map((item, index) => ({
      time: convertUTCToLocalTime(item.timeStamp),
      responseTime: item.status ? item.responseTime : 0,
      status: item.status,
      index,
      // Store original UTC time for reference if needed
      utcTime: item.timeStamp
    }));

  // Find offline periods (consecutive offline points)
  const offlinePeriods = chartData.reduce((periods: { start: number; end: number }[], point, index) => {
    if (!point.status) {
      const currentPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
      
      if (currentPeriod && currentPeriod.end === index - 1) {
        // Extend current period
        currentPeriod.end = index;
      } else {
        // Start new period
        periods.push({ start: index, end: index });
      }
    }
    return periods;
  }, []);

  return (
    <div className="h-full p-6 overflow-y-auto dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">{metric.name}</h1>
          <div className="flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {metric.monitorTypeId === 3 && metric.monitorTcp ? (
              <>
                <Network className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-sm dark:text-gray-400 text-gray-600 truncate">
                  {`${metric.monitorTcp}`}
                </span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-sm dark:text-gray-400 text-gray-600 truncate">
                  {metric.urlToCheck || 'No URL specified'}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {/* TODO: Implement pause/resume */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            {metric.paused ? (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            )}
          </button>

          <button
            onClick={() => {/* TODO: Implement edit */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          <button
            onClick={() => {/* TODO: Implement alerts */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Bell className="w-4 h-4" />
            Alerts
          </button>

          <button
            onClick={() => {/* TODO: Implement notifications */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            Notifications
          </button>

          <button
            onClick={() => {/* TODO: Implement charts */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <LineChart className="w-4 h-4" />
            Charts
          </button>

          <button
            onClick={() => {/* TODO: Implement delete */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                     text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40
                     transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Activity className={`w-6 h-6 ${metric.status ? 'dark:text-green-400 text-green-500' : 'dark:text-red-400 text-red-500'}`} />
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Current Status</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">
                {metric.status ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* New Type Card */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              {typeInfo.icon}
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Monitor Type</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">
                {typeInfo.label}
              </p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Clock className="w-6 h-6 dark:text-yellow-400 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Response Time</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">
                {metric.monitorStatusDashboard.responseTime.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        {metric.checkCertExpiry && (
          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <CheckCircle className="w-6 h-6 dark:text-purple-400 text-purple-500" />
              </div>
              <div>
                <p className="text-sm dark:text-gray-400 text-gray-600">SSL Certificate</p>
                <p className="text-2xl font-bold dark:text-white text-gray-900">
                  {metric.daysToExpireCert} days
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Uptime Metrics */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Uptime</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {uptimeMetrics.map(({ label, value }) => (
            <UptimeBlock key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      {/* Response Time Chart */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium dark:text-white text-gray-900 mb-4">Response Time History</h2>
        
        <StatusTimeline historyData={metric.monitorStatusDashboard.historyData} />
        
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="time" 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => value.split(':')[0] + ':' + value.split(':')[1]}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                unit="ms"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#F3F4F6'
                }}
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value: number, name: string) => {
                  if (name === 'responseTime') {
                    return [`${value}ms`, 'Response Time'];
                  }
                  return [value, name];
                }}
              />
              
              {/* Offline period areas */}
              {offlinePeriods.map((period, index) => (
                <ReferenceArea
                  key={index}
                  x1={chartData[period.start].time}
                  x2={chartData[period.end].time}
                  fill="#EF444422"
                  fillOpacity={0.3}
                />
              ))}

              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#5CD4E2"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend for offline periods */}
        {offlinePeriods.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 bg-opacity-30 rounded"></div>
            <span className="text-sm dark:text-gray-400 text-gray-600">
              Offline Periods
            </span>
          </div>
        )}
      </div>
    </div>
  );
}