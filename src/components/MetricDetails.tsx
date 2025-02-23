import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Monitor } from '../types';
import { 
  Clock, Activity, CheckCircle, Globe, Network, 
  Pause, Play, Edit, Bell, MessageSquare, Trash2, Copy, BarChart, Loader2 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { convertUTCToLocalTime } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import monitorService from '../services/monitorService';
import { AddMonitorModal } from './AddMonitorModal';
import { 
  UpdateMonitorHttpPayload,
  UpdateMonitorTcpPayload 
} from '../services/monitorService';
import { NotificationListModal } from './NotificationListModal';

interface MetricDetailsProps {
  metric: Monitor;
}

interface TimePeriod {
  label: string;
  days: number;
}

const TIME_PERIODS: TimePeriod[] = [
  { label: '1 Hour', days: 0 },
  { label: '24 Hours', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 }
];

const StatusTimeline = ({ historyData }: { historyData: { status: boolean; timeStamp: string }[] }) => {
  const userTimeZone = localStorage.getItem('userTimezone') || 
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Sort chronologically (older to newer) but don't limit the points
  const timelineData = [...historyData]
    .filter(point => point.timeStamp)
    .sort((a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime());

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm dark:text-gray-400 text-gray-600 mb-2">
        <span>Status Timeline ({userTimeZone})</span>
        <span>{timelineData.length} checks</span>
      </div>
      <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex gap-px p-px">
        {timelineData.map((point, index) => {
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
                  <div>
                    {new Intl.DateTimeFormat('default', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    }).format(new Date(point.timeStamp))}
                  </div>
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

// Add or update the getMonitorTypeInfo function
const getMonitorTypeInfo = (typeId: number, isOnline: boolean, isPaused: boolean) => {
  const statusColor = isPaused 
    ? 'text-gray-400 dark:text-gray-500'
    : isOnline 
      ? 'text-green-500 dark:text-green-400' 
      : 'text-red-500 dark:text-red-400';
  
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className={`w-5 h-5 ${statusColor}`} />,
        label: 'HTTP(S)'
      };
    case 3:
      return {
        icon: <Network className={`w-5 h-5 ${statusColor}`} />,
        label: 'TCP'
      };
    default:
      return {
        icon: <Globe className={`w-5 h-5 ${statusColor}`} />,
        label: 'Unknown'
      };
  }
};

const UptimeBlock = ({ label, value }: { label: string; value: number }) => {
  const getColorClass = (uptime: number) => {
    if (uptime >= 99) return "bg-green-500 dark:bg-green-400";
    if (uptime >= 95) return "bg-yellow-500 dark:bg-yellow-400";
    return "bg-red-500 dark:bg-red-400";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full h-[76px] dark:bg-gray-700 bg-gray-100 rounded-lg p-2 flex flex-col items-center justify-center">
        <div className={`text-lg font-bold mb-1 ${value >= 95 ? 'dark:text-white text-gray-900' : 'text-red-600 dark:text-red-400'}`}>
          {value.toFixed(2)}%
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${getColorClass(value)}`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <span className="mt-1.5 text-xs dark:text-gray-400 text-gray-600">{label}</span>
    </div>
  );
};

export function MetricDetails({ metric }: MetricDetailsProps) {
  const typeInfo = getMonitorTypeInfo(metric.monitorTypeId, metric.status, metric.paused);
  // Add state for delete confirmation and loading
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add state for pause loading
  const [isPauseLoading, setIsPauseLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null);

  const [showNotifications, setShowNotifications] = useState(false);

  // Add state for clone confirmation
  const [showCloneConfirm, setShowCloneConfirm] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(TIME_PERIODS[1]); // Default to 24 hours
  const [historyData, setHistoryData] = useState<MonitorHistoryPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistoryData = async (period: TimePeriod) => {
    try {
      setIsLoadingHistory(true);
      const data = await monitorService.getMonitorHistory(metric.id, period.days);
      setHistoryData(data);
    } catch (error) {
      console.error('Failed to load history data:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistoryData(selectedPeriod);
  }, [selectedPeriod, metric.id]);

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

  // Add delete handler
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await monitorService.deleteMonitor(metric.id);
      if (success) {
        toast.success('Monitor deleted successfully', { position: 'bottom-right' });
        // Refresh dashboard data with current environment
        await monitorService.getDashboardGroups(metric.monitorEnvironment);
        // Force a full page refresh to update all data
        window.location.href = '/dashboard';
      } else {
        toast.error('Failed to delete monitor', { position: 'bottom-right' });
      }
    } catch {
      toast.error('Failed to delete monitor', { position: 'bottom-right' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Add pause handler
  const handlePauseToggle = async () => {
    setIsPauseLoading(true);
    try {
      const success = await monitorService.toggleMonitorPause(metric.id, !metric.paused);
      if (success) {
        toast.success(`Monitor ${metric.paused ? 'resumed' : 'paused'} successfully`, { position: 'bottom-right' });
        // Refresh the page to show updated status
        window.location.reload();
      } else {
        toast.error(`Failed to ${metric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
      }
    } catch {
      toast.error(`Failed to ${metric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
    } finally {
      setIsPauseLoading(false);
    }
  };

  // Add handler for edit button
  const handleEditClick = async () => {
    if (metric.monitorTypeId === 3) {
      try {
        const tcpDetails = await monitorService.getMonitorTcpDetails(metric.id);
        // Create a monitor object that matches the expected structure
        const monitorData: Monitor = {
          ...tcpDetails,
          monitorTcp: {
            host: tcpDetails.ip,
            port: tcpDetails.port
          },
          urlToCheck: '',  // Required by Monitor type but not used for TCP
          monitorStatusDashboard: metric.monitorStatusDashboard  // Keep the dashboard data
        };
        setMonitorToEdit(monitorData);
        setShowEditModal(true);
      } catch (error) {
        console.error('Failed to fetch TCP monitor details:', error);
        toast.error('Failed to load monitor details', { position: 'bottom-right' });
      }
    } else {
      setShowEditModal(true);
    }
  };

  // Add clone handler
  const handleClone = async () => {
    setIsCloning(true);
    try {
      await monitorService.cloneMonitor(metric.id);
      toast.success('Monitor cloned successfully', { position: 'bottom-right' });
      window.location.reload();
    } catch (error) {
      console.error('Failed to clone monitor:', error);
      toast.error('Failed to clone monitor', { position: 'bottom-right' });
    } finally {
      setIsCloning(false);
      setShowCloneConfirm(false);
    }
  };

  // Add this function before the return statement
  const getOfflinePeriods = (data: MonitorHistoryPoint[]) => {
    const periods: { start: string; end: string; }[] = [];
    let currentPeriod: { start: string; end: string; } | null = null;

    data.forEach((point, index) => {
      if (point.responseTime === 0 && !currentPeriod) {
        currentPeriod = { start: point.timeStamp, end: point.timeStamp };
      } else if (point.responseTime === 0 && currentPeriod) {
        currentPeriod.end = point.timeStamp;
      } else if (point.responseTime !== 0 && currentPeriod) {
        periods.push(currentPeriod);
        currentPeriod = null;
      }
    });

    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    return periods;
  };

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
            onClick={handlePauseToggle}
            disabled={isPauseLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            {isPauseLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : metric.paused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            {isPauseLoading ? 'Processing...' : (metric.paused ? 'Resume' : 'Pause')}
          </button>

          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          <Link 
            to={`/monitor/${metric.id}/alerts`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Bell className="w-4 h-4" />
            Alerts
          </Link>

          <button
            onClick={() => setShowNotifications(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            Notifications
          </button>

          <button
            onClick={() => {/* TODO: Implement chart functionality */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <BarChart className="w-4 h-4" />
            Chart
          </button>

          <button
            onClick={() => setShowCloneConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Copy className="w-4 h-4" />
            Clone
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
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
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Activity className={`w-5 h-5 ${
                metric.paused 
                  ? 'dark:text-gray-400 text-gray-500'
                  : metric.status 
                    ? 'dark:text-green-400 text-green-500' 
                    : 'dark:text-red-400 text-red-500'
              }`} />
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Current Status</p>
              <p className={`text-xl font-bold ${
                metric.paused 
                  ? 'dark:text-gray-400 text-gray-500'
                  : metric.status 
                    ? 'dark:text-green-400 text-green-500' 
                    : 'dark:text-red-400 text-red-500'
              }`}>
                {metric.paused ? 'Paused' : (metric.status ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>

        {/* Type Card */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              {getMonitorTypeInfo(metric.monitorTypeId, metric.status, metric.paused).icon}
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Monitor Type</p>
              <p className="text-xl font-bold dark:text-white text-gray-900">
                {getMonitorTypeInfo(metric.monitorTypeId, metric.status, metric.paused).label}
              </p>
            </div>
          </div>
        </div>

        {/* Response Time Card */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 dark:text-yellow-400 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Response Time</p>
              <p className="text-xl font-bold dark:text-white text-gray-900">
                {metric.monitorStatusDashboard.responseTime.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        {/* SSL Certificate Card */}
        {metric.checkCertExpiry && (
          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <CheckCircle className="w-5 h-5 dark:text-purple-400 text-purple-500" />
              </div>
              <div>
                <p className="text-xs dark:text-gray-400 text-gray-600">SSL Certificate</p>
                <p className="text-xl font-bold dark:text-white text-gray-900">
                  {metric.daysToExpireCert} days
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.label}
            onClick={() => setSelectedPeriod(period)}
            className={`p-4 rounded-lg ${
              selectedPeriod === period
                ? 'bg-blue-500 text-white'
                : 'dark:bg-gray-700 bg-white hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-100'
            } transition-colors duration-200`}
          >
            <div className="text-sm font-medium mb-1">{period.label}</div>
            <div className="text-2xl font-bold">
              {period.label === '1 Hour'
                ? metric.monitorStatusDashboard.uptime1Hr
                : period.label === '24 Hours'
                ? metric.monitorStatusDashboard.uptime24Hrs
                : period.label === '7 Days'
                ? metric.monitorStatusDashboard.uptime7Days
                : period.label === '30 Days'
                ? metric.monitorStatusDashboard.uptime30Days
                : period.label === '3 Months'
                ? metric.monitorStatusDashboard.uptime3Months
                : metric.monitorStatusDashboard.uptime6Months}%
            </div>
          </button>
        ))}
      </div>

      {/* Status Timeline */}
      <StatusTimeline historyData={historyData} />

      {/* Response Time Chart */}
      <div className="h-64 mt-6 relative">
        {isLoadingHistory && (
          <div className="absolute inset-0 bg-gray-900/20 dark:bg-gray-900/40 flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={[...historyData].sort((a, b) => 
              new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime()
            )}
          >
            {getOfflinePeriods(historyData).map((period, index) => (
              <ReferenceArea
                key={index}
                x1={period.start}
                x2={period.end}
                fill="#EF444460"
              />
            ))}
            <XAxis 
              dataKey="timeStamp" 
              tickFormatter={(time) => {
                const date = new Date(time);
                return new Intl.DateTimeFormat('default', {
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }).format(date);
              }}
              angle={-45}
              textAnchor="end"
              height={70}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              padding={{ left: 20, right: 20 }}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(label) => {
                const date = new Date(label as string);
                return new Intl.DateTimeFormat('default', {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }).format(date);
              }}
              formatter={(value, name, props) => {
                if (value === 0) {
                  return [<span style={{ color: '#EF4444' }}>Offline</span>, 'Status'];
                }
                return [`${value}ms`, 'Response Time'];
              }}
              contentStyle={{ 
                backgroundColor: '#1F2937',
                color: '#fff'
              }}
            />
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Delete Monitor
            </h3>
            
            <p className="dark:text-gray-300 text-gray-700 mb-6">
              Are you sure you want to delete monitor "{metric.name}"? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Monitor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Edit Modal */}
      {showEditModal && (
        <AddMonitorModal
          onClose={() => setShowEditModal(false)}
          onAdd={async () => {}}
          onUpdate={async (updatedMonitor) => {
            try {
              const success = metric.monitorTypeId === 3
                ? await monitorService.updateMonitorTcp(updatedMonitor as UpdateMonitorTcpPayload)
                : await monitorService.updateMonitorHttp(updatedMonitor as UpdateMonitorHttpPayload);
              
              if (success) {
                toast.success('Monitor updated successfully', { position: 'bottom-right' });
                setShowEditModal(false);
                window.location.reload();
              }
            } catch (error) {
              console.error('Failed to update monitor:', error);
              toast.error('Failed to update monitor', { position: 'bottom-right' });
            }
          }}
          existingMonitor={monitorToEdit || metric}
          isEditing={true}
        />
      )}

      {showNotifications && (
        <NotificationListModal
          monitorId={metric.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Add clone confirmation modal */}
      {showCloneConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Clone Monitor
            </h3>
            
            <p className="dark:text-gray-300 text-gray-700 mb-6">
              Are you sure you want to clone monitor "{metric.name}"? A new monitor will be created with name "{metric.name}_Clone".
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCloneConfirm(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={isCloning}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Clone Monitor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}