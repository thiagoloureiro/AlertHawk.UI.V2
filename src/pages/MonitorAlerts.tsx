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
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="xl" text="Loading alerts..." />
      </div>
    );
  }

  const selectClass =
    'w-full px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Monitoring
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Monitor alerts
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Recent monitor and metrics alert events
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full xl:w-auto xl:max-w-4xl">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className={selectClass}
              aria-label="Time period"
            >
              {timePeriods.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={selectClass}
              aria-label="Type"
            >
              {typeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={selectedCluster}
              onChange={(e) => setSelectedCluster(e.target.value)}
              className={selectClass}
              aria-label="Cluster"
            >
              <option value="">All clusters</option>
              {clusters.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className={selectClass}
              aria-label="Environment"
            >
              {environmentOptions.map((env) => (
                <option key={env.value} value={env.value}>
                  {env.label}
                </option>
              ))}
            </select>
            <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search alerts…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 lg:p-6 pt-4">
        {error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/50 flex items-center justify-center z-10">
                  <LoadingSpinner size="lg" />
                </div>
              )}

              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    {tableHeaders.map(({ label, key }) => (
                      <th
                        key={key}
                        className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {paginatedAlerts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tableHeaders.length}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No alerts found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    paginatedAlerts.map((alert) => (
                      <tr
                        key={`${alert.type}-${alert.id}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/60"
                      >
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">
                          {convertUTCToLocal(alert.timeStamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                              alert.type === 'monitor'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {alert.type === 'monitor' ? 'Monitor' : 'Metrics'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {alert.type === 'monitor' ? (
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {alert.monitorName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {alert.urlToCheck}
                              </div>
                              <div className="mt-1">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                                    alert.environment === 6
                                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                      : alert.environment === 2
                                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                  }`}
                                >
                                  {getEnvironmentName(alert.environment)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {alert.clusterName}
                              </div>
                              {alert.nodeName && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Node: {alert.nodeName}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{alert.message}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {alert.type === 'monitor' ? (
                            <div className="text-xs">Offline: {alert.periodOffline} min</div>
                          ) : (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                                    alert.status
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  }`}
                                >
                                  {alert.status ? 'Healthy' : 'Unhealthy'}
                                </span>
                              </div>
                              {alert.metricName && <div>Metric: {alert.metricName}</div>}
                              {alert.threshold !== undefined && alert.currentValue !== undefined && (
                                <div className="text-gray-500 dark:text-gray-400">
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

        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">Records per page</label>
              <select
                value={recordsPerPage}
                onChange={(e) => {
                  setRecordsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-md text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {recordsPerPageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                Page {currentPage} of {Math.max(totalPages, 1)}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
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