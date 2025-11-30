import React, { useState, useEffect, useMemo } from 'react';
import { NodeMetric } from '../../types';
import metricsService from '../../services/metricsService';
import { Server, Cpu, HardDrive, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { LoadingSpinner } from '../ui';

interface ClusterMetricsWidgetProps {
  data: NodeMetric[];
  config: any;
  onConfigChange?: (config: any) => void;
}

export function ClusterMetricsWidget({ data, config, onConfigChange }: ClusterMetricsWidgetProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(config?.cluster || null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get unique clusters from data
  const availableClusters = useMemo(() => {
    const clusterSet = new Set(data.map(m => m.clusterName));
    return Array.from(clusterSet).sort();
  }, [data]);

  // Sync selectedCluster with config when it changes externally
  useEffect(() => {
    if (config?.cluster && config.cluster !== selectedCluster) {
      setSelectedCluster(config.cluster);
    }
  }, [config?.cluster]);

  // Fetch clusters from API
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const clusterList = await metricsService.getClusters();
        setClusters(clusterList);
        if (!selectedCluster && clusterList.length > 0) {
          const newCluster = clusterList[0];
          setSelectedCluster(newCluster);
          // Save to config
          if (onConfigChange) {
            onConfigChange({ cluster: newCluster });
          }
        }
      } catch (err) {
        console.error('Failed to fetch clusters:', err);
      }
    };
    fetchClusters();
  }, []);

  // Save cluster selection to config when it changes
  const handleClusterChange = (cluster: string) => {
    setSelectedCluster(cluster);
    if (onConfigChange) {
      onConfigChange({ cluster });
    }
  };

  // Filter metrics by selected cluster
  const filteredMetrics = useMemo(() => {
    if (!selectedCluster) return [];
    return data.filter(m => m.clusterName === selectedCluster);
  }, [data, selectedCluster]);

  // Get latest metrics for each node
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  const displayClusters = clusters.length > 0 ? clusters : availableClusters;

  if (displayClusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p className="text-sm">No cluster data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cluster Selector */}
      {displayClusters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Cluster:</span>
          <select
            value={selectedCluster || ''}
            onChange={(e) => handleClusterChange(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg dark:bg-gray-700 bg-gray-100 border 
                     dark:border-gray-600 border-gray-300 dark:text-white text-gray-900
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {displayClusters.map(cluster => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Nodes</span>
            <Server className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-lg font-bold dark:text-white text-gray-900">
            {clusterStats.totalNodes}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">CPU Usage</span>
            <Cpu className="w-3 h-3 text-gray-400" />
          </div>
          <p className={`text-lg font-bold ${getUsageColor(clusterStats.avgCpuUsage)}`}>
            {clusterStats.avgCpuUsage.toFixed(1)}%
          </p>
          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
            <div
              className={`h-1 rounded-full ${getUsageBgColor(clusterStats.avgCpuUsage)}`}
              style={{ width: `${Math.min(clusterStats.avgCpuUsage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Memory Usage</span>
            <HardDrive className="w-3 h-3 text-gray-400" />
          </div>
          <p className={`text-lg font-bold ${getUsageColor(clusterStats.avgMemoryUsage)}`}>
            {clusterStats.avgMemoryUsage.toFixed(1)}%
          </p>
          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
            <div
              className={`h-1 rounded-full ${getUsageBgColor(clusterStats.avgMemoryUsage)}`}
              style={{ width: `${Math.min(clusterStats.avgMemoryUsage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">CPU Cores</span>
            <Activity className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-xs font-semibold dark:text-white text-gray-900">
            {clusterStats.usedCpuCores.toFixed(1)} / {clusterStats.totalCpuCores.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatBytes(clusterStats.usedMemoryBytes)} / {formatBytes(clusterStats.totalMemoryBytes)}
          </p>
        </div>
      </div>

      {/* Node List */}
      {latestNodeMetrics.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nodes</h4>
          {latestNodeMetrics.slice(0, 5).map((metric) => {
            const cpuPercent = (metric.cpuUsageCores / metric.cpuCapacityCores) * 100;
            const memoryPercent = (metric.memoryUsageBytes / metric.memoryCapacityBytes) * 100;
            return (
              <div key={metric.nodeName} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium dark:text-white text-gray-900 truncate">
                    {metric.nodeName}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">CPU</span>
                    <span className={getUsageColor(cpuPercent)}>
                      {cpuPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${getUsageBgColor(cpuPercent)}`}
                      style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Memory</span>
                    <span className={getUsageColor(memoryPercent)}>
                      {memoryPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${getUsageBgColor(memoryPercent)}`}
                      style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
          {latestNodeMetrics.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              +{latestNodeMetrics.length - 5} more nodes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

