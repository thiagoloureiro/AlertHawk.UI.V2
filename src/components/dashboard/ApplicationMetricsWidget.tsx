import React, { useState, useEffect, useMemo } from 'react';
import { NamespaceMetric } from '../../types';
import metricsService from '../../services/metricsService';
import { Package, Cpu, HardDrive, AlertCircle, Layers } from 'lucide-react';
import { LoadingSpinner } from '../ui';

interface ApplicationMetricsWidgetProps {
  data: NamespaceMetric[];
  config: any;
  onConfigChange?: (config: any) => void;
}

export function ApplicationMetricsWidget({ data, config, onConfigChange }: ApplicationMetricsWidgetProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(config?.cluster || null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(config?.namespace || null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get unique clusters from data
  const availableClusters = useMemo(() => {
    const clusterSet = new Set(data.map(m => m.clusterName));
    return Array.from(clusterSet).sort();
  }, [data]);

  // Sync selectedCluster and selectedNamespace with config when it changes externally
  useEffect(() => {
    if (config?.cluster && config.cluster !== selectedCluster) {
      setSelectedCluster(config.cluster);
    }
    if (config?.namespace !== undefined && config.namespace !== selectedNamespace) {
      setSelectedNamespace(config.namespace);
    }
  }, [config?.cluster, config?.namespace]);

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

  // Save cluster and namespace selection to config when they change
  const handleClusterChange = (cluster: string) => {
    setSelectedCluster(cluster);
    setSelectedNamespace(null); // Clear namespace when cluster changes
    if (onConfigChange) {
      onConfigChange({ cluster, namespace: null });
    }
  };

  const handleNamespaceChange = (namespace: string | null) => {
    setSelectedNamespace(namespace);
    if (onConfigChange) {
      onConfigChange({ namespace });
    }
  };

  // Fetch namespaces when cluster is selected
  useEffect(() => {
    if (selectedCluster) {
      const fetchNamespaces = async () => {
        try {
          const namespaceList = await metricsService.getNamespaces(selectedCluster);
          setNamespaces(namespaceList);
          if (!selectedNamespace && namespaceList.length > 0) {
            const newNamespace = namespaceList[0];
            setSelectedNamespace(newNamespace);
            // Save to config
            if (onConfigChange) {
              onConfigChange({ namespace: newNamespace });
            }
          }
        } catch (err) {
          console.error('Failed to fetch namespaces:', err);
        }
      };
      fetchNamespaces();
    }
  }, [selectedCluster]);

  // Filter metrics by selected cluster and namespace
  const filteredMetrics = useMemo(() => {
    let filtered = data;
    if (selectedCluster) {
      filtered = filtered.filter(m => m.clusterName === selectedCluster);
    }
    if (selectedNamespace) {
      filtered = filtered.filter(m => m.namespace === selectedNamespace);
    }
    return filtered;
  }, [data, selectedCluster, selectedNamespace]);

  // Get latest metrics for each pod/container
  const latestPodMetrics = useMemo(() => {
    const podMap = new Map<string, NamespaceMetric>();
    filteredMetrics.forEach(metric => {
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
  }, [filteredMetrics]);

  // Calculate namespace-wide statistics
  const namespaceStats = useMemo(() => {
    if (latestPodMetrics.length === 0) {
      return {
        totalPods: 0,
        totalContainers: 0,
        totalCpuUsage: 0,
        totalMemoryUsage: 0
      };
    }

    const uniquePods = new Set(latestPodMetrics.map(m => `${m.namespace}/${m.pod}`));
    const totalCpuUsage = latestPodMetrics.reduce((sum, m) => sum + m.cpuUsageCores, 0);
    const totalMemoryUsage = latestPodMetrics.reduce((sum, m) => sum + m.memoryUsageBytes, 0);

    return {
      totalPods: uniquePods.size,
      totalContainers: latestPodMetrics.length,
      totalCpuUsage,
      totalMemoryUsage
    };
  }, [latestPodMetrics]);

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

      {/* Namespace Selector */}
      {selectedCluster && namespaces.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Namespace:</span>
          <select
            value={selectedNamespace || ''}
            onChange={(e) => handleNamespaceChange(e.target.value || null)}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg dark:bg-gray-700 bg-gray-100 border 
                     dark:border-gray-600 border-gray-300 dark:text-white text-gray-900
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Pods</span>
            <Package className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-lg font-bold dark:text-white text-gray-900">
            {namespaceStats.totalPods}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Containers</span>
            <Layers className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-lg font-bold dark:text-white text-gray-900">
            {namespaceStats.totalContainers}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">CPU Usage</span>
            <Cpu className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-sm font-bold dark:text-white text-gray-900">
            {namespaceStats.totalCpuUsage.toFixed(3)} cores
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Memory Usage</span>
            <HardDrive className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-sm font-bold dark:text-white text-gray-900">
            {formatBytes(namespaceStats.totalMemoryUsage)}
          </p>
        </div>
      </div>

      {/* Pod List */}
      {latestPodMetrics.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Top Pods</h4>
          {latestPodMetrics
            .sort((a, b) => b.cpuUsageCores - a.cpuUsageCores)
            .slice(0, 5)
            .map((metric) => {
              const cpuPercent = metric.cpuLimitCores !== null 
                ? (metric.cpuUsageCores / metric.cpuLimitCores) * 100 
                : null;
              return (
                <div key={`${metric.namespace}-${metric.pod}-${metric.container}`} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium dark:text-white text-gray-900 truncate">
                      {metric.pod}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {metric.namespace}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">CPU</span>
                      <span className="dark:text-white text-gray-900">
                        {metric.cpuUsageCores.toFixed(4)} cores
                        {cpuPercent !== null && ` (${cpuPercent.toFixed(1)}%)`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Memory</span>
                      <span className="dark:text-white text-gray-900">
                        {formatBytes(metric.memoryUsageBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          {latestPodMetrics.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              +{latestPodMetrics.length - 5} more containers
            </p>
          )}
        </div>
      )}
    </div>
  );
}

