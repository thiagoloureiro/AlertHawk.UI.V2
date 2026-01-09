import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, RefreshCw, TrendingUp
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend
} from 'recharts';
import { ClusterPrice } from '../types';
import clusterPriceService from '../services/clusterPriceService';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import { LoadingSpinner } from '../components/ui';
import { formatCompactDate, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

export function ClusterPrices() {
  const [prices, setPrices] = useState<ClusterPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(1440); // Default 24 hours
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [clusters, setClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<10 | 30 | 60>(30);

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

  // Fetch prices
  const fetchPrices = async (showLoading = true) => {
    if (!selectedCluster) {
      setPrices([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const pricesData = await clusterPriceService.getClusterPrices(selectedCluster, minutes);
      
      setPrices(pricesData);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError('Failed to load prices');
      toast.error('Failed to load prices', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch clusters and user clusters on mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchClusters(), fetchUserClusters()]);
      setClustersLoaded(true);
    };
    loadData();
  }, []);

  // Auto-select first cluster when clusters are available
  useEffect(() => {
    if (uniqueClusters.length > 0 && !selectedCluster) {
      setSelectedCluster(uniqueClusters[0]);
    } else if (selectedCluster && !uniqueClusters.includes(selectedCluster)) {
      // If selected cluster is no longer available, select first available
      if (uniqueClusters.length > 0) {
        setSelectedCluster(uniqueClusters[0]);
      } else {
        setSelectedCluster(null);
      }
    }
  }, [uniqueClusters, selectedCluster]);

  // Fetch prices when cluster or minutes change
  useEffect(() => {
    if (clustersLoaded && selectedCluster) {
      fetchPrices();
    }
  }, [selectedCluster, minutes, clustersLoaded]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedCluster) return;

    const interval = setInterval(() => {
      fetchPrices(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshInterval, selectedCluster, minutes]);

  // Prepare chart data for overall cluster (sum of all nodes at each timestamp)
  const chartDataOverall = useMemo(() => {
    if (prices.length === 0) return [];

    // Group prices by timestamp and sum all node prices
    const groupedByTime: Record<string, number> = {};

    prices.forEach(price => {
      const timestamp = price.timestamp;
      
      if (!groupedByTime[timestamp]) {
        groupedByTime[timestamp] = 0;
      }
      
      // Sum up all unitPrices at this timestamp (total cluster cost per hour)
      groupedByTime[timestamp] += price.unitPrice;
    });

    // Convert to array format for recharts
    return Object.entries(groupedByTime)
      .map(([timestamp, totalPrice]) => ({
        timestamp: timestamp,
        clusterPrice: totalPrice
      }))
      .sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateA - dateB;
      });
  }, [prices]);

  // Prepare chart data grouped by node (for individual node chart)
  const chartDataByNode = useMemo(() => {
    if (prices.length === 0) return [];

    // Group prices by timestamp and node
    const groupedByTime: Record<string, Record<string, number>> = {};
    const nodeNames = new Set<string>();

    prices.forEach(price => {
      nodeNames.add(price.nodeName);
      const timestamp = price.timestamp;
      
      if (!groupedByTime[timestamp]) {
        groupedByTime[timestamp] = {};
      }
      
      // Use unitPrice for the chart
      groupedByTime[timestamp][price.nodeName] = price.unitPrice;
    });

    // Convert to array format for recharts
    return Object.entries(groupedByTime)
      .map(([timestamp, nodePrices]) => {
        const entry: Record<string, string | number> = {
          timestamp: timestamp,
          ...nodePrices
        };
        return entry;
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp as string).getTime();
        const dateB = new Date(b.timestamp as string).getTime();
        return dateA - dateB;
      });
  }, [prices]);

  // Get unique node names for legend
  const uniqueNodes = useMemo(() => {
    return Array.from(new Set(prices.map(p => p.nodeName))).sort();
  }, [prices]);

  // Color palette for nodes
  const nodeColors = [
    '#818CF8', '#94A3B8', '#A78BFA', '#60A5FA', 
    '#34D399', '#FBBF24', '#FB7185', '#A855F7',
    '#10B981', '#F59E0B', '#EF4444', '#06B6D4'
  ];

  // Calculate total cost for the period
  const totalCost = useMemo(() => {
    if (prices.length === 0) return 0;
    
    // Group by node and calculate average price per hour
    const nodeCosts = new Map<string, number>();
    
    prices.forEach(price => {
      const key = price.nodeName;
      if (!nodeCosts.has(key)) {
        nodeCosts.set(key, 0);
      }
      // unitPrice is per hour, so we sum them up
      // Since we have multiple timestamps, we'll use the latest price per node
      const current = nodeCosts.get(key) || 0;
      nodeCosts.set(key, Math.max(current, price.unitPrice));
    });

    // Calculate total: sum of (price per hour * hours in period)
    const hours = minutes / 60;
    let total = 0;
    nodeCosts.forEach((pricePerHour) => {
      total += pricePerHour * hours;
    });

    return total;
  }, [prices, minutes]);

  // Calculate estimated monthly cost based on current prices
  const estimatedMonthlyCost = useMemo(() => {
    if (prices.length === 0) return 0;
    
    // Get the latest price per node (most recent timestamp for each node)
    const latestNodePrices = new Map<string, number>();
    
    // Sort prices by timestamp descending to get latest first
    const sortedPrices = [...prices].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Get the latest price for each node
    sortedPrices.forEach(price => {
      if (!latestNodePrices.has(price.nodeName)) {
        latestNodePrices.set(price.nodeName, price.unitPrice);
      }
    });

    // Calculate total hourly cost (sum of all node prices)
    let totalHourlyCost = 0;
    latestNodePrices.forEach((pricePerHour) => {
      totalHourlyCost += pricePerHour;
    });

    // Multiply by hours in a month (730 hours = ~30.42 days)
    return totalHourlyCost * 730;
  }, [prices]);

  // Get period label
  const getPeriodLabel = (mins: number) => {
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    const hours = Math.round(mins / 60);
    if (mins < 1440) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.round(mins / 1440);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cluster Prices</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchPrices(false)}
              disabled={isRefreshing || !selectedCluster}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cluster Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cluster
                </label>
                <select
                  value={selectedCluster || ''}
                  onChange={(e) => setSelectedCluster(e.target.value || null)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!clustersLoaded}
                >
                  <option value="">Select a cluster</option>
                  {uniqueClusters.map((cluster) => (
                    <option key={cluster} value={cluster}>
                      {cluster}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Period
                </label>
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={60}>Last Hour</option>
                  <option value={240}>Last 4 Hours</option>
                  <option value={480}>Last 8 Hours</option>
                  <option value={1440}>Last 24 Hours</option>
                  <option value={2880}>Last 48 Hours</option>
                  <option value={4320}>Last 3 Days</option>
                  <option value={10080}>Last 7 Days</option>
                </select>
              </div>

              {/* Auto Refresh */}
              <div className="flex items-end">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Auto Refresh
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRefreshEnabled}
                        onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                    {autoRefreshEnabled && (
                      <select
                        value={autoRefreshInterval}
                        onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as 10 | 30 | 60)}
                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value={10}>Every 10s</option>
                        <option value={30}>Every 30s</option>
                        <option value={60}>Every 60s</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && isInitialLoad ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 text-lg">{error}</p>
              <button
                onClick={() => fetchPrices()}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !selectedCluster ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Please select a cluster to view prices
              </p>
            </div>
          </div>
        ) : prices.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No price data available for the selected cluster and time period
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Estimated Cost</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      ${totalCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      For {getPeriodLabel(minutes)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Nodes</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {uniqueNodes.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Active nodes
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Est. Current Monthly Cost</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      ${estimatedMonthlyCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Based on current prices
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {/* Overall Cluster Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cluster Price Over Time
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataOverall}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#6B7280"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickFormatter={(time) => {
                        try {
                          const date = getLocalDateFromUTC(time);
                          return formatCompactDate(date);
                        } catch (error) {
                          console.error('Error formatting tick:', error);
                          return 'Invalid Date';
                        }
                      }}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      fontSize={12}
                      label={{ 
                        value: 'Total Price per Hour (USD)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }}
                      tickFormatter={(value) => `$${value.toFixed(3)}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                        fontSize: '12px',
                        padding: '8px'
                      }}
                      labelFormatter={(label) => {
                        try {
                          const date = getLocalDateFromUTC(label);
                          return formatCompactDate(date);
                        } catch (error) {
                          return label;
                        }
                      }}
                      formatter={(value: number) => `$${value.toFixed(4)}/hr`}
                    />
                    <Line
                      type="monotone"
                      dataKey="clusterPrice"
                      stroke="#818CF8"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Cluster Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart by Node */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Price Over Time by Node
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataByNode}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#6B7280"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickFormatter={(time) => {
                        try {
                          const date = getLocalDateFromUTC(time);
                          return formatCompactDate(date);
                        } catch (error) {
                          console.error('Error formatting tick:', error);
                          return 'Invalid Date';
                        }
                      }}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      fontSize={12}
                      label={{ 
                        value: 'Price per Hour (USD)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }}
                      tickFormatter={(value) => `$${value.toFixed(3)}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                        fontSize: '12px',
                        padding: '8px'
                      }}
                      labelFormatter={(label) => {
                        try {
                          const date = getLocalDateFromUTC(label);
                          return formatCompactDate(date);
                        } catch (error) {
                          return label;
                        }
                      }}
                      formatter={(value: number) => `$${value.toFixed(4)}/hr`}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value) => value}
                    />
                    {uniqueNodes.map((node, index) => (
                      <Line
                        key={node}
                        type="monotone"
                        dataKey={node}
                        stroke={nodeColors[index % nodeColors.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        name={node}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
