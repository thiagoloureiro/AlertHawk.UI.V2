import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  HardDrive,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { PVCMetric } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import { LoadingSpinner } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatBytesGb(bytes: number): string {
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-3 py-2 text-sm">
      <div className="font-medium text-gray-200 border-b border-gray-600 pb-1 mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-gray-300">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium">{formatBytesGb(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function VolumeMetrics() {
  const [pvcMetrics, setPvcMetrics] = useState<PVCMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(1440);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clusters, setClusters] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);

  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const data = await metricsService.getPvcMetrics(
        selectedNamespace || undefined,
        minutes,
        selectedCluster || undefined
      );
      setPvcMetrics(data);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Failed to fetch PVC metrics:', err);
      setError('Failed to load volume metrics');
      toast.error('Failed to load volume metrics', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedCluster) {
      fetchMetrics(!isInitialLoad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, selectedCluster, selectedNamespace]);

  const getCurrentUser = () => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  };

  const fetchClusters = async () => {
    try {
      const list = await metricsService.getClusters();
      setClusters(list);
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
      toast.error('Failed to load clusters', { position: 'bottom-right' });
    }
  };

  const fetchUserClusters = async () => {
    const user = getCurrentUser();
    if (!user?.id) return;
    try {
      const data = await userService.getUserClusters(user.id);
      setUserClusters(data.map((uc: { clusterName: string }) => uc.clusterName));
    } catch (err) {
      console.error('Failed to fetch user clusters:', err);
    }
  };

  const fetchNamespaces = async () => {
    if (!selectedCluster) return;
    try {
      const list = await metricsService.getNamespaces(selectedCluster);
      setNamespaces(list);
    } catch (err) {
      console.error('Failed to fetch namespaces:', err);
      toast.error('Failed to load namespaces', { position: 'bottom-right' });
    }
  };

  const uniqueClusters = useMemo(() => {
    const user = getCurrentUser();
    if (user?.isAdmin) {
      return [...clusters].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    if (userClusters.length === 0) return [];
    return clusters
      .filter((c) => userClusters.includes(c))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [clusters, userClusters]);

  const uniqueNamespaces = useMemo(() => {
    return [...namespaces].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [namespaces]);

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchClusters(), fetchUserClusters()]);
      setClustersLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedCluster) {
      fetchNamespaces();
    }
  }, [selectedCluster]);

  useEffect(() => {
    if (uniqueClusters.length > 0 && !selectedCluster) {
      setSelectedCluster(uniqueClusters[0]);
    } else if (selectedCluster && !uniqueClusters.includes(selectedCluster)) {
      setSelectedCluster(uniqueClusters[0] ?? null);
      setSelectedNamespace(null);
    } else if (uniqueClusters.length === 0 && selectedCluster) {
      setSelectedCluster(null);
      setSelectedNamespace(null);
    }
  }, [uniqueClusters, selectedCluster]);

  // Chart data: time series of used bytes per PVC (by pvcName + pod to distinguish same volume on different pods)
  const chartData = useMemo(() => {
    if (!pvcMetrics.length) return [];

    const dataMap = new Map<
      string,
      { timestamp: string; timestampValue: number; [key: string]: string | number }
    >();

    const seriesKeys = new Set<string>();

    pvcMetrics.forEach((m) => {
      const date = getLocalDateFromUTC(m.timestamp);
      const timeKey = date ? formatCompactDate(date) : m.timestamp;
      const timestampValue = date ? date.getTime() : new Date(m.timestamp).getTime();
      const seriesKey = `${m.volumeName} (${m.pod})`;

      seriesKeys.add(seriesKey);

      if (!dataMap.has(timeKey)) {
        dataMap.set(timeKey, { timestamp: timeKey, timestampValue });
      }
      const entry = dataMap.get(timeKey)!;
      entry[seriesKey] = m.usedBytes;
    });

    return Array.from(dataMap.values()).sort(
      (a, b) => (a.timestampValue as number) - (b.timestampValue as number)
    );
  }, [pvcMetrics]);

  // Latest value per PVC (for table and summary)
  const latestByPvc = useMemo(() => {
    const map = new Map<string, PVCMetric>();
    pvcMetrics.forEach((m) => {
      const key = `${m.clusterName}/${m.pvcNamespace}/${m.pvcName}/${m.pod}`;
      const existing = map.get(key);
      if (!existing || new Date(m.timestamp) > new Date(existing.timestamp)) {
        map.set(key, m);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.volumeName !== b.volumeName) return a.volumeName.localeCompare(b.volumeName);
      return a.pod.localeCompare(b.pod);
    });
  }, [pvcMetrics]);

  const chartColors = [
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
  ];

  const uniqueSeriesKeys = useMemo(() => {
    const keys = new Set<string>();
    pvcMetrics.forEach((m) => keys.add(`${m.volumeName} (${m.pod})`));
    return Array.from(keys).sort();
  }, [pvcMetrics]);

  const hasNoPermissions =
    clustersLoaded && uniqueClusters.length === 0 && !getCurrentUser()?.isAdmin;

  if (!clustersLoaded || (isInitialLoad && !selectedCluster)) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (hasNoPermissions) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">
            No Cluster Permissions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don&apos;t have permission to view any clusters. Please contact your administrator
            to request access to volume metrics.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 text-lg">{error}</p>
          <button
            onClick={() => fetchMetrics()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold dark:text-white text-gray-900 flex items-center gap-2">
              <HardDrive className="w-8 h-8 text-indigo-500" />
              Volume Metrics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              PVC disk usage and capacity across clusters and namespaces
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Cluster:
              </span>
              <select
                value={selectedCluster ?? ''}
                onChange={(e) => {
                  setSelectedCluster(e.target.value || null);
                  setSelectedNamespace(null);
                }}
                className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {uniqueClusters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Namespace:
              </span>
              <select
                value={selectedNamespace ?? ''}
                onChange={(e) => setSelectedNamespace(e.target.value || null)}
                className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All namespaces</option>
                {uniqueNamespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>Last 5 minutes</option>
              <option value={10}>Last 10 minutes</option>
              <option value={30}>Last 30 minutes</option>
              <option value={60}>Last 1 hour</option>
              <option value={360}>Last 6 hours</option>
              <option value={1440}>Last 24 hours</option>
              <option value={2880}>Last 48 hours</option>
              <option value={10080}>Last 7 days</option>
            </select>
            <button
              onClick={() => fetchMetrics(false)}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {selectedCluster && (
          <>
            {/* Table */}
            <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <h2 className="text-lg font-semibold dark:text-white text-gray-900 p-4 pb-0">
                PVC details (latest)
              </h2>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Namespace</th>
                      <th className="px-4 py-3">Pod</th>
                      <th className="px-4 py-3">Volume</th>
                      <th className="px-4 py-3">PVC name</th>
                      <th className="px-4 py-3 text-right">Used</th>
                      <th className="px-4 py-3 text-right">Available</th>
                      <th className="px-4 py-3 text-right">Capacity</th>
                      <th className="px-4 py-3 text-right">Usage %</th>
                      <th className="px-4 py-3">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {latestByPvc.map((m) => {
                      const pct =
                        m.capacityBytes > 0
                          ? ((m.usedBytes / m.capacityBytes) * 100).toFixed(1)
                          : '0';
                      const isHigh = parseFloat(pct) >= 85;
                      const isWarn = parseFloat(pct) >= 70 && parseFloat(pct) < 85;
                      return (
                        <tr
                          key={`${m.clusterName}-${m.pvcName}-${m.pod}`}
                          className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {m.namespace}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.pod}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {m.volumeName}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {m.pvcName}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {formatBytes(m.usedBytes)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {formatBytes(m.availableBytes)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {formatBytes(m.capacityBytes)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={
                                isHigh
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : isWarn
                                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                                    : 'text-gray-700 dark:text-gray-300'
                              }
                            >
                              {pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                            {getLocalDateFromUTC(m.timestamp)
                              ? formatCompactDate(getLocalDateFromUTC(m.timestamp)!)
                              : m.timestamp}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {latestByPvc.length === 0 && !isLoading && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No PVC metrics found for the selected cluster and namespace.
                </div>
              )}
            </div>

            {/* Chart: Disk used over time per volume */}
            {chartData.length > 0 && uniqueSeriesKeys.length > 0 && (
              <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <h2 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">
                  Disk usage over time
                </h2>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 11 }}
                        className="text-gray-600 dark:text-gray-400"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatBytesGb(v)}
                        className="text-gray-600 dark:text-gray-400"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {uniqueSeriesKeys.map((key, i) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
                          stroke={chartColors[i % chartColors.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
