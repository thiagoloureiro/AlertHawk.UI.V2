import React, { useState, useEffect, useMemo } from 'react';
import { 
  Server, Cpu, HardDrive, RefreshCw, 
  Activity, AlertCircle, CheckCircle, XCircle, Cloud, Code
} from 'lucide-react';
import { NodeMetric } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import { LoadingSpinner } from '../components/ui';
import { toast } from 'react-hot-toast';

export function ClustersDiagram() {
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Fetch node metrics
  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const metrics = await metricsService.getNodeMetrics(1, 1000);
      setNodeMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load cluster metrics');
      toast.error('Failed to load cluster metrics', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

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
    }
  };

  // Get unique clusters (filtered by user permissions)
  const uniqueClusters = useMemo(() => {
    const user = getCurrentUser();
    
    if (user?.isAdmin) {
      return [...clusters].sort();
    }
    
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

  // Fetch metrics on mount
  useEffect(() => {
    fetchMetrics();
  }, []);

  // Auto-refresh data
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchMetrics(false);
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Get metrics grouped by cluster
  const clusterMetrics = useMemo(() => {
    const clusterMap = new Map<string, {
      clusterName: string;
      nodes: NodeMetric[];
      totalNodes: number;
      readyNodes: number;
      avgCpuUsage: number;
      avgMemoryUsage: number;
      totalCpuCores: number;
      totalMemoryBytes: number;
      usedCpuCores: number;
      usedMemoryBytes: number;
      kubernetesVersion?: string;
      cloudProvider?: string;
      nodesWithIssues: number;
      latestNodes?: NodeMetric[];
    }>();

    nodeMetrics.forEach(metric => {
      if (!uniqueClusters.includes(metric.clusterName)) return;

      if (!clusterMap.has(metric.clusterName)) {
        clusterMap.set(metric.clusterName, {
          clusterName: metric.clusterName,
          nodes: [],
          totalNodes: 0,
          readyNodes: 0,
          avgCpuUsage: 0,
          avgMemoryUsage: 0,
          totalCpuCores: 0,
          totalMemoryBytes: 0,
          usedCpuCores: 0,
          usedMemoryBytes: 0,
          kubernetesVersion: metric.kubernetesVersion,
          cloudProvider: metric.cloudProvider,
          nodesWithIssues: 0
        });
      }

      const cluster = clusterMap.get(metric.clusterName)!;
      cluster.nodes.push(metric);
    });

    // Calculate statistics for each cluster
    clusterMap.forEach((cluster, clusterName) => {
      // Get latest metrics for each node
      const nodeMap = new Map<string, NodeMetric>();
      cluster.nodes.forEach(metric => {
        const existing = nodeMap.get(metric.nodeName);
        if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
          nodeMap.set(metric.nodeName, metric);
        }
      });

      const latestNodes = Array.from(nodeMap.values()).sort((a, b) => 
        a.nodeName.localeCompare(b.nodeName)
      );
      cluster.totalNodes = latestNodes.length;
      cluster.readyNodes = latestNodes.filter(n => n.isReady === true).length;
      cluster.nodesWithIssues = latestNodes.filter(n => 
        n.isReady === false || 
        n.hasMemoryPressure === true || 
        n.hasDiskPressure === true || 
        n.hasPidPressure === true
      ).length;

      const totalCpuCores = latestNodes.reduce((sum, n) => sum + n.cpuCapacityCores, 0);
      const totalMemoryBytes = latestNodes.reduce((sum, n) => sum + n.memoryCapacityBytes, 0);
      const usedCpuCores = latestNodes.reduce((sum, n) => sum + n.cpuUsageCores, 0);
      const usedMemoryBytes = latestNodes.reduce((sum, n) => sum + n.memoryUsageBytes, 0);

      cluster.totalCpuCores = totalCpuCores;
      cluster.totalMemoryBytes = totalMemoryBytes;
      cluster.usedCpuCores = usedCpuCores;
      cluster.usedMemoryBytes = usedMemoryBytes;
      cluster.avgCpuUsage = totalCpuCores > 0 ? (usedCpuCores / totalCpuCores) * 100 : 0;
      cluster.avgMemoryUsage = totalMemoryBytes > 0 ? (usedMemoryBytes / totalMemoryBytes) * 100 : 0;
      
      // Store latest nodes for display
      (cluster as any).latestNodes = latestNodes;
    });

    return Array.from(clusterMap.values()).sort((a, b) => 
      a.clusterName.localeCompare(b.clusterName)
    );
  }, [nodeMetrics, uniqueClusters]);

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

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

  const getClusterStatusColor = (cluster: typeof clusterMetrics[0]): string => {
    if (cluster.nodesWithIssues > 0) return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    if (cluster.avgCpuUsage >= 90 || cluster.avgMemoryUsage >= 90) return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    return 'border-green-500 bg-green-50 dark:bg-green-900/20';
  };

  // Check if user has no cluster permissions
  const user = getCurrentUser();
  const hasNoPermissions = clustersLoaded && uniqueClusters.length === 0 && !user?.isAdmin;

  if (isLoading && !hasNoPermissions) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner text="Loading clusters..." />
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
            You don't have permission to view any clusters. Please contact your administrator to request access.
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
    <div className="h-full overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Clusters Diagram</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
              Supervisory view of all clusters and their status
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">Auto-refresh:</span>
              <select
                value={refreshInterval || ''}
                onChange={(e) => setRefreshInterval(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1.5 text-sm rounded-lg dark:bg-gray-800 bg-white border 
                         dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                         focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Off</option>
                <option value="30">30s</option>
                <option value="60">1m</option>
                <option value="300">5m</option>
                <option value="600">10m</option>
              </select>
            </div>
            <button
              onClick={() => fetchMetrics(false)}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                       flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Clusters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clusterMetrics.map((cluster) => (
            <div
              key={cluster.clusterName}
              className={`rounded-lg shadow-md border-2 p-3 transition-all hover:shadow-lg ${getClusterStatusColor(cluster)}`}
            >
              {/* Cluster Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold dark:text-white text-gray-900 truncate">
                      {cluster.clusterName}
                    </h2>
                    <div className="flex items-center gap-1 mt-0.5">
                      {cluster.nodesWithIssues === 0 ? (
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${
                        cluster.nodesWithIssues === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {cluster.nodesWithIssues === 0 ? 'OK' : `${cluster.nodesWithIssues}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cluster Info */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="flex items-center gap-1 text-xs">
                  <Code className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 truncate text-xs">{cluster.kubernetesVersion || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Cloud className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 truncate text-xs">{cluster.cloudProvider || 'N/A'}</span>
                </div>
              </div>

              {/* Statistics Cards - Horizontal Layout */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {/* Nodes */}
                <div className="bg-white dark:bg-gray-800 rounded p-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Nodes</span>
                    <Server className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold dark:text-white text-gray-900">
                      {cluster.readyNodes}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      /{cluster.totalNodes}
                    </span>
                  </div>
                </div>

                {/* CPU Usage */}
                <div className="bg-white dark:bg-gray-800 rounded p-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">CPU</span>
                    <Cpu className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-base font-bold ${getUsageColor(cluster.avgCpuUsage)}`}>
                      {cluster.avgCpuUsage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${getUsageBgColor(cluster.avgCpuUsage)}`}
                      style={{ width: `${Math.min(cluster.avgCpuUsage, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-white dark:bg-gray-800 rounded p-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">RAM</span>
                    <HardDrive className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-base font-bold ${getUsageColor(cluster.avgMemoryUsage)}`}>
                      {cluster.avgMemoryUsage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${getUsageBgColor(cluster.avgMemoryUsage)}`}
                      style={{ width: `${Math.min(cluster.avgMemoryUsage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Node Details */}
              {cluster.latestNodes && cluster.latestNodes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {cluster.latestNodes.map((node) => {
                      const nodeCpuPercent = (node.cpuUsageCores / node.cpuCapacityCores) * 100;
                      const nodeMemoryPercent = (node.memoryUsageBytes / node.memoryCapacityBytes) * 100;
                      return (
                        <div key={node.nodeName} className="bg-white dark:bg-gray-800 rounded p-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium dark:text-white text-gray-900 truncate flex-1">
                              {node.nodeName.split('-').pop() || node.nodeName}
                            </span>
                            {node.isReady === false || node.hasMemoryPressure || node.hasDiskPressure || node.hasPidPressure ? (
                              <XCircle className="w-2.5 h-2.5 text-red-500 flex-shrink-0 ml-1" />
                            ) : (
                              <CheckCircle className="w-2.5 h-2.5 text-green-500 flex-shrink-0 ml-1" />
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <div className="flex items-center gap-0.5 mb-0.5">
                                <Cpu className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                <span className={`text-xs font-medium ${getUsageColor(nodeCpuPercent)}`}>
                                  {nodeCpuPercent.toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${getUsageBgColor(nodeCpuPercent)}`}
                                  style={{ width: `${Math.min(nodeCpuPercent, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-0.5 mb-0.5">
                                <HardDrive className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                <span className={`text-xs font-medium ${getUsageColor(nodeMemoryPercent)}`}>
                                  {nodeMemoryPercent.toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${getUsageBgColor(nodeMemoryPercent)}`}
                                  style={{ width: `${Math.min(nodeMemoryPercent, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {clusterMetrics.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No cluster data available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

