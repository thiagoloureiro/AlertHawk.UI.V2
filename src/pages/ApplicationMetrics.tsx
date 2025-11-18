import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend 
} from 'recharts';
import { 
  Package, Cpu, HardDrive, RefreshCw, Clock, 
  Activity, AlertCircle, Layers, Network
} from 'lucide-react';
import { NamespaceMetric } from '../types';
import metricsService from '../services/metricsService';
import { LoadingSpinner } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

export function ApplicationMetrics() {
  const [namespaceMetrics, setNamespaceMetrics] = useState<NamespaceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch namespace metrics
  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      const metrics = await metricsService.getNamespaceMetrics(hours, 1000);
      setNamespaceMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch namespace metrics:', err);
      setError('Failed to load application metrics');
      toast.error('Failed to load application metrics', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  // Get unique clusters
  const uniqueClusters = useMemo(() => {
    const clusters = new Set(namespaceMetrics.map(m => m.clusterName));
    return Array.from(clusters).sort();
  }, [namespaceMetrics]);

  // Filter metrics by selected cluster
  const filteredMetrics = useMemo(() => {
    let metrics = namespaceMetrics;
    if (selectedCluster) {
      metrics = metrics.filter(m => m.clusterName === selectedCluster);
    }
    return metrics;
  }, [namespaceMetrics, selectedCluster]);

  // Get unique namespaces (from filtered metrics)
  const uniqueNamespaces = useMemo(() => {
    const namespaces = new Set(filteredMetrics.map(m => m.namespace));
    return Array.from(namespaces).sort();
  }, [filteredMetrics]);

  // Get unique pods (filtered by namespace if selected, from filtered metrics)
  const uniquePods = useMemo(() => {
    const pods = new Set(
      filteredMetrics
        .filter(m => !selectedNamespace || m.namespace === selectedNamespace)
        .map(m => m.pod)
    );
    return Array.from(pods).sort();
  }, [filteredMetrics, selectedNamespace]);

  // Get latest metrics for each pod (from filtered metrics)
  const latestPodMetrics = useMemo(() => {
    const podMap = new Map<string, NamespaceMetric>();
    filteredMetrics.forEach(metric => {
      if (selectedNamespace && metric.namespace !== selectedNamespace) return;
      if (selectedPod && metric.pod !== selectedPod) return;

      const key = `${metric.namespace}/${metric.pod}/${metric.container}`;
      const existing = podMap.get(key);
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        podMap.set(key, metric);
      }
    });
    return Array.from(podMap.values()).sort((a, b) => {
      if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
      if (a.pod !== b.pod) return a.pod.localeCompare(b.pod);
      return a.container.localeCompare(b.container);
    });
  }, [filteredMetrics, selectedNamespace, selectedPod]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const dataMap = new Map<string, {
      timestamp: string;
      timestampValue: number;
      [key: string]: string | number;
    }>();

    const metricsToProcess = filteredMetrics.filter(m => {
      if (selectedNamespace && m.namespace !== selectedNamespace) return false;
      if (selectedPod && m.pod !== selectedPod) return false;
      return true;
    });

    metricsToProcess.forEach(metric => {
      const date = getLocalDateFromUTC(metric.timestamp);
      const timestampValue = date ? date.getTime() : new Date(metric.timestamp).getTime();
      const timeKey = date ? formatCompactDate(date) : metric.timestamp;

      if (!dataMap.has(timeKey)) {
        dataMap.set(timeKey, { timestamp: timeKey, timestampValue });
      }

      const entry = dataMap.get(timeKey)!;
      const key = `${metric.namespace}/${metric.pod}/${metric.container}`;
      
      // CPU percentage (only if limit exists)
      if (metric.cpuLimitCores !== null) {
        entry[`${key}_cpu`] = ((metric.cpuUsageCores / metric.cpuLimitCores) * 100);
      } else {
        entry[`${key}_cpu`] = metric.cpuUsageCores;
      }
      
      // Memory usage (in MB for readability)
      entry[`${key}_memory`] = metric.memoryUsageBytes / (1024 * 1024);
    });

    return Array.from(dataMap.values())
      .sort((a, b) => (a.timestampValue as number) - (b.timestampValue as number));
  }, [filteredMetrics, selectedNamespace, selectedPod]);

  // Calculate namespace-wide statistics
  const namespaceStats = useMemo(() => {
    const statsMap = new Map<string, {
      namespace: string;
      podCount: number;
      containerCount: number;
      totalCpuUsage: number;
      totalMemoryUsage: number;
      podsWithLimits: number;
      totalCpuLimit: number;
    }>();

    latestPodMetrics.forEach(metric => {
      if (!statsMap.has(metric.namespace)) {
        statsMap.set(metric.namespace, {
          namespace: metric.namespace,
          podCount: 0,
          containerCount: 0,
          totalCpuUsage: 0,
          totalMemoryUsage: 0,
          podsWithLimits: 0,
          totalCpuLimit: 0
        });
      }

      const stats = statsMap.get(metric.namespace)!;
      stats.totalCpuUsage += metric.cpuUsageCores;
      stats.totalMemoryUsage += metric.memoryUsageBytes;
      
      if (metric.cpuLimitCores !== null) {
        stats.totalCpuLimit += metric.cpuLimitCores;
        stats.podsWithLimits++;
      }
    });

    // Count unique pods and containers per namespace
    latestPodMetrics.forEach(metric => {
      const stats = statsMap.get(metric.namespace)!;
      const podKey = `${metric.namespace}/${metric.pod}`;
      const containerKey = `${metric.namespace}/${metric.pod}/${metric.container}`;
      
      // This is a simplified count - in a real scenario you'd track unique pods/containers
      stats.containerCount++;
    });

    // Count unique pods per namespace
    const podCounts = new Map<string, Set<string>>();
    latestPodMetrics.forEach(metric => {
      if (!podCounts.has(metric.namespace)) {
        podCounts.set(metric.namespace, new Set());
      }
      podCounts.get(metric.namespace)!.add(metric.pod);
    });

    podCounts.forEach((pods, namespace) => {
      const stats = statsMap.get(namespace);
      if (stats) {
        stats.podCount = pods.size;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => 
      a.namespace.localeCompare(b.namespace)
    );
  }, [latestPodMetrics]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  // Get color based on usage percentage
  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUsageBgColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner text="Loading application metrics..." />
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold dark:text-white text-gray-900">Application Metrics</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor pod and container CPU and memory usage across namespaces
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Cluster Selector */}
            <select
              value={selectedCluster || ''}
              onChange={(e) => {
                setSelectedCluster(e.target.value || null);
                setSelectedNamespace(null); // Clear namespace selection when cluster changes
                setSelectedPod(null); // Clear pod selection when cluster changes
              }}
              className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                       focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
            >
              <option value="">All Clusters</option>
              {uniqueClusters.map(cluster => (
                <option key={cluster} value={cluster}>{cluster}</option>
              ))}
            </select>
            {/* Time Range Selector */}
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                       focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
            <button
              onClick={() => fetchMetrics(false)}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                       flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Namespace Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Namespaces</h3>
              <Layers className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {uniqueNamespaces.length}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pods</h3>
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {uniquePods.length}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Containers</h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {latestPodMetrics.length}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total CPU Usage</h3>
              <Cpu className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {namespaceStats.reduce((sum, ns) => sum + ns.totalCpuUsage, 0).toFixed(3)} cores
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Filters:</span>
            
            {/* Namespace Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Namespace:</span>
              <button
                onClick={() => {
                  setSelectedNamespace(null);
                  setSelectedPod(null);
                }}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  selectedNamespace === null
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {uniqueNamespaces.map(ns => (
                <button
                  key={ns}
                  onClick={() => {
                    setSelectedNamespace(ns);
                    setSelectedPod(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    selectedNamespace === ns
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {ns}
                </button>
              ))}
            </div>

            {/* Pod Filter (only if namespace is selected) */}
            {selectedNamespace && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pod:</span>
                {uniquePods.length > 15 ? (
                  // Use dropdown for many pods
                  <select
                    value={selectedPod || ''}
                    onChange={(e) => setSelectedPod(e.target.value || null)}
                    className="px-3 py-1 rounded-lg text-sm dark:bg-gray-800 bg-white border 
                             dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                             focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                  >
                    <option value="">All Pods</option>
                    {uniquePods.map(pod => (
                      <option key={pod} value={pod}>{pod}</option>
                    ))}
                  </select>
                ) : (
                  // Use buttons for few pods
                  <>
                    <button
                      onClick={() => setSelectedPod(null)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        selectedPod === null
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                    <div className="flex items-center gap-2 flex-wrap max-w-4xl">
                      {uniquePods.map(pod => (
                        <button
                          key={pod}
                          onClick={() => setSelectedPod(pod)}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors whitespace-nowrap ${
                            selectedPod === pod
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pod}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              CPU Usage Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#6B7280"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'CPU (cores)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '11px',
                    padding: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                  itemStyle={{
                    padding: '2px 4px',
                    fontSize: '11px'
                  }}
                  labelStyle={{
                    fontSize: '11px',
                    marginBottom: '4px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid #374151'
                  }}
                  formatter={(value: number) => `${value.toFixed(4)} cores`}
                />
                <Legend />
                {Array.from(new Set(latestPodMetrics.map(m => `${m.namespace}/${m.pod}/${m.container}`)))
                  .slice(0, 10) // Limit to 10 lines for readability
                  .map((key, index) => {
                    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#A855F7', '#E11D48'];
                    return (
                      <Line
                        key={`${key}_cpu`}
                        type="monotone"
                        dataKey={`${key}_cpu`}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        name={key.split('/').pop()}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Memory Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Memory Usage Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#6B7280"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'Memory (MB)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '11px',
                    padding: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                  itemStyle={{
                    padding: '2px 4px',
                    fontSize: '11px'
                  }}
                  labelStyle={{
                    fontSize: '11px',
                    marginBottom: '4px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid #374151'
                  }}
                  formatter={(value: number) => `${value.toFixed(2)} MB`}
                />
                <Legend />
                {Array.from(new Set(latestPodMetrics.map(m => `${m.namespace}/${m.pod}/${m.container}`)))
                  .slice(0, 10) // Limit to 10 lines for readability
                  .map((key, index) => {
                    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#A855F7', '#E11D48'];
                    return (
                      <Line
                        key={`${key}_memory`}
                        type="monotone"
                        dataKey={`${key}_memory`}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        name={key.split('/').pop()}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pod Details Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-700 border-gray-200">
            <h3 className="text-lg font-semibold dark:text-white text-gray-900">Pod & Container Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Namespace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Container
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CPU Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CPU Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Memory Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {latestPodMetrics.map((metric, index) => {
                  const cpuPercent = metric.cpuLimitCores !== null 
                    ? (metric.cpuUsageCores / metric.cpuLimitCores) * 100 
                    : null;
                  const date = getLocalDateFromUTC(metric.timestamp);
                  
                  return (
                    <tr 
                      key={`${metric.namespace}-${metric.pod}-${metric.container}-${index}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Layers className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium dark:text-white text-gray-900">
                            {metric.namespace}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm dark:text-white text-gray-900">
                            {metric.pod}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm dark:text-white text-gray-900">
                        {metric.container}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${cpuPercent !== null ? getUsageColor(cpuPercent) : 'dark:text-white text-gray-900'}`}>
                            {metric.cpuUsageCores.toFixed(4)} cores
                          </span>
                          {cpuPercent !== null && (
                            <>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                ({cpuPercent.toFixed(1)}%)
                              </span>
                              <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${getUsageBgColor(cpuPercent)}`}
                                  style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                                ></div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.cpuLimitCores !== null ? `${metric.cpuLimitCores} cores` : 'No limit'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm dark:text-white text-gray-900">
                        {formatBytes(metric.memoryUsageBytes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {date ? formatCompactDate(date) : metric.timestamp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

