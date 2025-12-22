import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import { AlertIncident, MetricsAlert, getEnvironmentName } from '../types';
import { convertUTCToLocal } from '../utils/dateUtils';
import { useParams, useSearchParams } from 'react-router-dom';
import monitorService from '../services/monitorService';
import metricsService from '../services/metricsService';
import { toast } from 'react-hot-toast';

// Unified alert type for display
type UnifiedAlert = (AlertIncident & { type: 'monitor' }) | (MetricsAlert & { type: 'metrics' });

const timePeriods = [
  { value: '7', label: 'Last 7 Days' },
  { value: '15', label: 'Last 15 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' }
];

const environmentOptions = [
  { value: '0', label: 'All Environments' },
  { value: '1', label: 'Development' },
  { value: '2', label: 'Staging' },
  { value: '3', label: 'QA' },
  { value: '4', label: 'Testing' },
  { value: '5', label: 'PreProd' },
  { value: '6', label: 'Production' }
];

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'metrics', label: 'Metrics' }
];

const recordsPerPageOptions = [10, 25, 50, 100];

const tableHeaders = [
  { label: 'Timestamp', key: 'timeStamp' },
  { label: 'Type', key: 'type' },
  { label: 'Source', key: 'source' },
  { label: 'Message', key: 'message' },
  { label: 'Details', key: 'details' }
] as const;

export function MonitorAlerts() {
  const { monitorId } = useParams<{ monitorId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<UnifiedAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<UnifiedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [selectedEnvironment, setSelectedEnvironment] = useState('0');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCluster, setSelectedCluster] = useState<string>(searchParams.get('cluster') || '');
  const [clusters, setClusters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);

  // Fetch clusters on mount
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const clusterList = await metricsService.getClusters();
        setClusters(clusterList);
      } catch (err) {
        console.error('Failed to fetch clusters:', err);
        // Don't show error toast as it's not critical
      }
    };
    fetchClusters();
  }, []);

  // Update URL when cluster filter changes (but not on initial mount)
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selectedCluster) {
      setSearchParams({ cluster: selectedCluster }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedCluster, setSearchParams]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const id = monitorId ? parseInt(monitorId, 10) : 0;
        const days = parseInt(selectedPeriod, 10);
        
        // Fetch both monitor alerts and metrics alerts in parallel
        // Use cluster filter for metrics alerts if selected
        const [monitorAlertsData, metricsAlertsData] = await Promise.all([
          monitorService.getMonitorAlerts(id, days).catch(err => {
            console.error('Failed to fetch monitor alerts:', err);
            toast.error('Failed to fetch monitor alerts', { position: 'bottom-right' });
            return [];
          }),
          metricsService.getMetricsAlerts(
            days,
            selectedCluster || undefined,
            undefined
          ).catch(err => {
            console.error('Failed to fetch metrics alerts:', err);
            toast.error('Failed to fetch metrics alerts', { position: 'bottom-right' });
            return [];
          })
        ]);

        // Combine and tag the alerts
        const monitorAlerts: UnifiedAlert[] = monitorAlertsData.map(alert => ({
          ...alert,
          type: 'monitor' as const
        }));
        
        const metricsAlerts: UnifiedAlert[] = metricsAlertsData.map(alert => ({
          ...alert,
          type: 'metrics' as const
        }));

        // Combine and sort by timestamp in descending order
        const combined = [...monitorAlerts, ...metricsAlerts];
        const sorted = combined.sort((a, b) => {
          return new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime();
        });
        
        setAlerts(sorted);
        setFilteredAlerts(sorted);
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
        toast.error('Failed to fetch alerts', { position: 'bottom-right' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [monitorId, selectedPeriod, selectedCluster]);

  // Filter alerts based on search term, environment, type, and cluster
  useEffect(() => {
    let filtered = alerts;

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(alert => alert.type === selectedType);
    }

    // Apply cluster filter (only for metrics alerts, as monitor alerts don't have cluster)
    if (selectedCluster) {
      filtered = filtered.filter(alert => {
        if (alert.type === 'metrics') {
          return alert.clusterName === selectedCluster;
        }
        // For monitor alerts, show all when cluster filter is set
        return true;
      });
    }

    // Apply environment filter (only for monitor alerts)
    if (selectedEnvironment !== '0') {
      filtered = filtered.filter(alert => {
        if (alert.type === 'monitor') {
          return alert.environment === parseInt(selectedEnvironment, 10);
        }
        // For metrics alerts, show all
        return true;
      });
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(alert => {
        if (alert.type === 'monitor') {
          return (
            alert.monitorName.toLowerCase().includes(searchLower) ||
            alert.message.toLowerCase().includes(searchLower) ||
            alert.urlToCheck.toLowerCase().includes(searchLower)
          );
        } else {
          // Metrics alert
          return (
            alert.clusterName.toLowerCase().includes(searchLower) ||
            alert.message.toLowerCase().includes(searchLower) ||
            (alert.nodeName && alert.nodeName.toLowerCase().includes(searchLower))
          );
        }
      });
    }

    setFilteredAlerts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, alerts, selectedEnvironment, selectedType, selectedCluster]);

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / recordsPerPage);
  const paginatedAlerts = filteredAlerts.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
        <LoadingSpinner size="xl" text="Loading alerts..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
      <div className="p-6">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {timePeriods.map(period => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Type
            </label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {typeOptions.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Cluster
            </label>
            <select
              value={selectedCluster}
              onChange={e => setSelectedCluster(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              <option value="">All Clusters</option>
              {clusters.map(cluster => (
                <option key={cluster} value={cluster}>{cluster}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Environment
            </label>
            <select
              value={selectedEnvironment}
              onChange={e => setSelectedEnvironment(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {environmentOptions.map(env => (
                <option key={env.value} value={env.value}>{env.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 dark:text-gray-400 text-gray-500" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                         border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                         dark:focus:ring-blue-400 transition-colors duration-200"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-6">
  
        {error ? (
          <div className="rounded-lg dark:bg-red-900/20 bg-red-50 p-4 mb-4 flex items-center gap-3
                        dark:text-red-200 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative flex-1 overflow-auto">
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/50 flex items-center justify-center">
                  <LoadingSpinner size="lg" />
                </div>
              )}
              
              <table className="w-full dark:bg-gray-800 bg-white rounded-lg shadow-xs">
                <thead>
                  <tr className="dark:bg-gray-700 bg-gray-50">
                    {tableHeaders.map(({ label, key }) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} className="px-4 py-8 text-center dark:text-gray-400 text-gray-500">
                        No alerts found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    paginatedAlerts.map(alert => (
                      <tr key={`${alert.type}-${alert.id}`} className="dark:hover:bg-gray-700 hover:bg-gray-50 
                                                  border-t dark:border-gray-700 border-gray-200
                                                  transition-colors duration-200">
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {convertUTCToLocal(alert.timeStamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium
                                           ${alert.type === 'monitor'
                                             ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                                             : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200'}`}>
                            {alert.type === 'monitor' ? 'Monitor' : 'Metrics'}
                          </span>
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {alert.type === 'monitor' ? (
                            <div>
                              <div className="font-medium">{alert.monitorName}</div>
                              <div className="text-sm text-gray-500">{alert.urlToCheck}</div>
                              <div className="mt-1">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                                                 ${alert.environment === 6 
                                                   ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                                   : alert.environment === 2 
                                                     ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                                                     : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'}`}>
                                  {getEnvironmentName(alert.environment)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{alert.clusterName}</div>
                              {alert.nodeName && (
                                <div className="text-sm text-gray-500">Node: {alert.nodeName}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {alert.message}
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {alert.type === 'monitor' ? (
                            <div>
                              <div>Offline: {alert.periodOffline} min</div>
                            </div>
                          ) : (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium
                                                 ${alert.status
                                                   ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                                   : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}>
                                  {alert.status ? 'Healthy' : 'Unhealthy'}
                                </span>
                              </div>
                              {alert.metricName && (
                                <div>Metric: {alert.metricName}</div>
                              )}
                              {alert.threshold !== undefined && alert.currentValue !== undefined && (
                                <div className="text-gray-500">
                                  Value: {alert.currentValue} / Threshold: {alert.threshold}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 py-4 border-t dark:border-gray-700 border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm dark:text-gray-300 text-gray-700">
                Records per page:
              </label>
              <select
                value={recordsPerPage}
                onChange={e => {
                  setRecordsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                         dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
              >
                {recordsPerPageOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                         dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                         transition-colors duration-200"
              >
                Previous
              </button>
              <span className="dark:text-gray-300 text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                         dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                         transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}