import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  Server, Cpu, HardDrive, RefreshCw, 
  Activity, AlertCircle, Maximize2, Minimize2, Layers, ChevronDown, ChevronRight,
  Code, Cloud, CheckCircle, XCircle, HelpCircle, DollarSign, Bell, MessageSquare, Network
} from 'lucide-react';
import { NodeMetric, NamespaceMetric } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import azurePricingService from '../services/azurePricingService';
import { LoadingSpinner, Switch } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { ClusterNotificationModal } from '../components/ClusterNotificationModal';

export function Metrics() {
  const navigate = useNavigate();
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedChart, setExpandedChart] = useState<'cpu' | 'memory' | 'cpu-pie' | 'memory-pie' | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [namespaceMetrics, setNamespaceMetrics] = useState<NamespaceMetric[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodePricing, setNodePricing] = useState<Map<string, number | null>>(new Map());
  const [loadingPricing, setLoadingPricing] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<10 | 30 | 60>(30);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch pricing for Azure nodes
  const fetchPricingForNodes = async (metrics: NodeMetric[]) => {
    const azureNodes = metrics.filter(m => 
      m.cloudProvider?.toLowerCase() === 'aks' && 
      m.instanceType && 
      m.region
    );

    for (const node of azureNodes) {
      const key = `${node.nodeName}-${node.instanceType}-${node.region}`;
      
      // Skip if already loading or cached
      if (loadingPricing.has(key) || nodePricing.has(key)) {
        continue;
      }

      setLoadingPricing(prev => new Set(prev).add(key));
      
      try {
        // Use the node's operating system if available, default to 'Linux'
        const os = node.operatingSystem || 'Linux';
        const price = await azurePricingService.getVmPrice(node.instanceType!, node.region!, os);
        setNodePricing(prev => {
          const newMap = new Map(prev);
          newMap.set(key, price);
          return newMap;
        });
      } catch (error) {
        console.error(`Failed to fetch pricing for ${node.nodeName}:`, error);
        setNodePricing(prev => {
          const newMap = new Map(prev);
          newMap.set(key, null);
          return newMap;
        });
      } finally {
        setLoadingPricing(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    }
  };

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
        metricsService.getNodeMetrics(minutes, selectedCluster || undefined),
        metricsService.getNamespaceMetrics(minutes, selectedCluster || undefined)
      ]);
      setNodeMetrics(nodeMetricsData);
      setNamespaceMetrics(namespaceMetricsData);
      setIsInitialLoad(false);
      
      // Fetch pricing for Azure nodes (only for selected cluster if one is selected)
      if (selectedCluster) {
        const clusterNodes = nodeMetricsData.filter(m => m.clusterName === selectedCluster);
        fetchPricingForNodes(clusterNodes);
      } else {
        fetchPricingForNodes(nodeMetricsData);
      }
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
  }, [minutes, selectedCluster]);

  // Fetch pricing when cluster changes or node metrics update
  useEffect(() => {
    if (selectedCluster && nodeMetrics.length > 0) {
      const clusterNodes = nodeMetrics.filter(m => m.clusterName === selectedCluster);
      fetchPricingForNodes(clusterNodes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster, nodeMetrics]);

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

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const interval = setInterval(() => {
      fetchMetrics(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshEnabled, autoRefreshInterval]);

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
      return [...clusters].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    
    // Otherwise, filter to only show clusters user has permission to view
    if (userClusters.length === 0) {
      return [];
    }
    
    return clusters.filter(cluster => userClusters.includes(cluster))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
    let metrics = Array.from(nodeMap.values()).sort((a, b) => 
      a.nodeName.localeCompare(b.nodeName)
    );
    
    // Filter to show only live clusters (updated within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    metrics = metrics.filter(metric => {
      const metricDate = new Date(metric.timestamp);
      return metricDate >= tenMinutesAgo;
    });
    
    return metrics;
  }, [filteredMetrics]);

  // Get latest node details metrics (most recent from fetched metrics data)
  const latestNodeDetailsMetrics = useMemo(() => {
    if (!selectedCluster || nodeMetrics.length === 0) {
      return [];
    }
    
    // Filter metrics for selected cluster and get latest value for each node
    const clusterMetrics = nodeMetrics.filter(m => m.clusterName === selectedCluster);
    const nodeMap = new Map<string, NodeMetric>();
    clusterMetrics.forEach(metric => {
      const existing = nodeMap.get(metric.nodeName);
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        nodeMap.set(metric.nodeName, metric);
      }
    });
    
    return Array.from(nodeMap.values()).sort((a, b) => 
      a.nodeName.localeCompare(b.nodeName)
    );
  }, [nodeMetrics, selectedCluster]);

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
      // Disk metrics (bytes)
      entry[`${nodeKey}_diskReadBytes`] = metric.diskReadBytes ?? 0;
      entry[`${nodeKey}_diskWriteBytes`] = metric.diskWriteBytes ?? 0;
      entry[`${nodeKey}_diskReadOps`] = metric.diskReadOps ?? 0;
      entry[`${nodeKey}_diskWriteOps`] = metric.diskWriteOps ?? 0;
      // Network metrics (bytes)
      entry[`${nodeKey}_networkBytes`] = metric.networkUsageBytes ?? 0;
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
        usedMemoryBytes: 0,
        kubernetesVersion: undefined as string | undefined,
        cloudProvider: undefined as string | undefined,
        clusterEnvironment: undefined as string | undefined
      };
    }

    const totalCpuCores = latestNodeMetrics.reduce((sum, m) => sum + m.cpuCapacityCores, 0);
    const totalMemoryBytes = latestNodeMetrics.reduce((sum, m) => sum + m.memoryCapacityBytes, 0);
    const usedCpuCores = latestNodeMetrics.reduce((sum, m) => sum + m.cpuUsageCores, 0);
    const usedMemoryBytes = latestNodeMetrics.reduce((sum, m) => sum + m.memoryUsageBytes, 0);

    // Get kubernetesVersion, cloudProvider, and clusterEnvironment from first node (should be same for all nodes in cluster)
    const kubernetesVersion = latestNodeMetrics[0]?.kubernetesVersion;
    const cloudProvider = latestNodeMetrics[0]?.cloudProvider;
    const clusterEnvironment = latestNodeMetrics[0]?.clusterEnvironment;

    return {
      avgCpuUsage: (usedCpuCores / totalCpuCores) * 100,
      avgMemoryUsage: (usedMemoryBytes / totalMemoryBytes) * 100,
      totalNodes: latestNodeMetrics.length,
      totalCpuCores,
      totalMemoryBytes,
      usedCpuCores,
      usedMemoryBytes,
      kubernetesVersion,
      cloudProvider,
      clusterEnvironment
    };
  }, [latestNodeMetrics]);

  // Filter namespace metrics by selected cluster
  const filteredNamespaceMetrics = useMemo(() => {
    if (!selectedCluster) return [];
    return namespaceMetrics.filter(m => m.clusterName === selectedCluster);
  }, [namespaceMetrics, selectedCluster]);

  // Calculate total monthly cost of ALL nodes in the cluster (regardless of namespace pods)
  const totalClusterMonthlyCost = useMemo(() => {
    let total = 0;
    // Use latestNodeMetrics to match what's displayed in the table
    // This ensures we're calculating based on the same nodes that show prices
    const allNodes = latestNodeMetrics;
    
    // Get Azure nodes that need pricing
    const azureNodes = allNodes.filter(node => 
      node.instanceType && node.region && node.cloudProvider?.toLowerCase() === 'aks'
    );
       
    // Check if all Azure nodes have pricing loaded (either with price or null - meaning attempted)
    const pricingChecks = azureNodes.map(node => {
      const key = `${node.nodeName}-${node.instanceType}-${node.region}`;
      const hasKey = nodePricing.has(key);
      const isLoading = loadingPricing.has(key);
      return { node: node.nodeName, key, hasKey, isLoading };
    });
    
    const allPricingLoaded = azureNodes.every(node => {
      const key = `${node.nodeName}-${node.instanceType}-${node.region}`;
      return nodePricing.has(key) || !loadingPricing.has(key);
    });
    
    // Only calculate if all pricing is loaded
    if (!allPricingLoaded) {
      return 0;
    }
    
    azureNodes.forEach(node => {
      const key = `${node.nodeName}-${node.instanceType}-${node.region}`;
      const hourlyPrice = nodePricing.get(key);
      const hasKey = nodePricing.has(key);
      
      // Check if pricing exists (including null, which means pricing was attempted but failed)
      // Only skip if the key doesn't exist in the map at all (pricing not fetched yet)
      if (hasKey) {
        if (hourlyPrice !== null && hourlyPrice !== undefined) {
          const monthlyPrice = azurePricingService.calculateMonthlyPrice(hourlyPrice);
          if (monthlyPrice !== null) {
            total += monthlyPrice;
            
          } 
        } 
      } 
    });
  
    return total;
  }, [latestNodeMetrics, nodePricing, loadingPricing]);

  // Calculate total CPU and Memory capacity of ALL nodes in the cluster
  const totalClusterCapacity = useMemo(() => {
    // Use latestNodeMetrics to match what's displayed and used for pricing calculation
    const totalCpu = latestNodeMetrics.reduce((sum, node) => sum + node.cpuCapacityCores, 0);
    const totalMemory = latestNodeMetrics.reduce((sum, node) => sum + node.memoryCapacityBytes, 0);
    return { totalCpu, totalMemory };
  }, [latestNodeMetrics]);

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
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getUsageBgColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getEnvironmentColor = (environment?: string): string => {
    if (!environment) return 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-800';
    const env = environment.toUpperCase();
    switch (env) {
      case 'PROD':
      case 'PRODUCTION':
        return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-200/60 dark:ring-red-900/50';
      case 'TEST':
      case 'TESTING':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-900/50';
      case 'DEV':
      case 'DEVELOPMENT':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-200/60 dark:ring-blue-900/50';
      case 'QA':
        return 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 ring-1 ring-inset ring-violet-200/60 dark:ring-violet-900/50';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-800';
    }
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
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner text="Loading metrics..." />
      </div>
    );
  }

  if (hasNoPermissions) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            No cluster permissions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            You don't have access to any clusters. Contact an administrator to request metrics access.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{error}</p>
          <button
            onClick={() => fetchMetrics()}
            className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800
                      bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Metrics
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Cluster metrics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              CPU and memory across nodes and namespaces
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCluster || ''}
                onChange={(e) => {
                  setSelectedCluster(e.target.value);
                  setSelectedNode(null);
                }}
                className="px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[10rem]"
              >
                {uniqueClusters.map(cluster => (
                  <option key={cluster} value={cluster}>{cluster}</option>
                ))}
              </select>

              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
                <option value={1440}>24 hours</option>
                <option value={2880}>48 hours</option>
                <option value={10080}>7 days</option>
              </select>

              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md
                              bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Auto</span>
                <Switch
                  checked={autoRefreshEnabled}
                  onCheckedChange={setAutoRefreshEnabled}
                />
                {autoRefreshEnabled && (
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as 10 | 30 | 60)}
                    className="px-1.5 py-0.5 rounded text-xs bg-transparent border-0 text-gray-900 dark:text-white focus:outline-none focus:ring-0"
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  if (selectedCluster) {
                    setShowNotifications(true);
                  } else {
                    toast.error('Please select a cluster first', { position: 'bottom-right' });
                  }
                }}
                disabled={!selectedCluster}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                         border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Notifications
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedCluster) {
                    params.set('cluster', selectedCluster);
                  }
                  navigate(`/alerts${params.toString() ? `?${params.toString()}` : ''}`);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                         border border-amber-200 dark:border-amber-900/50
                         text-amber-700 dark:text-amber-400
                         hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                Alerts
              </button>
              <button
                onClick={() => fetchMetrics(false)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                         bg-blue-600 hover:bg-blue-500 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Cluster Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[11px] text-gray-500 dark:text-gray-400">Nodes</h3>
                {clusterStats.clusterEnvironment && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getEnvironmentColor(clusterStats.clusterEnvironment)} flex-shrink-0`}>
                    {clusterStats.clusterEnvironment.toUpperCase()}
                  </span>
                )}
              </div>
              <Server className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </div>
            <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {clusterStats.totalNodes}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] text-gray-500 dark:text-gray-400">Avg CPU</h3>
              <Cpu className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className={`text-xl font-semibold tabular-nums ${getUsageColor(clusterStats.avgCpuUsage)}`}>
              {clusterStats.avgCpuUsage.toFixed(1)}%
            </p>
            <div className="mt-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${getUsageBgColor(clusterStats.avgCpuUsage)}`}
                style={{ width: `${Math.min(clusterStats.avgCpuUsage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] text-gray-500 dark:text-gray-400">Avg memory</h3>
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className={`text-xl font-semibold tabular-nums ${getUsageColor(clusterStats.avgMemoryUsage)}`}>
              {clusterStats.avgMemoryUsage.toFixed(1)}%
            </p>
            <div className="mt-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${getUsageBgColor(clusterStats.avgMemoryUsage)}`}
                style={{ width: `${Math.min(clusterStats.avgMemoryUsage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] text-gray-500 dark:text-gray-400">CPU cores</h3>
              <Activity className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
              {clusterStats.usedCpuCores.toFixed(1)}
              <span className="text-sm font-medium text-gray-400"> / {clusterStats.totalCpuCores.toFixed(1)}</span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">
              {formatBytes(clusterStats.usedMemoryBytes)} / {formatBytes(clusterStats.totalMemoryBytes)} mem
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] text-gray-500 dark:text-gray-400">Cluster</h3>
              <div className="flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-gray-400" />
                <Cloud className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-[10px] text-gray-400">Version</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {clusterStats.kubernetesVersion || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Provider</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {clusterStats.cloudProvider || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[11px] text-gray-500 dark:text-gray-400">Est. cost</h3>
                <div className="relative group/tooltip">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 
                                w-64 p-3 bg-gray-950 text-white text-xs rounded-md 
                                shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity 
                                pointer-events-none z-[100] invisible group-hover/tooltip:visible ring-1 ring-white/10">
                    <div className="space-y-1.5">
                      <p className="font-semibold mb-1.5">Compute cost only</p>
                      <p>Reflects VM/node compute for the cluster.</p>
                      <p className="mt-2 font-semibold">Not included:</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-1">
                        <li>Load balancer</li>
                        <li>Storage</li>
                        <li>Network egress</li>
                        <li>Other infrastructure</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {totalClusterMonthlyCost > 0 
                ? azurePricingService.formatMonthlyPrice(totalClusterMonthlyCost)
                : Array.from(loadingPricing.values()).some(loading => loading)
                  ? '…'
                  : '-'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">
              {selectedCluster || 'No cluster selected'}
            </p>
          </div>
        </div>

        {/* Node Selector */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Nodes</span>
            <button
              onClick={() => setSelectedNode(null)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedNode === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {uniqueNodes.map(node => (
              <button
                key={node}
                onClick={() => setSelectedNode(node)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors max-w-[12rem] truncate ${
                  selectedNode === node
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
                title={node}
              >
                {node}
              </button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-950/70 z-10 flex items-center justify-center rounded-lg">
              <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg px-3 py-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium dark:text-white text-gray-900">Updating...</span>
              </div>
            </div>
          )}
          {/* CPU Usage Chart */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                CPU usage
              </h3>
              <button
                onClick={() => setExpandedChart('cpu')}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Memory usage
              </h3>
              <button
                onClick={() => setExpandedChart('memory')}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPU Distribution Pie Chart */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    CPU by namespace
                  </h3>
                </div>
                <button
                  onClick={() => setExpandedChart('cpu-pie')}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
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
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Memory by namespace
                  </h3>
                </div>
                <button
                  onClick={() => setExpandedChart('memory-pie')}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 relative">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 relative z-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Namespace consumption
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto relative overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50 relative z-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Namespace
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      CPU Usage
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Memory Usage
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Pods
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1.5">
                        <span>Est. Monthly Cost</span>
                        <div className="relative group/tooltip">
                          <HelpCircle 
                            className="w-3.5 h-3.5 text-gray-400 cursor-help" 
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
                              if (tooltip) {
                                tooltip.style.setProperty('--tooltip-top', `${rect.top - 8}px`);
                                tooltip.style.setProperty('--tooltip-left', `${rect.left + rect.width / 2}px`);
                              }
                            }}
                          />
                          <div className="fixed w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg 
                                        shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity 
                                        pointer-events-none z-[99999] invisible group-hover/tooltip:visible border border-gray-700"
                               style={{ 
                                 transform: 'translate(-50%, -100%)',
                                 top: 'var(--tooltip-top, 0)',
                                 left: 'var(--tooltip-left, 0)'
                               }}>
                            <div className="space-y-1.5">
                              <p className="font-semibold mb-1.5">How it's calculated:</p>
                              <p>1. Sum all node monthly costs in the cluster</p>
                              <p>2. Calculate namespace CPU usage % of total cluster CPU capacity</p>
                              <p>3. Calculate namespace Memory usage % of total cluster Memory capacity</p>
                              <p>4. Average the CPU and Memory percentages</p>
                              <p>5. Estimated cost = (Average % / 100) × Total cluster monthly cost</p>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-900">
                  {namespaceStats.map((ns) => {
                    // Calculate total used CPU and Memory across all namespaces
                    const totalUsedCpu = namespaceStats.reduce((sum, n) => sum + n.cpuUsageCores, 0);
                    const totalUsedMemory = namespaceStats.reduce((sum, n) => sum + n.memoryUsageBytes, 0);
                    
                    // Calculate percentage of total used resources (for display)
                    const cpuPercent = totalUsedCpu > 0 ? (ns.cpuUsageCores / totalUsedCpu) * 100 : 0;
                    const memoryPercent = totalUsedMemory > 0 ? (ns.memoryUsageBytes / totalUsedMemory) * 100 : 0;
                    
                    /**
                     * NAMESPACE COST CALCULATION EXPLANATION:
                     * 
                     * This calculates the estimated monthly cost for each namespace by proportionally
                     * allocating the total cluster monthly cost based on resource usage.
                     * 
                     * STEP-BY-STEP PROCESS:
                     * 
                     * 1. Calculate total cluster monthly cost:
                     *    - Sums up monthly costs of all Azure nodes in the cluster
                     *    - This is the total amount to be allocated across all namespaces
                     * 
                     * 2. For each namespace, calculate usage as % of cluster CAPACITY (not usage):
                     *    - CPU % = (namespace CPU usage / total cluster CPU capacity) × 100
                     *    - Memory % = (namespace Memory usage / total cluster Memory capacity) × 100
                     *    - Using CAPACITY ensures we account for unused resources too
                     * 
                     * 3. Average CPU and Memory percentages:
                     *    - avgUsagePercent = (cpuUsagePercent + memoryUsagePercent) / 2
                     *    - This gives equal weight to both CPU and Memory
                     * 
                     * 4. Calculate total average across ALL namespaces:
                     *    - Sums up avgUsagePercent for every namespace
                     *    - This represents the total "usage share" across all namespaces
                     * 
                     * 5. Normalize to ensure 100% allocation:
                     *    - normalizedPercent = (namespace avgUsagePercent / total avgUsagePercent) × 100
                     *    - This ensures all namespace costs sum to exactly 100% of totalClusterMonthlyCost
                     *    - Example: If namespace A has 30% avg and total is 60%, normalized = 50%
                     * 
                     * 6. Calculate final cost:
                     *    - estimatedMonthlyCost = (normalizedPercent / 100) × totalClusterMonthlyCost
                     * 
                     * WHY NORMALIZATION?
                     * - If total usage is less than 100% of capacity, without normalization,
                     *   the sum of namespace costs would be less than totalClusterMonthlyCost
                     * - Normalization ensures we allocate 100% of node costs, even if usage is lower
                     * - This reflects the reality that you pay for capacity, not just usage
                     * 
                     * EXAMPLE:
                     * - Cluster has 100 CPU cores capacity, costs $1000/month
                     * - Namespace A uses 20 cores (20% of capacity)
                     * - Namespace B uses 10 cores (10% of capacity)
                     * - Total usage: 30 cores (30% of capacity)
                     * 
                     * Without normalization:
                     *   - A: 20% × $1000 = $200
                     *   - B: 10% × $1000 = $100
                     *   - Total: $300 (only 30% of costs allocated!)
                     * 
                     * With normalization:
                     *   - A avg: (20% + 20%)/2 = 20% (assuming equal memory)
                     *   - B avg: (10% + 10%)/2 = 10%
                     *   - Total avg: 30%
                     *   - A normalized: (20% / 30%) × 100 = 66.67%
                     *   - B normalized: (10% / 30%) × 100 = 33.33%
                     *   - A cost: 66.67% × $1000 = $666.67
                     *   - B cost: 33.33% × $1000 = $333.33
                     *   - Total: $1000 (100% allocated!)
                     */
                    let estimatedMonthlyCost: number | null = null;
                    // Check if we have valid cluster capacity and cost data
                    // Also check if any pricing is still loading
                    const isPricingLoading = Array.from(loadingPricing.values()).some(loading => loading);
                    
                    if (totalClusterCapacity.totalCpu > 0 && totalClusterCapacity.totalMemory > 0 && totalClusterMonthlyCost > 0 && !isPricingLoading) {
                      // Step 2: Calculate CPU and Memory usage as percentage of total cluster CAPACITY
                      const cpuUsagePercent = (ns.cpuUsageCores / totalClusterCapacity.totalCpu) * 100;
                      const memoryUsagePercent = (ns.memoryUsageBytes / totalClusterCapacity.totalMemory) * 100;
                      
                      // Step 3: Average of CPU and Memory percentages for this namespace
                      const avgUsagePercent = (cpuUsagePercent + memoryUsagePercent) / 2;
                      
                      // Step 4: Calculate total average usage percent across ALL namespaces
                      const totalAvgUsagePercent = namespaceStats.reduce((sum, n) => {
                        const nsCpuPercent = (n.cpuUsageCores / totalClusterCapacity.totalCpu) * 100;
                        const nsMemoryPercent = (n.memoryUsageBytes / totalClusterCapacity.totalMemory) * 100;
                        return sum + (nsCpuPercent + nsMemoryPercent) / 2;
                      }, 0);
                      
                      // Step 5: Normalize to ensure all namespaces sum to 100% of total cost
                      // This ensures the sum of all namespace costs equals totalClusterMonthlyCost
                      const normalizedPercent = totalAvgUsagePercent > 0 
                        ? (avgUsagePercent / totalAvgUsagePercent) * 100 
                        : 0;
                      
                      // Step 6: Estimated cost = normalized percentage * total monthly cost
                      estimatedMonthlyCost = (normalizedPercent / 100) * totalClusterMonthlyCost;
                    }
                    
                    return (
                      <tr key={ns.namespace} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <Layers className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {ns.namespace}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ns.podCount}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {estimatedMonthlyCost !== null ? (
                            <span className="font-medium dark:text-white text-gray-900">
                              {azurePricingService.formatMonthlyPrice(estimatedMonthlyCost)}
                            </span>
                          ) : totalClusterMonthlyCost === 0 && Array.from(loadingPricing.values()).some(loading => loading) ? (
                            <span className="text-gray-400">Loading...</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Node details Table */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-950/70 z-10 flex items-center justify-center rounded-lg">
              <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg px-3 py-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium dark:text-white text-gray-900">Updating...</span>
              </div>
            </div>
          )}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Node details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Node Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    CPU Usage
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    CPU Capacity
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Memory Usage
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Memory Capacity
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    OS
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Architecture
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Region
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Instance Type
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Price/Hour
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Price/Month
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-900">
                {latestNodeDetailsMetrics.map((metric) => {
                  const cpuPercent = (metric.cpuUsageCores / metric.cpuCapacityCores) * 100;
                  const memoryPercent = (metric.memoryUsageBytes / metric.memoryCapacityBytes) * 100;
                  const date = getLocalDateFromUTC(metric.timestamp);
                  
                  const nodeNamespaceStats = getNamespaceMetricsForNode(metric.nodeName);
                  const isExpanded = expandedNodes.has(metric.nodeName);
                  
                  return (
                    <React.Fragment key={metric.nodeName}>
                    <tr 
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/60 cursor-pointer"
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-1" />
                          )}
                          <Server className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {metric.nodeName}
                          </span>
                          {nodeNamespaceStats.length > 0 && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({nodeNamespaceStats.length} namespace{nodeNamespaceStats.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const hasIssues = 
                            metric.isReady === false || 
                            metric.hasMemoryPressure === true || 
                            metric.hasDiskPressure === true || 
                            metric.hasPidPressure === true;
                          
                          if (!hasIssues && metric.isReady !== undefined) {
                            return (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">Ready</span>
                              </div>
                            );
                          }
                          
                          if (hasIssues) {
                            const issues = [];
                            if (metric.isReady === false) {
                              issues.push('Not Ready');
                            }
                            if (metric.hasMemoryPressure === true) {
                              issues.push('Memory Pressure');
                            }
                            if (metric.hasDiskPressure === true) {
                              issues.push('Disk Pressure');
                            }
                            if (metric.hasPidPressure === true) {
                              issues.push('PID Pressure');
                            }
                            
                            return (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                    {issues.length} Issue{issues.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {issues.map((issue, idx) => (
                                    <span 
                                      key={idx}
                                      className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded"
                                    >
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          
                          return <span className="text-xs text-gray-400">-</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.cpuCapacityCores} cores
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatBytes(metric.memoryCapacityBytes)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {metric.operatingSystem?.toLowerCase() === 'linux' ? (
                            <img 
                              src="/assets/linux.png" 
                              alt="Linux" 
                              className="w-5 h-5 object-contain"
                              title="Linux"
                            />
                          ) : metric.operatingSystem?.toLowerCase() === 'windows' ? (
                            <img 
                              src="/assets/windows.png" 
                              alt="Windows" 
                              className="w-5 h-5 object-contain"
                              title="Windows"
                            />
                          ) : (
                            <Server className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.architecture || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.region || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {metric.instanceType || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {(() => {
                          if (!metric.instanceType || !metric.region || metric.cloudProvider?.toLowerCase() !== 'aks') {
                            return '-';
                          }
                          const key = `${metric.nodeName}-${metric.instanceType}-${metric.region}`;
                          const price = nodePricing.get(key);
                          const isLoading = loadingPricing.has(key);
                          
                          if (isLoading) {
                            return <span className="text-gray-400">Loading...</span>;
                          }
                          
                          return azurePricingService.formatPrice(price ?? null);
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {(() => {
                          if (!metric.instanceType || !metric.region || metric.cloudProvider?.toLowerCase() !== 'aks') {
                            return '-';
                          }
                          const key = `${metric.nodeName}-${metric.instanceType}-${metric.region}`;
                          const price = nodePricing.get(key);
                          const isLoading = loadingPricing.has(key);
                          
                          if (isLoading) {
                            return <span className="text-gray-400">Loading...</span>;
                          }
                          
                          const monthlyPrice = azurePricingService.calculateMonthlyPrice(price ?? null);
                          return azurePricingService.formatMonthlyPrice(monthlyPrice);
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {date ? formatCompactDate(date) : metric.timestamp}
                      </td>
                    </tr>
                    {isExpanded && nodeNamespaceStats.length > 0 && (
                      <tr className="bg-gray-50/80 dark:bg-gray-900/50">
                        <td colSpan={13} className="px-4 py-3">
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
                                  <tr className="border-b border-gray-200 dark:border-gray-800">
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Namespace</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">CPU Usage</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Memory Usage</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Pods</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
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
                      <tr className="bg-gray-50/80 dark:bg-gray-900/50">
                        <td colSpan={13} className="px-4 py-3">
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
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col p-4 md:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {expandedChart === 'cpu' ? (
                  <>
                    <Cpu className="w-6 h-6" />
                    CPU usage
                  </>
                ) : expandedChart === 'memory' ? (
                  <>
                    <HardDrive className="w-6 h-6" />
                    Memory usage
                  </>
                ) : expandedChart === 'cpu-pie' ? (
                  <>
                    <Cpu className="w-6 h-6" />
                    CPU by namespace
                  </>
                ) : (
                  <>
                    <HardDrive className="w-6 h-6" />
                    Memory by namespace
                  </>
                )}
              </h3>
              <button
                onClick={() => setExpandedChart(null)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
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
                    domain={expandedChart === 'cpu' || expandedChart === 'memory' ? [0, 100] : undefined}
                    label={{ 
                      value: expandedChart === 'cpu' ? 'CPU %' 
                        : expandedChart === 'memory' ? 'Memory %'
                        : 'Bytes', 
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
                    formatter={(value: number) => {
                      if (expandedChart === 'cpu' || expandedChart === 'memory') {
                        return `${value.toFixed(2)}%`;
                      }
                      return formatBytes(value);
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {(selectedNode ? [selectedNode] : uniqueNodes).map((node, index) => {
                    const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24'];
                    const chartName = expandedChart === 'cpu' ? 'CPU' : 'Memory';
                    const dataKey = expandedChart === 'cpu' ? `${node}_cpu` : `${node}_memory`;
                    return (
                      <Line
                        key={`${node}_${expandedChart}`}
                        type="monotone"
                        dataKey={dataKey}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={`${node} ${chartName}`}
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

      {showNotifications && selectedCluster && (
        <ClusterNotificationModal
          clusterName={selectedCluster}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
