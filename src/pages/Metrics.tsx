import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  Server, Cpu, HardDrive, RefreshCw, 
  Activity, AlertCircle, Maximize2, Minimize2, Layers, ChevronDown, ChevronRight
} from 'lucide-react';
import { NodeMetric, NamespaceMetric } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
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
  const [expandedChart, setExpandedChart] = useState<'cpu' | 'memory' | 'cpu-pie' | 'memory-pie' | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [namespaceMetrics, setNamespaceMetrics] = useState<NamespaceMetric[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch node metrics
  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const [nodeMetricsData, namespaceMetricsData] = await Promise.all([
        metricsService.getNodeMetrics(hours, 1000, selectedCluster || undefined),
        metricsService.getNamespaceMetrics(hours, 100, selectedCluster || undefined)
      ]);
      setNodeMetrics(nodeMetricsData);
      setNamespaceMetrics(namespaceMetricsData);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load metrics');
      toast.error('Failed to load metrics', { position: 'bottom-right' });
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

  // Get current user info
  const getCurrentUser = () => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  };

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

  // Fetch user clusters
  const fetchUserClusters = async () => {
    const user = getCurrentUser();
    if (!user?.id) {
      return;
    }
    
    try {
      const userClustersData = await userService.getUserClusters(user.id);
      setUserClusters(userClustersData.map(uc => uc.clusterName));
    } catch (err) {
      console.error('Failed to fetch user clusters:', err);
      // Don't show error toast here as it's not critical - user might be admin
    }
  };

  // Get unique clusters (filtered by user permissions)
  const uniqueClusters = useMemo(() => {
    const user = getCurrentUser();
    
    // If user is admin, show all clusters
    if (user?.isAdmin) {
      return [...clusters].sort();
    }
    
    // Otherwise, filter to only show clusters user has permission to view
    if (userClusters.length === 0) {
      return [];
    }
    
    return clusters.filter(cluster => userClusters.includes(cluster)).sort();
  }, [clusters, userClusters]);

  // Fetch clusters and user clusters on mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchClusters(), fetchUserClusters()]);
      setClustersLoaded(true);
    };
    loadData();
  }, []);

  // Auto-select first cluster when clusters are available, or clear selection if current cluster is not permitted
  useEffect(() => {
    if (uniqueClusters.length > 0) {
      if (!selectedCluster) {
        setSelectedCluster(uniqueClusters[0]);
      } else if (!uniqueClusters.includes(selectedCluster)) {
        // Current selection is not in permitted clusters, select first available
        setSelectedCluster(uniqueClusters[0]);
      }
    } else if (selectedCluster) {
      // No permitted clusters available, clear selection
      setSelectedCluster(null);
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
      [key: string]: string | number | null;
    }>();

    const nodesToProcess = selectedNode 
      ? [selectedNode] 
      : uniqueNodes;

    // Create a Set for faster lookup
    const nodesToProcessSet = new Set(nodesToProcess);

    // Optimized single pass: build data map directly
    const timestampMap = new Map<string, number>(); // timeKey -> timestampValue

    // Single pass: build data map
    for (const metric of filteredMetrics) {
      if (!nodesToProcessSet.has(metric.nodeName)) continue;

      const date = getLocalDateFromUTC(metric.timestamp);
      const timeKey = date ? formatCompactDate(date) : metric.timestamp;
      const timestampValue = date ? date.getTime() : new Date(metric.timestamp).getTime();
      
      if (!timestampMap.has(timeKey)) {
        timestampMap.set(timeKey, timestampValue);
      }
      
      if (!dataMap.has(timeKey)) {
        dataMap.set(timeKey, {
          timestamp: timeKey,
          timestampValue
        });
      }
      
      const entry = dataMap.get(timeKey)!;
      const nodeKey = metric.nodeName;
      
      // CPU percentage
      entry[`${nodeKey}_cpu`] = ((metric.cpuUsageCores / metric.cpuCapacityCores) * 100);
      // Memory percentage
      entry[`${nodeKey}_memory`] = ((metric.memoryUsageBytes / metric.memoryCapacityBytes) * 100);
    }

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

  // Filter namespace metrics by selected cluster
  const filteredNamespaceMetrics = useMemo(() => {
    if (!selectedCluster) return [];
    return namespaceMetrics.filter(m => m.clusterName === selectedCluster);
  }, [namespaceMetrics, selectedCluster]);

  // Get latest namespace metrics (aggregated by namespace)
  const namespaceStats = useMemo(() => {
    if (filteredNamespaceMetrics.length === 0) return [];

    // Step 1: Group by (namespace, pod, container) and get the latest metric for each
    const containerMap = new Map<string, NamespaceMetric>();
    filteredNamespaceMetrics.forEach(metric => {
      const key = `${metric.namespace}|${metric.pod}|${metric.container}`;
      const existing = containerMap.get(key);
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        containerMap.set(key, metric);
      }
    });

    // Step 2: Aggregate by namespace - sum all containers across all pods
    const namespaceMap = new Map<string, {
      namespace: string;
      cpuUsageCores: number;
      memoryUsageBytes: number;
      podCount: number;
    }>();

    const uniquePods = new Set<string>();

    containerMap.forEach(metric => {
      const podKey = `${metric.namespace}|${metric.pod}`;
      uniquePods.add(podKey);

      const existing = namespaceMap.get(metric.namespace);
      if (existing) {
        existing.cpuUsageCores += metric.cpuUsageCores;
        existing.memoryUsageBytes += metric.memoryUsageBytes;
      } else {
        namespaceMap.set(metric.namespace, {
          namespace: metric.namespace,
          cpuUsageCores: metric.cpuUsageCores,
          memoryUsageBytes: metric.memoryUsageBytes,
          podCount: 0
        });
      }
    });

    // Count unique pods per namespace
    uniquePods.forEach(podKey => {
      const [namespace] = podKey.split('|');
      const ns = namespaceMap.get(namespace);
      if (ns) {
        ns.podCount += 1;
      }
    });

    return Array.from(namespaceMap.values()).sort((a, b) => 
      b.cpuUsageCores - a.cpuUsageCores
    );
  }, [filteredNamespaceMetrics]);

  // Prepare pie chart data for CPU distribution
  const cpuPieData = useMemo(() => {
    if (namespaceStats.length === 0) return [];
    const totalCpu = namespaceStats.reduce((sum, ns) => sum + ns.cpuUsageCores, 0);
    if (totalCpu === 0) return [];
    
    return namespaceStats.map(ns => ({
      name: ns.namespace,
      value: ns.cpuUsageCores,
      percentage: (ns.cpuUsageCores / totalCpu) * 100
    })).sort((a, b) => b.value - a.value);
  }, [namespaceStats]);

  // Prepare pie chart data for Memory distribution
  const memoryPieData = useMemo(() => {
    if (namespaceStats.length === 0) return [];
    const totalMemory = namespaceStats.reduce((sum, ns) => sum + ns.memoryUsageBytes, 0);
    if (totalMemory === 0) return [];
    
    return namespaceStats.map(ns => ({
      name: ns.namespace,
      value: ns.memoryUsageBytes,
      percentage: (ns.memoryUsageBytes / totalMemory) * 100
    })).sort((a, b) => b.value - a.value);
  }, [namespaceStats]);

  // Colors for pie charts
  const COLORS = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F87171', '#FB7185', '#A78BFA', '#C084FC'];

  // Get namespace metrics for a specific node
  const getNamespaceMetricsForNode = (nodeName: string) => {
    const nodeNamespaceMetrics = filteredNamespaceMetrics.filter(m => m.nodeName === nodeName);
    if (nodeNamespaceMetrics.length === 0) return [];

    // Step 1: Group by (namespace, pod, container) and get the latest metric for each
    const containerMap = new Map<string, NamespaceMetric>();
    nodeNamespaceMetrics.forEach(metric => {
      const key = `${metric.namespace}|${metric.pod}|${metric.container}`;
      const existing = containerMap.get(key);
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        containerMap.set(key, metric);
      }
    });

    // Step 2: Aggregate by namespace - sum all containers across all pods
    const namespaceMap = new Map<string, {
      namespace: string;
      cpuUsageCores: number;
      memoryUsageBytes: number;
      podCount: number;
    }>();

    const uniquePods = new Set<string>();

    containerMap.forEach(metric => {
      const podKey = `${metric.namespace}|${metric.pod}`;
      uniquePods.add(podKey);

      const existing = namespaceMap.get(metric.namespace);
      if (existing) {
        existing.cpuUsageCores += metric.cpuUsageCores;
        existing.memoryUsageBytes += metric.memoryUsageBytes;
      } else {
        namespaceMap.set(metric.namespace, {
          namespace: metric.namespace,
          cpuUsageCores: metric.cpuUsageCores,
          memoryUsageBytes: metric.memoryUsageBytes,
          podCount: 0
        });
      }
    });

    // Count unique pods per namespace
    uniquePods.forEach(podKey => {
      const [namespace] = podKey.split('|');
      const ns = namespaceMap.get(namespace);
      if (ns) {
        ns.podCount += 1;
      }
    });

    return Array.from(namespaceMap.values()).sort((a, b) => 
      b.cpuUsageCores - a.cpuUsageCores
    );
  };

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

  // Check if user has no cluster permissions
  const user = getCurrentUser();
  const hasNoPermissions = clustersLoaded && uniqueClusters.length === 0 && !user?.isAdmin;

  // If no permissions and clusters are loaded, stop showing loading state
  useEffect(() => {
    if (hasNoPermissions && isLoading) {
      setIsLoading(false);
    }
  }, [hasNoPermissions, isLoading]);

  if (isLoading && !hasNoPermissions) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner text="Loading metrics..." />
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
            You don't have permission to view any clusters. Please contact your administrator to request access to cluster metrics.
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cluster:</span>
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
            </div>
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
                  domain={[0, 100]}
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
                      connectNulls={true}
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
                  domain={[0, 100]}
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
                      connectNulls={true}
                      name={`${node} Memory`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Namespace Distribution Pie Charts */}
        {namespaceStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU Distribution Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-semibold dark:text-white text-gray-900">
                    CPU Distribution by Namespace
                  </h3>
                </div>
                <button
                  onClick={() => setExpandedChart('cpu-pie')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              {cpuPieData.length > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={500}>
                    <PieChart>
                      <Pie
                        data={cpuPieData}
                        cx="50%"
                        cy="45%"
                        labelLine={false}
                        label={(entry: any) => {
                          const total = cpuPieData.reduce((sum, d) => sum + d.value, 0);
                          const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                          if (percentage <= 3) return '';
                          
                          // Calculate position outside the pie segment
                          const RADIAN = Math.PI / 180;
                          const radius = entry.outerRadius + 10; // Position outside the pie
                          const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
                          const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);
                          
                          // Get color from the data entry
                          const colorIndex = cpuPieData.findIndex(d => d.name === entry.name);
                          const fillColor = colorIndex >= 0 ? COLORS[colorIndex % COLORS.length] : '#8884d8';
                          
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill={fillColor}
                              textAnchor={entry.midAngle < 90 || entry.midAngle > 270 ? 'start' : 'end'}
                              dominantBaseline="central"
                              style={{ fontSize: '11px', fontWeight: '500' }}
                            >
                              {`${entry.name}: ${percentage.toFixed(1)}%`}
                            </text>
                          );
                        }}
                        outerRadius={140}
                        innerRadius={30}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {cpuPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #1F2937)',
                          border: '1px solid var(--tooltip-border, #374151)',
                          borderRadius: '8px',
                          color: 'var(--tooltip-text, #F9FAFB)',
                          fontSize: '11px',
                          padding: '8px'
                        }}
                        itemStyle={{
                          color: 'var(--tooltip-text, #F9FAFB)'
                        }}
                        labelStyle={{
                          color: 'var(--tooltip-text, #F9FAFB)'
                        }}
                        formatter={(value: number) => {
                          const total = cpuPieData.reduce((sum, d) => sum + d.value, 0);
                          const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
                          return `${(value as number).toFixed(4)} cores (${percentage.toFixed(1)}%)`;
                        }}
                      />
                      <Legend 
                        content={(props) => {
                          const { payload } = props;
                          if (!payload) return null;
                          const midPoint = Math.ceil(payload.length / 2);
                          const leftColumn = payload.slice(0, midPoint);
                          const rightColumn = payload.slice(midPoint);
                          
                          return (
                            <div className="flex justify-center gap-8 pt-4">
                              <div className="flex flex-col gap-1">
                                {leftColumn.map((entry: any, index: number) => {
                                  const data = cpuPieData.find(d => d.name === entry.value);
                                  return (
                                    <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
                                      <div 
                                        className="w-3 h-3 rounded-sm" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="dark:text-gray-300 text-gray-700">
                                        {entry.value} ({data ? data.percentage.toFixed(1) : '0'}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex flex-col gap-1">
                                {rightColumn.map((entry: any, index: number) => {
                                  const data = cpuPieData.find(d => d.name === entry.value);
                                  return (
                                    <div key={`legend-${midPoint + index}`} className="flex items-center gap-2 text-xs">
                                      <div 
                                        className="w-3 h-3 rounded-sm" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="dark:text-gray-300 text-gray-700">
                                        {entry.value} ({data ? data.percentage.toFixed(1) : '0'}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-gray-500 dark:text-gray-400">
                  No CPU usage data available
                </div>
              )}
            </div>

            {/* Memory Distribution Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-semibold dark:text-white text-gray-900">
                    Memory Distribution by Namespace
                  </h3>
                </div>
                <button
                  onClick={() => setExpandedChart('memory-pie')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              {memoryPieData.length > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={500}>
                    <PieChart>
                      <Pie
                        data={memoryPieData}
                        cx="50%"
                        cy="45%"
                        labelLine={false}
                        label={(entry: any) => {
                          const total = memoryPieData.reduce((sum, d) => sum + d.value, 0);
                          const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                          if (percentage <= 3) return '';
                          
                          // Calculate position outside the pie segment
                          const RADIAN = Math.PI / 180;
                          const radius = entry.outerRadius + 10; // Position outside the pie
                          const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
                          const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);
                          
                          // Get color from the data entry
                          const colorIndex = memoryPieData.findIndex(d => d.name === entry.name);
                          const fillColor = colorIndex >= 0 ? COLORS[colorIndex % COLORS.length] : '#8884d8';
                          
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill={fillColor}
                              textAnchor={entry.midAngle < 90 || entry.midAngle > 270 ? 'start' : 'end'}
                              dominantBaseline="central"
                              style={{ fontSize: '11px', fontWeight: '500' }}
                            >
                              {`${entry.name}: ${percentage.toFixed(1)}%`}
                            </text>
                          );
                        }}
                        outerRadius={140}
                        innerRadius={30}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {memoryPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #1F2937)',
                          border: '1px solid var(--tooltip-border, #374151)',
                          borderRadius: '8px',
                          color: 'var(--tooltip-text, #F9FAFB)',
                          fontSize: '11px',
                          padding: '8px'
                        }}
                        itemStyle={{
                          color: 'var(--tooltip-text, #F9FAFB)'
                        }}
                        labelStyle={{
                          color: 'var(--tooltip-text, #F9FAFB)'
                        }}
                        formatter={(value: number) => {
                          const total = memoryPieData.reduce((sum, d) => sum + d.value, 0);
                          const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
                          return `${formatBytes(value as number)} (${percentage.toFixed(1)}%)`;
                        }}
                      />
                      <Legend 
                        content={(props) => {
                          const { payload } = props;
                          if (!payload) return null;
                          const midPoint = Math.ceil(payload.length / 2);
                          const leftColumn = payload.slice(0, midPoint);
                          const rightColumn = payload.slice(midPoint);
                          
                          return (
                            <div className="flex justify-center gap-8 pt-4">
                              <div className="flex flex-col gap-1">
                                {leftColumn.map((entry: any, index: number) => {
                                  const data = memoryPieData.find(d => d.name === entry.value);
                                  return (
                                    <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
                                      <div 
                                        className="w-3 h-3 rounded-sm" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="dark:text-gray-300 text-gray-700">
                                        {entry.value} ({data ? data.percentage.toFixed(1) : '0'}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex flex-col gap-1">
                                {rightColumn.map((entry: any, index: number) => {
                                  const data = memoryPieData.find(d => d.name === entry.value);
                                  return (
                                    <div key={`legend-${midPoint + index}`} className="flex items-center gap-2 text-xs">
                                      <div 
                                        className="w-3 h-3 rounded-sm" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="dark:text-gray-300 text-gray-700">
                                        {entry.value} ({data ? data.percentage.toFixed(1) : '0'}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-gray-500 dark:text-gray-400">
                  No memory usage data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Namespace Consumption Table */}
        {namespaceStats.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-gray-700 border-gray-200">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold dark:text-white text-gray-900">
                  Namespace Resource Consumption
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Namespace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      CPU Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Memory Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Pods
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {namespaceStats.map((ns) => {
                    const totalCpu = namespaceStats.reduce((sum, n) => sum + n.cpuUsageCores, 0);
                    const totalMemory = namespaceStats.reduce((sum, n) => sum + n.memoryUsageBytes, 0);
                    const cpuPercent = totalCpu > 0 ? (ns.cpuUsageCores / totalCpu) * 100 : 0;
                    const memoryPercent = totalMemory > 0 ? (ns.memoryUsageBytes / totalMemory) * 100 : 0;
                    
                    return (
                      <tr key={ns.namespace} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Layers className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium dark:text-white text-gray-900">
                              {ns.namespace}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium dark:text-white text-gray-900">
                              {ns.cpuUsageCores.toFixed(4)} cores
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({cpuPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium dark:text-white text-gray-900">
                              {formatBytes(ns.memoryUsageBytes)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({memoryPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-purple-500"
                              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ns.podCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                  
                  const nodeNamespaceStats = getNamespaceMetricsForNode(metric.nodeName);
                  const isExpanded = expandedNodes.has(metric.nodeName);
                  
                  return (
                    <React.Fragment key={metric.nodeName}>
                    <tr 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        setSelectedNode(metric.nodeName);
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has(metric.nodeName)) {
                          newExpanded.delete(metric.nodeName);
                        } else {
                          newExpanded.add(metric.nodeName);
                        }
                        setExpandedNodes(newExpanded);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-1" />
                          )}
                          <Server className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium dark:text-white text-gray-900">
                            {metric.nodeName}
                          </span>
                          {nodeNamespaceStats.length > 0 && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({nodeNamespaceStats.length} namespace{nodeNamespaceStats.length !== 1 ? 's' : ''})
                            </span>
                          )}
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
                    {isExpanded && nodeNamespaceStats.length > 0 && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              <span className="text-sm font-semibold dark:text-white text-gray-900">
                                Namespace Consumption on {metric.nodeName}
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b dark:border-gray-700 border-gray-200">
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Namespace</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">CPU Usage</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Memory Usage</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Pods</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {nodeNamespaceStats.map((ns) => {
                                    const nodeCpuPercent = metric.cpuCapacityCores > 0 
                                      ? (ns.cpuUsageCores / metric.cpuCapacityCores) * 100 
                                      : 0;
                                    const nodeMemoryPercent = metric.memoryCapacityBytes > 0 
                                      ? (ns.memoryUsageBytes / metric.memoryCapacityBytes) * 100 
                                      : 0;
                                    
                                    return (
                                      <tr key={ns.namespace} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <td className="px-4 py-2">
                                          <div className="flex items-center">
                                            <Layers className="w-3 h-3 text-gray-400 mr-2" />
                                            <span className="text-xs font-medium dark:text-white text-gray-900">
                                              {ns.namespace}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs dark:text-white text-gray-900">
                                              {ns.cpuUsageCores.toFixed(4)} cores
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                              ({nodeCpuPercent.toFixed(1)}% of node)
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs dark:text-white text-gray-900">
                                              {formatBytes(ns.memoryUsageBytes)}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                              ({nodeMemoryPercent.toFixed(1)}% of node)
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                                          {ns.podCount}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isExpanded && nodeNamespaceStats.length === 0 && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                            No namespace metrics available for this node
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
                ) : expandedChart === 'memory' ? (
                  <>
                    <HardDrive className="w-6 h-6" />
                    Memory Usage Over Time
                  </>
                ) : expandedChart === 'cpu-pie' ? (
                  <>
                    <Cpu className="w-6 h-6" />
                    CPU Distribution by Namespace
                  </>
                ) : (
                  <>
                    <HardDrive className="w-6 h-6" />
                    Memory Distribution by Namespace
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
              {expandedChart === 'cpu-pie' || expandedChart === 'memory-pie' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expandedChart === 'cpu-pie' ? cpuPieData : memoryPieData}
                      cx="50%"
                      cy="45%"
                      labelLine={false}
                      label={(entry: any) => {
                        const data = expandedChart === 'cpu-pie' ? cpuPieData : memoryPieData;
                        const total = data.reduce((sum, d) => sum + d.value, 0);
                        const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                        if (percentage <= 3) return '';
                        
                        // Calculate position outside the pie segment
                        const RADIAN = Math.PI / 180;
                        const radius = entry.outerRadius + 15; // Position outside the pie (larger for fullscreen)
                        const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
                        const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);
                        
                        // Get color from the data entry
                        const colorIndex = data.findIndex(d => d.name === entry.name);
                        const fillColor = colorIndex >= 0 ? COLORS[colorIndex % COLORS.length] : '#8884d8';
                        
                        return (
                          <text 
                            x={x} 
                            y={y} 
                            fill={fillColor}
                            textAnchor={entry.midAngle < 90 || entry.midAngle > 270 ? 'start' : 'end'}
                            dominantBaseline="central"
                            style={{ fontSize: '12px', fontWeight: '500' }}
                          >
                            {`${entry.name}: ${percentage.toFixed(1)}%`}
                          </text>
                        );
                      }}
                      outerRadius={180}
                      innerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(expandedChart === 'cpu-pie' ? cpuPieData : memoryPieData).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #1F2937)',
                        border: '1px solid var(--tooltip-border, #374151)',
                        borderRadius: '8px',
                        color: 'var(--tooltip-text, #F9FAFB)',
                        fontSize: '11px',
                        padding: '8px'
                      }}
                      itemStyle={{
                        color: 'var(--tooltip-text, #F9FAFB)'
                      }}
                      labelStyle={{
                        color: 'var(--tooltip-text, #F9FAFB)'
                      }}
                      formatter={(value: number) => {
                        const data = expandedChart === 'cpu-pie' ? cpuPieData : memoryPieData;
                        const total = data.reduce((sum, d) => sum + d.value, 0);
                        const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
                        if (expandedChart === 'cpu-pie') {
                          return `${(value as number).toFixed(4)} cores (${percentage.toFixed(1)}%)`;
                        } else {
                          return `${formatBytes(value as number)} (${percentage.toFixed(1)}%)`;
                        }
                      }}
                    />
                    <Legend 
                      content={(props) => {
                        const { payload } = props;
                        if (!payload) return null;
                        const data = expandedChart === 'cpu-pie' ? cpuPieData : memoryPieData;
                        const midPoint = Math.ceil(payload.length / 2);
                        const leftColumn = payload.slice(0, midPoint);
                        const rightColumn = payload.slice(midPoint);
                        
                        return (
                          <div className="flex justify-center gap-8 pt-4">
                            <div className="flex flex-col gap-1">
                              {leftColumn.map((entry: any, index: number) => {
                                const dataEntry = data.find(d => d.name === entry.value);
                                return (
                                  <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
                                    <div 
                                      className="w-3 h-3 rounded-sm" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="dark:text-gray-300 text-gray-700">
                                      {entry.value} ({dataEntry ? dataEntry.percentage.toFixed(1) : '0'}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex flex-col gap-1">
                              {rightColumn.map((entry: any, index: number) => {
                                const dataEntry = data.find(d => d.name === entry.value);
                                return (
                                  <div key={`legend-${midPoint + index}`} className="flex items-center gap-2 text-xs">
                                    <div 
                                      className="w-3 h-3 rounded-sm" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="dark:text-gray-300 text-gray-700">
                                      {entry.value} ({dataEntry ? dataEntry.percentage.toFixed(1) : '0'}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
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
                    domain={[0, 100]}
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
                        connectNulls={true}
                        name={`${node} ${expandedChart === 'cpu' ? 'CPU' : 'Memory'}`}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
