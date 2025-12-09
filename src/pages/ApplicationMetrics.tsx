import { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend 
} from 'recharts';
import { 
  Package, Cpu, HardDrive, RefreshCw, 
  Activity, AlertCircle, Layers, ChevronDown, X, Maximize2, Minimize2, Search
} from 'lucide-react';
import { NamespaceMetric } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import { LoadingSpinner, Switch } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { PodLogModal } from '../components/PodLogModal';

export function ApplicationMetrics() {
  const [namespaceMetrics, setNamespaceMetrics] = useState<NamespaceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPodDropdownOpen, setIsPodDropdownOpen] = useState(false);
  const [podSearchFilter, setPodSearchFilter] = useState('');
  const [expandedChart, setExpandedChart] = useState<'cpu' | 'memory' | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState<{ namespace: string; pod: string; container: string; clusterName?: string } | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<10 | 30 | 60>(30);

  // Fetch namespace metrics
  const fetchMetrics = async (showLoading = true) => {
    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const metrics = await metricsService.getNamespaceMetrics(
        minutes, 
        selectedCluster || undefined,
        selectedNamespace || undefined
      );
      // Only update metrics after successful fetch to prevent blinking
      setNamespaceMetrics(metrics);
      setIsInitialLoad(false);
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
    if (selectedCluster && selectedNamespace) {
      fetchMetrics(!isInitialLoad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, selectedCluster, selectedNamespace]);

  // Close pod dropdown on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPodDropdownOpen) {
        setIsPodDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPodDropdownOpen]);

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

  // Fetch namespaces
  const fetchNamespaces = async () => {
    if (!selectedCluster) return;
    try {
      const namespaceList = await metricsService.getNamespaces(selectedCluster);
      setNamespaces(namespaceList);
    } catch (err) {
      console.error('Failed to fetch namespaces:', err);
      toast.error('Failed to load namespaces', { position: 'bottom-right' });
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

  // Filter metrics by selected cluster
  const filteredMetrics = useMemo(() => {
    if (!selectedCluster) return [];
    return namespaceMetrics.filter(m => m.clusterName === selectedCluster);
  }, [namespaceMetrics, selectedCluster]);

  // Get unique namespaces (from fetched namespaces list)
  const uniqueNamespaces = useMemo(() => {
    return [...namespaces].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [namespaces]);

  // Get unique pods (filtered by namespace if selected, from filtered metrics)
  const uniquePods = useMemo(() => {
    const pods = new Set(
      filteredMetrics
        .filter(m => !selectedNamespace || m.namespace === selectedNamespace)
        .map(m => m.pod)
    );
    return Array.from(pods).sort();
  }, [filteredMetrics, selectedNamespace]);

  // Filter pods based on search text
  const filteredPods = useMemo(() => {
    if (!podSearchFilter.trim()) {
      return uniquePods;
    }
    const searchLower = podSearchFilter.toLowerCase();
    return uniquePods.filter(pod => pod.toLowerCase().includes(searchLower));
  }, [uniquePods, podSearchFilter]);

  // Fetch clusters and user clusters on mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchClusters(), fetchUserClusters()]);
      setClustersLoaded(true);
    };
    loadData();
  }, []);

  // Fetch namespaces when cluster is selected
  useEffect(() => {
    if (selectedCluster) {
      fetchNamespaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster]);

  // Auto-select first cluster when clusters are available, or clear selection if current cluster is not permitted
  useEffect(() => {
    if (uniqueClusters.length > 0) {
      if (!selectedCluster) {
        setSelectedCluster(uniqueClusters[0]);
      } else if (!uniqueClusters.includes(selectedCluster)) {
        // Current selection is not in permitted clusters, select first available
        setSelectedCluster(uniqueClusters[0]);
        setSelectedNamespace(null); // Also clear namespace when cluster changes
        setSelectedPods([]); // Clear pod selection
      }
    } else if (selectedCluster) {
      // No permitted clusters available, clear selection
      setSelectedCluster(null);
      setSelectedNamespace(null);
      setSelectedPods([]);
    }
  }, [uniqueClusters, selectedCluster]);

  // Auto-select first namespace when namespaces are available and cluster is selected
  useEffect(() => {
    if (uniqueNamespaces.length > 0 && selectedCluster && !selectedNamespace) {
      setSelectedNamespace(uniqueNamespaces[0]);
    }
  }, [uniqueNamespaces, selectedCluster, selectedNamespace]);


  // Get latest metrics for each pod (from filtered metrics)
  const latestPodMetrics = useMemo(() => {
    if (!selectedCluster || !selectedNamespace) return [];
    
    const podMap = new Map<string, NamespaceMetric>();
    filteredMetrics.forEach(metric => {
      if (metric.namespace !== selectedNamespace) return;
      if (selectedPods.length > 0 && !selectedPods.includes(metric.pod)) return;

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
  }, [filteredMetrics, selectedCluster, selectedNamespace, selectedPods]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!selectedCluster || !selectedNamespace) {
      return [];
    }

    const dataMap = new Map<string, {
      timestamp: string;
      timestampValue: number;
      [key: string]: string | number | null;
    }>();

    const metricsToProcess = filteredMetrics.filter(m => {
      if (m.clusterName !== selectedCluster) return false;
      if (m.namespace !== selectedNamespace) return false;
      if (selectedPods.length > 0 && !selectedPods.includes(m.pod)) return false;
      return true;
    });

    // Optimized single pass: build data map directly
    const timestampMap = new Map<string, number>(); // timeKey -> timestampValue

    // Single pass: build data map and collect timestamps
    for (const metric of metricsToProcess) {
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
      const key = `${metric.namespace}/${metric.pod}/${metric.container}`;
      
      // CPU usage in cores (always use actual cores, not percentage)
      entry[`${key}_cpu`] = metric.cpuUsageCores;
      
      // Memory usage (in MB for readability)
      entry[`${key}_memory`] = metric.memoryUsageBytes / (1024 * 1024);
    }

    return Array.from(dataMap.values())
      .sort((a, b) => (a.timestampValue as number) - (b.timestampValue as number));
  }, [filteredMetrics, selectedCluster, selectedNamespace, selectedPods]);

  // Get containers that have data in chartData for chart rendering
  const chartContainers = useMemo(() => {
    if (chartData.length === 0) return [];
    
    const containerKeys = new Set<string>();
    chartData.forEach(dataPoint => {
      Object.keys(dataPoint).forEach(key => {
        if (key.endsWith('_cpu') || key.endsWith('_memory')) {
          const containerKey = key.replace(/_cpu$|_memory$/, '');
          containerKeys.add(containerKey);
        }
      });
    });
    
    return Array.from(containerKeys).sort();
  }, [chartData]);

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
        <LoadingSpinner text="Loading application metrics..." />
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
            You don't have permission to view any clusters. Please contact your administrator to request access to application metrics.
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
            <h1 className="text-3xl font-bold dark:text-white text-gray-900">Application Metrics</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor pod and container CPU and memory usage across namespaces
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
                  setSelectedNamespace(null); // Clear namespace selection when cluster changes
                  setSelectedPods([]); // Clear pod selection when cluster changes
                  setIsPodDropdownOpen(false);
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
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                       focus:ring-2 focus:ring-blue-500"
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
            {/* Auto Refresh Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Auto refresh:</span>
              <Switch
                checked={autoRefreshEnabled}
                onCheckedChange={setAutoRefreshEnabled}
              />
              {autoRefreshEnabled && (
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as 10 | 30 | 60)}
                  className="px-3 py-1.5 rounded-lg dark:bg-gray-800 bg-white border 
                           dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                           focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>
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
            {selectedCluster && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Namespace:</span>
                <select
                  value={selectedNamespace || ''}
                  onChange={(e) => {
                    setSelectedNamespace(e.target.value || null);
                    setSelectedPods([]);
                    setIsPodDropdownOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                           dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                           focus:ring-2 focus:ring-blue-500 flex items-center gap-2 min-w-[200px]"
                >
                  <option value="">Select Namespace</option>
                  {uniqueNamespaces.map(ns => (
                    <option key={ns} value={ns}>{ns}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Pod Filter (only if namespace is selected) */}
            {selectedNamespace && (
              <div className="flex items-center gap-2 relative">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pod:</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPodDropdownOpen(!isPodDropdownOpen);
                      if (!isPodDropdownOpen) {
                        setPodSearchFilter('');
                      }
                    }}
                    className="px-3 py-1 rounded-lg text-sm dark:bg-gray-800 bg-white border 
                             dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                             focus:ring-2 focus:ring-blue-500 min-w-[200px] text-left flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {selectedPods.length === 0 
                        ? 'All Pods' 
                        : selectedPods.length === 1 
                          ? selectedPods[0]
                          : `${selectedPods.length} pods selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isPodDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isPodDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsPodDropdownOpen(false)}
                      />
                      <div className="absolute z-20 mt-1 w-full max-w-[300px] dark:bg-gray-800 bg-white border 
                                    dark:border-gray-700 border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden
                                    flex flex-col">
                        <div className="p-2 border-b dark:border-gray-700 border-gray-200 flex items-center justify-between gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPods([...uniquePods])}
                              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPods([])}
                              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                          {selectedPods.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedPods([])}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="p-2 border-b dark:border-gray-700 border-gray-200">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search pods..."
                              value={podSearchFilter}
                              onChange={(e) => setPodSearchFilter(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full pl-8 pr-3 py-1.5 text-sm dark:bg-gray-700 bg-gray-50 border 
                                       dark:border-gray-600 border-gray-300 rounded-lg 
                                       dark:text-white text-gray-900 
                                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                       placeholder-gray-400 dark:placeholder-gray-500"
                            />
                            {podSearchFilter && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPodSearchFilter('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-48 p-2">
                          {filteredPods.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                              No pods found
                            </div>
                          ) : (
                            filteredPods.map(pod => (
                            <label
                              key={pod}
                              className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPods.includes(pod)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPods([...selectedPods, pod]);
                                  } else {
                                    setSelectedPods(selectedPods.filter(p => p !== pod));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                                         focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                                         focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                              />
                              <span className="text-sm dark:text-white text-gray-900 truncate">{pod}</span>
                            </label>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        {selectedCluster && selectedNamespace && chartData.length > 0 && (
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
                  label={{ value: 'CPU (cores)', angle: -90, position: 'insideLeft' , dy: 30, fontSize: 15}}
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
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {chartContainers.map((key, index) => {
                  const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#FB7185', '#A78BFA', '#818CF8', '#60A5FA'];
                  return (
                    <Line
                      key={`${key}_cpu`}
                      type="monotone"
                      dataKey={`${key}_cpu`}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      name={key.split('/').pop()}
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
                  label={{ value: 'Memory (MB)', angle: -90, position: 'insideLeft', dy: 35, fontSize: 15}}
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
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {chartContainers.map((key, index) => {
                  const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#FB7185', '#A78BFA', '#818CF8', '#60A5FA'];
                  return (
                    <Line
                      key={`${key}_memory`}
                      type="monotone"
                      dataKey={`${key}_memory`}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      name={key.split('/').pop()}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Pod Details Table */}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPod({
                              namespace: metric.namespace,
                              pod: metric.pod,
                              container: metric.container,
                              clusterName: metric.clusterName
                            });
                            setShowLogModal(true);
                          }}
                          className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Package className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm dark:text-white text-gray-900 hover:underline">
                            {metric.pod}
                          </span>
                        </button>
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
                      value: expandedChart === 'cpu' ? 'CPU (cores)' : 'Memory (MB)', 
                      angle: -90, 
                      position: 'insideLeft',
                      dy: expandedChart === 'cpu' ? 30 : 35,
                      fontSize: 15
                    }}
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
                    formatter={(value: number) => expandedChart === 'cpu' 
                      ? `${value.toFixed(4)} cores` 
                      : `${value.toFixed(2)} MB`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {chartContainers.map((key, index) => {
                    const colors = ['#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#FB7185', '#A78BFA', '#818CF8', '#60A5FA'];
                    return (
                      <Line
                        key={`${key}_${expandedChart}`}
                        type="monotone"
                        dataKey={`${key}_${expandedChart}`}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={key.split('/').pop()}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Pod Log Modal */}
      {selectedPod && (
        <PodLogModal
          isOpen={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setSelectedPod(null);
          }}
          namespace={selectedPod.namespace}
          pod={selectedPod.pod}
          container={selectedPod.container}
          clusterName={selectedPod.clusterName}
          hours={minutes}
        />
      )}
    </div>
  );
}

