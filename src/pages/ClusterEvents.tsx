import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, AlertCircle, RefreshCw, Filter,
  ChevronDown, ChevronUp, Search, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { KubernetesEventDto } from '../types';
import metricsService from '../services/metricsService';
import userService from '../services/userService';
import { LoadingSpinner, Switch } from '../components/ui';
import { formatDateToLocale, getLocalDateFromUTC } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

export function ClusterEvents() {
  const [events, setEvents] = useState<KubernetesEventDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(1440); // Default 24 hours
  const [limit, setLimit] = useState(5000); // Keep high limit for API, pagination is client-side
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedInvolvedObjectKind, setSelectedInvolvedObjectKind] = useState<string>('all');
  const [clusters, setClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<string[]>([]);
  const [clustersLoaded, setClustersLoaded] = useState(false);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<10 | 30 | 60>(30);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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

  // Fetch namespaces
  const fetchNamespaces = async () => {
    if (!selectedCluster) {
      setNamespaces([]);
      return;
    }
    
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

  // Fetch events
  const fetchEvents = async (showLoading = true) => {
    try {
      if (showLoading && isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const eventType = selectedEventType === 'all' ? undefined : selectedEventType;
      const involvedObjectKind = selectedInvolvedObjectKind === 'all' ? undefined : selectedInvolvedObjectKind;

      const eventsData = await metricsService.getKubernetesEvents(
        selectedNamespace || undefined,
        involvedObjectKind,
        undefined, // involvedObjectName - can be added later if needed
        eventType,
        minutes,
        limit,
        selectedCluster || undefined
      );
      
      setEvents(eventsData);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Failed to load events');
      toast.error('Failed to load events', { position: 'bottom-right' });
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
      // Current selection is not in permitted clusters, select first available
      if (uniqueClusters.length > 0) {
        setSelectedCluster(uniqueClusters[0]);
      } else {
        setSelectedCluster(null);
      }
    }
  }, [uniqueClusters, selectedCluster]);

  // Fetch namespaces when cluster changes
  useEffect(() => {
    fetchNamespaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster]);

  // Fetch events when filters change
  useEffect(() => {
    if (selectedCluster) {
      // Only show full loading on initial load, otherwise just refresh the table
      if (isInitialLoad) {
        fetchEvents(true);
      } else {
        fetchEvents(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, selectedCluster, selectedNamespace, selectedEventType, selectedInvolvedObjectKind, limit]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedCluster) {
      return;
    }

    const interval = setInterval(() => {
      fetchEvents(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshEnabled, autoRefreshInterval, selectedCluster]);

  // Filter events by search term
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    
    const search = searchTerm.toLowerCase();
    return events.filter(event => 
      event.eventName.toLowerCase().includes(search) ||
      event.namespace.toLowerCase().includes(search) ||
      event.involvedObjectName.toLowerCase().includes(search) ||
      event.involvedObjectKind.toLowerCase().includes(search) ||
      event.reason.toLowerCase().includes(search) ||
      event.message.toLowerCase().includes(search) ||
      event.sourceComponent.toLowerCase().includes(search)
    );
  }, [events, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedNamespace, selectedEventType, selectedInvolvedObjectKind, selectedCluster]);

  // Get unique involved object kinds from events
  const uniqueInvolvedObjectKinds = useMemo(() => {
    const kinds = new Set(events.map(e => e.involvedObjectKind).filter(Boolean));
    return Array.from(kinds).sort();
  }, [events]);

  // Get event type color
  const getEventTypeColor = (eventType: string): string => {
    switch (eventType?.toLowerCase()) {
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'normal':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
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
        <LoadingSpinner text="Loading events..." />
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
            You don't have access to any clusters. Contact an administrator to request access to cluster events.
          </p>
        </div>
      </div>
    );
  }

  if (error && !selectedCluster) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{error}</p>
          <button
            onClick={() => fetchEvents()}
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
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Metrics
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Cluster events
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Kubernetes events across your clusters
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCluster || ''}
              onChange={(e) => {
                setSelectedCluster(e.target.value);
                setSelectedNamespace(null);
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
              <option value={60}>1 hour</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
              <option value={1440}>24 hours</option>
              <option value={2880}>48 hours</option>
              <option value={10080}>7 days</option>
            </select>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Auto</span>
              <Switch checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
              {autoRefreshEnabled && (
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value) as 10 | 30 | 60)}
                  className="px-1.5 py-0.5 rounded text-xs bg-transparent border-0 text-gray-900 dark:text-white focus:outline-none"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => fetchEvents(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">


        {/* Filters */}
        {showFilters && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
              <button
                onClick={() => {
                  setSelectedNamespace(null);
                  setSelectedEventType('all');
                  setSelectedInvolvedObjectKind('all');
                  setSearchTerm('');
                }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Namespace Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Namespace
                </label>
                <select
                  value={selectedNamespace || ''}
                  onChange={(e) => setSelectedNamespace(e.target.value || null)}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">All Namespaces</option>
                  {namespaces.map(ns => (
                    <option key={ns} value={ns}>{ns}</option>
                  ))}
                </select>
              </div>
              {/* Event Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Type
                </label>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="all">All Types</option>
                  <option value="Normal">Normal</option>
                  <option value="Warning">Warning</option>
                </select>
              </div>
              {/* Involved Object Kind Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Object Kind
                </label>
                <select
                  value={selectedInvolvedObjectKind}
                  onChange={(e) => setSelectedInvolvedObjectKind(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="all">All Kinds</option>
                  {uniqueInvolvedObjectKinds.map(kind => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </div>
              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search events..."
                    className="w-full pl-8 pr-8 py-2 rounded-lg dark:bg-gray-700 bg-white border 
                             dark:border-gray-600 border-gray-300 dark:text-white text-gray-900
                             focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Items Per Page Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Items per page:
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-lg dark:bg-gray-700 bg-white border 
                         dark:border-gray-600 border-gray-300 dark:text-white text-gray-900
                         focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        )}

        {/* Events Table */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden relative">
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-950/70 z-10 flex items-center justify-center rounded-lg">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg px-3 py-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium dark:text-white text-gray-900">Updating...</span>
              </div>
            </div>
          )}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-base font-semibold dark:text-white text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Events ({filteredEvents.length})
            </h3>
            {!selectedCluster && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Please select a cluster to view events
              </p>
            )}
          </div>
          {selectedCluster ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Namespace
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Object
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Message
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-900">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                          {isLoading ? 'Loading events...' : 'No events found'}
                        </td>
                      </tr>
                    ) : (
                      paginatedEvents.map((event) => {
                        const date = getLocalDateFromUTC(event.timestamp);
                        return (
                          <tr key={event.eventUid} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {date ? formatDateToLocale(date, {
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              }) : event.timestamp}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 text-xs font-semibold rounded border ${getEventTypeColor(event.eventType)}`}>
                                {event.eventType || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                              {event.namespace}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="text-xs">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {event.involvedObjectName}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {event.involvedObjectKind}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                              {event.reason}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-900 dark:text-white max-w-md">
                              <div className="truncate" title={event.message}>
                                {event.message}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {event.sourceComponent || '-'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                              {event.count}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {filteredEvents.length > 0 && totalPages > 1 && (
                <div className="px-4 py-3 border-t dark:border-gray-700 border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredEvents.length)} of {filteredEvents.length} events
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1.5 rounded-lg dark:bg-gray-700 bg-white border dark:border-gray-600 border-gray-300
                               dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-100 
                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200
                               flex items-center gap-1 text-xs"
                    >
                      <ChevronLeft className="w-3 h-3" />
                      Previous
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1.5 rounded-lg dark:bg-gray-700 bg-white border dark:border-gray-600 border-gray-300
                               dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-100 
                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200
                               flex items-center gap-1 text-xs"
                    >
                      Next
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center">
              <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please select a cluster to view events
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

