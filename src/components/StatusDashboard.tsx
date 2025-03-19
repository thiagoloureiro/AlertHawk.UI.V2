import { useState, useEffect } from 'react';
import { Clock, Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import reportService from '../services/reportService';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';

interface UptimeReport {
  monitorName: string;
  totalOnlineMinutes: number;
  totalOfflineMinutes: number;
  uptimePercentage: number;
  monitorStatus: boolean;
}

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

const getStatusColor = (status: boolean): string => {
  return status ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
};

export function StatusDashboard() {
  const { monitorId = '1', hours = '24' } = useParams<{ monitorId: string; hours: string }>();
  const [uptimeData, setUptimeData] = useState<UptimeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await reportService.getUptimeReport(parseInt(monitorId), parseInt(hours));
        setUptimeData(data);
      } catch (error) {
        console.error('Failed to fetch uptime data:', error);
        setError('Failed to load uptime data. Please try again later.');
        toast.error('Failed to load uptime data', { position: 'bottom-right' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Refresh data every 5 minutes
    const intervalId = setInterval(fetchData, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [monitorId, hours]);

  if (isLoading) {
    return (
      <div className="min-h-screen dark:bg-gray-900 bg-gray-50 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading status data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen dark:bg-gray-900 bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-gray-900 bg-gray-50 p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold dark:text-white text-gray-900 mb-2">
            System Status
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last {hours} hours uptime report for all services
          </p>
        </div>

        {/* Overall Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm dark:text-gray-400 text-gray-600">Services Monitored</p>
                <p className="text-2xl font-bold dark:text-white text-gray-900">
                  {uptimeData.length}
                </p>
              </div>
            </div>
          </div>

          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm dark:text-gray-400 text-gray-600">Healthy Services</p>
                <p className="text-2xl font-bold dark:text-white text-gray-900">
                  {uptimeData.filter(service => service.monitorStatus).length}
                </p>
              </div>
            </div>
          </div>

          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm dark:text-gray-400 text-gray-600">Time Period</p>
                <p className="text-2xl font-bold dark:text-white text-gray-900">
                  {hours} Hours
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="grid gap-6">
          {uptimeData.map((service) => (
            <div
              key={service.monitorName}
              className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 dark:bg-gray-700 bg-gray-100 rounded-lg ${getStatusColor(service.monitorStatus)}`}>
                    {service.monitorStatus ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold dark:text-white text-gray-900">
                      {service.monitorName}
                    </h3>
                    <p className={`text-sm ${getStatusColor(service.monitorStatus)}`}>
                      {service.monitorStatus ? 'Healthy' : 'Unhealthy'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100">
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-1">Online</p>
                    <p className="font-semibold dark:text-green-400 text-green-500">
                      {formatMinutes(service.totalOnlineMinutes)}
                    </p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100">
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-1">Offline</p>
                    <p className="font-semibold dark:text-red-400 text-red-500">
                      {formatMinutes(service.totalOfflineMinutes)}
                    </p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100 col-span-2 md:col-span-1">
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-1">Total Time</p>
                    <p className="font-semibold dark:text-blue-400 text-blue-500">
                      {formatMinutes(service.totalOnlineMinutes + service.totalOfflineMinutes)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
          <img 
            src="/assets/logo.png" 
            alt="AlertHawk Logo" 
            className="h-6 w-auto"
          />
          <span className="text-sm font-medium">Powered by AlertHawk</span>
      </div>
    </div>
  );
} 