import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, BarChart, Bar 
} from 'recharts';
import { 
  Server, Cpu, HardDrive, RefreshCw, Clock, TrendingUp, 
  Activity, AlertCircle, Network, Maximize2, Minimize2
} from 'lucide-react';
import { NodeMetric } from '../types';
import metricsService from '../services/metricsService';
import { LoadingSpinner } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

export function Metrics() {
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedChart, setExpandedChart] = useState<'cpu' | 'memory' | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);

  // Fetch node metrics
  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const metrics = await metricsService.getNodeMetrics(hours, 1000, selectedCluster || undefined);
      setNodeMetrics(metrics);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Failed to fetch node metrics:', err);
      setError('Failed to load node metrics');
      toast.error('Failed to load node metrics', { position: 'bottom-right' });
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
  }, [hours, selectedCluster]);

  // Close expanded chart on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedChart) {
        setExpandedChart(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [expandedChart]);

  // Fetch clusters
  const fetchClusters = async () => {
    try {
      const clusterList = await metricsService.getClusters();
      setClusters(clusterList);
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
      toast.error('Failed to load clusters', { position: 'bottom-right' });
    }
  };

  // Get unique clusters (from fetched clusters list)
  const uniqueClusters = useMemo(() => {
    return [...clusters].sort();
  }, [clusters]);

  // Fetch clusters on mount
  useEffect(() => {
    fetchClusters();
  }, []);

  // Auto-select first cluster when clusters are available
  useEffect(() => {
    if (uniqueClusters.length > 0 && !selectedCluster) {
      setSelectedCluster(uniqueClusters[0]);
    }
  }, [uniqueClusters, selectedCluster]);

  // Filter metrics by selected cluster
  const filteredMetrics = useMemo(() => {
    if (!selectedCluster) return [];
    return nodeMetrics.filter(m => m.clusterName === selectedCluster);
  }, [nodeMetrics, selectedCluster]);

  // Get unique node names (from filtered metrics)
  const uniqueNodes = useMemo(() => {
    const nodes = new Set(filteredMetrics.map(m => m.nodeName));
    return Array.from(nodes).sort();
  }, [filteredMetrics]);

  // Get latest metrics for each node (from filtered metrics)
  const latestNodeMetrics = useMemo(() => {
    const nodeMap = new Map<string, NodeMetric>();
    filteredMetrics.forEach(metric => {
      const existing = nodeMap.get(metric.nodeName);
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        nodeMap.set(metric.nodeName, metric);
      }
    });
    return Array.from(nodeMap.values()).sort((a, b) => 
      a.nodeName.localeCompare(b.nodeName)
    );
  }, [filteredMetrics]);

  // Prepare chart data for selected node or all nodes
  const chartData = useMemo(() => {
    const dataMap = new Map<string, {
      timestamp: string;
      timestampValue: number;
      [key: string]: string | number;
    }>();

    const nodesToProcess = selectedNode 
      ? [selectedNode] 
      : uniqueNodes;

    filteredMetrics.forEach(metric => {
      if (!nodesToProcess.includes(metric.nodeName)) return;

      const date = getLocalDateFromUTC(metric.timestamp);
      const timestampValue = date ? date.getTime() : new Date(metric.timestamp).getTime();
      const timeKey = date ? formatCompactDate(date) : metric.timestamp;

      if (!dataMap.has(timeKey)) {
        dataMap.set(timeKey, { timestamp: timeKey, timestampValue });
      }

      const entry = dataMap.get(timeKey)!;
      const nodeKey = metric.nodeName;
      
      // CPU percentage
      entry[`${nodeKey}_cpu`] = ((metric.cpuUsageCores / metric.cpuCapacityCores) * 100);
      // Memory percentage
      entry[`${nodeKey}_memory`] = ((metric.memoryUsageBytes / metric.memoryCapacityBytes) * 100);
    });

    return Array.from(dataMap.values())
      .sort((a, b) => (a.timestampValue as number) - (b.timestampValue as number));
  }, [filteredMetrics, selectedNode, uniqueNodes]);

  // Calculate cluster-wide averages
  const clusterStats = useMemo(() => {
    if (latestNodeMetrics.length === 0) {
      return {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        totalNodes: 0,
        totalCpuCores: 0,
        totalMemoryBytes: 0,
        usedCpuCores: 0,
        usedMemoryBytes: 0
      };
    }

    const totalCpuCores = latestNodeMetrics.reduce((sum, m) => sum + m.cpuCapacityCores, 0);
    const totalMemoryBytes = latestNodeMetrics.reduce((sum, m) => sum + m.memoryCapacityBytes, 0);
    const usedCpuCores = latestNodeMetrics.reduce((sum, m) => sum + m.cpuUsageCores, 0);
    const usedMemoryBytes = latestNodeMetrics.reduce((sum, m) => sum + m.memoryUsageBytes, 0);

    return {
      avgCpuUsage: (usedCpuCores / totalCpuCores) * 100,
      avgMemoryUsage: (usedMemoryBytes / totalMemoryBytes) * 100,
      totalNodes: latestNodeMetrics.length,
      totalCpuCores,
      totalMemoryBytes,
      usedCpuCores,
      usedMemoryBytes
    };
  }, [latestNodeMetrics]);

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
        <LoadingSpinner text="Loading metrics..." />
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
            <h1 className="text-3xl font-bold dark:text-white text-gray-900">Cluster Metrics</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor node CPU and memory usage across your cluster
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Cluster Selector */}
            <select
              value={selectedCluster || ''}
              onChange={(e) => {
                setSelectedCluster(e.target.value);
                setSelectedNode(null); // Clear node selection when cluster changes
              }}
              className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                       focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
            >
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

        {/* Cluster Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Nodes</h3>
              <Server className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {clusterStats.totalNodes}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg CPU Usage</h3>
              <Cpu className="w-5 h-5 text-gray-400" />
            </div>
            <p className={`text-2xl font-bold ${getUsageColor(clusterStats.avgCpuUsage)}`}>
              {clusterStats.avgCpuUsage.toFixed(1)}%
            </p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageBgColor(clusterStats.avgCpuUsage)}`}
                style={{ width: `${Math.min(clusterStats.avgCpuUsage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Memory Usage</h3>
              <HardDrive className="w-5 h-5 text-gray-400" />
            </div>
            <p className={`text-2xl font-bold ${getUsageColor(clusterStats.avgMemoryUsage)}`}>
              {clusterStats.avgMemoryUsage.toFixed(1)}%
            </p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageBgColor(clusterStats.avgMemoryUsage)}`}
                style={{ width: `${Math.min(clusterStats.avgMemoryUsage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total CPU Cores</h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold dark:text-white text-gray-900">
              {clusterStats.usedCpuCores.toFixed(1)} / {clusterStats.totalCpuCores.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatBytes(clusterStats.usedMemoryBytes)} / {formatBytes(clusterStats.totalMemoryBytes)} memory
            </p>
          </div>
        </div>

        {/* Node Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Filter by node:</span>
            <button
              onClick={() => setSelectedNode(null)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                selectedNode === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All Nodes
            </button>
            {uniqueNodes.map(node => (
              <button
                key={node}
                onClick={() => setSelectedNode(node)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  selectedNode === node
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {node}
              </button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 z-10 flex items-center justify-center rounded-lg">
              <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg p-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium dark:text-white text-gray-900">Updating...</span>
              </div>
            </div>
          )}
          {/* CPU Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                CPU Usage Over Time
              </h3>
              <button
                onClick={() => setExpandedChart('cpu')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Expand chart"
              >
                <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
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
                  label={{ value: 'CPU %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '11px',
                    padding: '8px'
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
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {(selectedNode ? [selectedNode] : uniqueNodes).map((node, index) => {
                  const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24'];
                  return (
                    <Line
                      key={`${node}_cpu`}
                      type="monotone"
                      dataKey={`${node}_cpu`}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      name={`${node} CPU`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Memory Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Memory Usage Over Time
              </h3>
              <button
                onClick={() => setExpandedChart('memory')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Expand chart"
              >
                <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
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
                  label={{ value: 'Memory %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB',
                    fontSize: '11px',
                    padding: '8px'
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
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {(selectedNode ? [selectedNode] : uniqueNodes).map((node, index) => {
                  const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24'];
                  return (
                    <Line
                      key={`${node}_memory`}
                      type="monotone"
                      dataKey={`${node}_memory`}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      name={`${node} Memory`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Node Details Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 z-10 flex items-center justify-center rounded-lg">
              <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg p-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium dark:text-white text-gray-900">Updating...</span>
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-b dark:border-gray-700 border-gray-200">
            <h3 className="text-lg font-semibold dark:text-white text-gray-900">Node Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Node Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CPU Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CPU Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Memory Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Memory Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {latestNodeMetrics.map((metric) => {
                  const cpuPercent = (metric.cpuUsageCores / metric.cpuCapacityCores) * 100;
                  const memoryPercent = (metric.memoryUsageBytes / metric.memoryCapacityBytes) * 100;
                  const date = getLocalDateFromUTC(metric.timestamp);
                  
                  return (
                    <tr 
                      key={metric.nodeName}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedNode(metric.nodeName)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Server className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium dark:text-white text-gray-900">
                            {metric.nodeName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${getUsageColor(cpuPercent)}`}>
                            {cpuPercent.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            ({metric.cpuUsageCores.toFixed(2)} / {metric.cpuCapacityCores} cores)
                          </span>
                        </div>
                        <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${getUsageBgColor(cpuPercent)}`}
                            style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.cpuCapacityCores} cores
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${getUsageColor(memoryPercent)}`}>
                            {memoryPercent.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            ({formatBytes(metric.memoryUsageBytes)})
                          </span>
                        </div>
                        <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${getUsageBgColor(memoryPercent)}`}
                            style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatBytes(metric.memoryCapacityBytes)}
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

      {/* Fullscreen Chart Modal */}
      {expandedChart && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold dark:text-white text-gray-900 flex items-center gap-2">
                {expandedChart === 'cpu' ? (
                  <>
                    <Cpu className="w-6 h-6" />
                    CPU Usage Over Time
                  </>
                ) : (
                  <>
                    <HardDrive className="w-6 h-6" />
                    Memory Usage Over Time
                  </>
                )}
              </h3>
              <button
                onClick={() => setExpandedChart(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close"
              >
                <Minimize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
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
                    label={{ 
                      value: expandedChart === 'cpu' ? 'CPU %' : 'Memory %', 
                      angle: -90, 
                      position: 'insideLeft'
                    }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F9FAFB',
                      fontSize: '11px',
                      padding: '8px'
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
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {(selectedNode ? [selectedNode] : uniqueNodes).map((node, index) => {
                    const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24'];
                    return (
                      <Line
                        key={`${node}_${expandedChart}`}
                        type="monotone"
                        dataKey={`${node}_${expandedChart}`}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        name={`${node} ${expandedChart === 'cpu' ? 'CPU' : 'Memory'}`}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
