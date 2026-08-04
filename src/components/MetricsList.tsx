import { useState, useEffect, useMemo, useCallback } from 'react';
import { MonitorGroup, Monitor } from '../types';
import { 
  AlertCircle, Globe, Network, ChevronDown, ChevronRight, 
  Search, Plus, ChevronsDown, ChevronsUp, Server, Filter, Clock, 
  Activity, Shield, AlertTriangle, Pause, Bot, X
} from 'lucide-react';
import monitorService from '../services/monitorService';
import { AddMonitorModal } from './AddMonitorModal';
import { GroupFilterModal } from './GroupFilterModal';
import { LoadingSpinner } from './ui';
import { toast } from 'react-hot-toast';

interface MetricsListProps {
  selectedMetric: Monitor | null;
  onSelectMetric: (metric: Monitor | null, group?: MonitorGroup) => void;
  refreshTrigger?: number;
  updatedMonitor?: { monitor: Monitor; timestamp: number } | null;
  onEnvironmentChange?: (environmentId: number) => void;
}

const getMonitorTypeInfo = (typeId: number, isOnline: boolean, isPaused: boolean) => {
  const statusColor = isPaused 
    ? 'text-gray-400 dark:text-gray-500'
    : isOnline 
      ? 'text-emerald-500 dark:text-emerald-400' 
      : 'text-red-500 dark:text-red-400';
  
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className={`w-3.5 h-3.5 ${statusColor}`} />,
        label: 'HTTP(S)'
      };
    case 3:
      return {
        icon: <Network className={`w-3.5 h-3.5 ${statusColor}`} />,
        label: 'TCP'
      };
    case 4:
      return {
        icon: <Server className={`w-3.5 h-3.5 ${statusColor}`} />,
        label: 'Kubernetes'
      };
    default:
      return {
        icon: <Globe className={`w-3.5 h-3.5 ${statusColor}`} />,
        label: 'Unknown'
      };
  }
};

const StatusDot = ({ status, paused }: { status: boolean; paused: boolean }) => {
  if (paused) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <Pause className="w-3 h-3" />
        Paused
      </span>
    );
  }

  if (status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Offline
    </span>
  );
};

const UptimeMini = ({ uptime24Hrs, uptime7Days }: { uptime24Hrs: number; uptime7Days: number }) => {
  const color = (uptime: number) => {
    if (uptime >= 99.5) return 'bg-emerald-500';
    if (uptime >= 95) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3 text-[11px] tabular-nums">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-gray-400 dark:text-gray-500 w-5 shrink-0">24h</span>
        <div className="w-12 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className={`h-full rounded-full ${color(uptime24Hrs)}`} style={{ width: `${Math.min(uptime24Hrs, 100)}%` }} />
        </div>
        <span className="text-gray-600 dark:text-gray-300 w-9 text-right">{uptime24Hrs.toFixed(1)}%</span>
      </div>
      <div className="hidden xl:flex items-center gap-1.5 min-w-0">
        <span className="text-gray-400 dark:text-gray-500 w-4 shrink-0">7d</span>
        <div className="w-12 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className={`h-full rounded-full ${color(uptime7Days)}`} style={{ width: `${Math.min(uptime7Days, 100)}%` }} />
        </div>
        <span className="text-gray-600 dark:text-gray-300 w-9 text-right">{uptime7Days.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const ResponseTimeBadge = ({ responseTime }: { responseTime: number }) => {
  const color =
    responseTime < 200
      ? 'text-emerald-600 dark:text-emerald-400'
      : responseTime < 500
        ? 'text-amber-600 dark:text-amber-400'
        : responseTime < 1000
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${color}`}>
      <Activity className="w-3 h-3" />
      {responseTime.toFixed(0)}ms
    </span>
  );
};

const CertBadge = ({
  checkCertExpiry,
  daysToExpire,
  monitorTypeId,
}: {
  checkCertExpiry: boolean;
  daysToExpire: number;
  monitorTypeId: number;
}) => {
  if (monitorTypeId !== 1 || !checkCertExpiry) return null;

  if (daysToExpire <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
        <AlertTriangle className="w-3 h-3" />
        Cert expired
      </span>
    );
  }

  if (daysToExpire <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        <Clock className="w-3 h-3" />
        {daysToExpire}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
      <Shield className="w-3 h-3" />
      {daysToExpire}d
    </span>
  );
};

const getMonitorCounts = (monitors: Monitor[]) => {
  return monitors.reduce(
    (acc, monitor) => {
      if (monitor.paused) {
        acc.paused += 1;
      } else if (monitor.status) {
        acc.online += 1;
      } else {
        acc.offline += 1;
      }
      return acc;
    },
    { online: 0, offline: 0, paused: 0 }
  );
};

const getStoredEnvironment = (): number => {
  try {
    const stored = localStorage.getItem('selectedEnvironment');
    return stored ? parseInt(stored, 10) : 6;
  } catch {
    return 6;
  }
};

const setStoredEnvironment = (environment: number): void => {
  try {
    localStorage.setItem('selectedEnvironment', environment.toString());
  } catch (error) {
    console.warn('Failed to save environment to localStorage:', error);
  }
};

export function MetricsList({ selectedMetric, onSelectMetric, updatedMonitor, onEnvironmentChange }: MetricsListProps) {
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<MonitorGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<number>(getStoredEnvironment());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null);
  const [areAllCollapsed, setAreAllCollapsed] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupFilterModal, setShowGroupFilterModal] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const updateMonitorInGroups = useCallback((updated: Monitor) => {
    setGroups(prevGroups => {
      return prevGroups.map(group => ({
        ...group,
        monitors: group.monitors.map(monitor => 
          monitor.id === updated.id ? updated : monitor
        )
      }));
    });
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextGroups = await monitorService.getDashboardGroups(selectedEnvironment);
      setGroups(nextGroups);
      setFilteredGroups(nextGroups);
    } catch (err) {
      console.error('Failed to fetch monitor groups:', err);
      setError('Failed to load monitor groups');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEnvironment]);

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredGroups]);

  useEffect(() => {
    setStoredEnvironment(selectedEnvironment);
  }, [selectedEnvironment]);

  useEffect(() => {
    if (updatedMonitor?.monitor) {
      updateMonitorInGroups(updatedMonitor.monitor);
    }
  }, [updatedMonitor?.timestamp, updateMonitorInGroups, updatedMonitor?.monitor]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    const filtered = groups
      .filter(group => selectedGroups.length === 0 || selectedGroups.includes(group.id.toString()))
      .map(group => ({
        ...group,
        monitors: group.monitors.filter(monitor => {
          const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase());
          
          if (monitor.paused) {
            return matchesSearch && statusFilter === 'all';
          }
          
          let matchesStatus: boolean;
          if (statusFilter === 'all') {
            matchesStatus = true;
          } else if (statusFilter === 'online') {
            matchesStatus = monitor.status;
          } else {
            matchesStatus = !monitor.status;
          }
          return matchesSearch && matchesStatus;
        })
      })).filter(group => group.monitors.length > 0);

    setFilteredGroups(filtered);
  }, [groups, searchTerm, statusFilter, selectedGroups]);

  const toggleCollapse = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleGroupSelect = (group: MonitorGroup) => {
    const groupId = group.id.toString();
    if (selectedGroup === groupId) {
      setSelectedGroup(null);
      onSelectMetric(null);
    } else {
      setSelectedGroup(groupId);
      onSelectMetric(null, group);
    }
  };

  const environments = [
    { id: 1, name: 'Development' },
    { id: 2, name: 'Staging' },
    { id: 3, name: 'QA' },
    { id: 4, name: 'Testing' },
    { id: 5, name: 'PreProd' },
    { id: 6, name: 'Production' }
  ];

  const handleEnvironmentChange = (environmentId: number) => {
    setSelectedEnvironment(environmentId);
    onEnvironmentChange?.(environmentId);
  };

  const handleToggleAll = () => {
    if (areAllCollapsed) {
      setCollapsedGroups({});
    } else {
      const allCollapsed = sortedGroups.reduce((acc, group) => {
        acc[group.id.toString()] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setCollapsedGroups(allCollapsed);
    }
    setAreAllCollapsed(!areAllCollapsed);
  };

  const handleMonitorSelect = async (monitor: Monitor) => {
    try {
      setSelectedGroup(null);
      if (monitor.monitorTypeId === 3) {
        const tcpDetails = await monitorService.getMonitorTcpDetails(monitor.id);
        const monitorWithTcp: Monitor = {
          ...monitor,
          monitorTcp: {
            IP: tcpDetails.ip,
            port: tcpDetails.port
          }
        };
        onSelectMetric(monitorWithTcp);
      } else if (monitor.monitorTypeId === 4) {
        const k8sDetails = await monitorService.getMonitorK8sDetails(monitor.id);
        const groupId = monitor.monitorGroup || (k8sDetails as any).monitorGroup || (k8sDetails as any).MonitorGroup || k8sDetails.MonitorGroup || 0;
        const monitorWithK8s: Monitor = {
          ...monitor,
          monitorGroup: groupId,
          monitorK8s: {
            clusterName: k8sDetails.ClusterName || (k8sDetails as any).clusterName,
            kubeConfig: k8sDetails.KubeConfig || (k8sDetails as any).kubeConfig,
            monitorK8sNodes: k8sDetails.monitorK8sNodes
          }
        };
        onSelectMetric(monitorWithK8s);
      } else {
        onSelectMetric(monitor);
      }
    } catch (error) {
      console.error('Failed to fetch monitor details:', error);
      toast.error('Failed to load monitor details', { position: 'bottom-right' });
      onSelectMetric(monitor);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-950">
        <LoadingSpinner text="Loading monitors..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  const statusTabs: { id: 'all' | 'online' | 'offline'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'online', label: 'Online' },
    { id: 'offline', label: 'Offline' },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Unified toolbar */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
              Monitors
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {sortedGroups.length} group{sortedGroups.length !== 1 ? 's' : ''}
              {selectedGroups.length > 0 ? ` · ${selectedGroups.length} filtered` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                     bg-blue-600 hover:bg-blue-500 text-white
                     transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search monitors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 rounded-md text-sm
                       bg-gray-50 dark:bg-gray-900
                       border border-gray-200 dark:border-gray-800
                       text-gray-900 dark:text-white
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                       transition-shadow"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400
                         hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedEnvironment}
            onChange={(e) => handleEnvironmentChange(Number(e.target.value))}
            className="px-2 py-1 rounded-md text-xs font-medium
                     bg-gray-50 dark:bg-gray-900
                     border border-gray-200 dark:border-gray-800
                     text-gray-700 dark:text-gray-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30
                     transition-colors"
          >
            {environments.map(env => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>

          <div className="inline-flex p-0.5 rounded-md bg-gray-100 dark:bg-gray-900
                          ring-1 ring-inset ring-gray-200/80 dark:ring-gray-800">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === tab.id
                    ? tab.id === 'online'
                      ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : tab.id === 'offline'
                        ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowGroupFilterModal(true)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                     border transition-colors ${
              selectedGroups.length > 0
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="w-3 h-3" />
            {selectedGroups.length > 0 ? `${selectedGroups.length}` : 'Groups'}
          </button>

          <button
            onClick={handleToggleAll}
            className="ml-auto p-1.5 rounded-md text-gray-500 dark:text-gray-400
                     border border-gray-200 dark:border-gray-800
                     hover:bg-gray-50 dark:hover:bg-gray-900
                     transition-colors"
            title={areAllCollapsed ? 'Expand all' : 'Collapse all'}
          >
            {areAllCollapsed ? (
              <ChevronsDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronsUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Monitor list */}
      <div className="flex-1 overflow-y-auto">
        {sortedGroups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-3">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No monitors found</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Try adjusting search or filters
            </p>
          </div>
        ) : (
          sortedGroups.map(group => {
            const { online, offline, paused } = getMonitorCounts(group.monitors);
            const isGroupSelected = selectedGroup === group.id.toString();
            const isCollapsed = collapsedGroups[group.id.toString()];
            
            return (
              <div key={group.id} className="border-b border-gray-100 dark:border-gray-900 last:border-b-0">
                {/* Group header */}
                <div
                  className={`flex items-center gap-1 px-2 py-2 transition-colors
                           ${isGroupSelected
                             ? 'bg-blue-50/80 dark:bg-blue-950/30'
                             : 'hover:bg-gray-50 dark:hover:bg-gray-900/60'}`}
                >
                  <button
                    onClick={(e) => toggleCollapse(e, group.id.toString())}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                             hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors shrink-0"
                    aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleGroupSelect(group)}
                    className="flex-1 min-w-0 text-left flex items-center justify-between gap-2 py-0.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {group.name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                        {group.avgUptime24Hrs.toFixed(2)}% · 24h avg
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400">{online}</span>
                      <span className="text-gray-300 dark:text-gray-700">/</span>
                      <span className="text-red-600 dark:text-red-400">{offline}</span>
                      {paused > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-gray-700">/</span>
                          <span className="text-gray-500 dark:text-gray-400">{paused}</span>
                        </>
                      )}
                    </div>
                  </button>

                  {import.meta.env.VITE_APP_ABBY_ENABLED === 'true' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupSelect(group);
                      }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500
                               hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                      title="Analysis with Abby"
                    >
                      <Bot className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                {/* Monitors */}
                {!isCollapsed && (
                  <div className="pb-1">
                    {group.monitors.map(monitor => {
                      const { icon, label } = getMonitorTypeInfo(
                        monitor.monitorTypeId, 
                        monitor.status,
                        monitor.paused
                      );
                      const isSelected = selectedMetric?.id === monitor.id;
                      
                      return (
                        <button
                          key={monitor.id}
                          onClick={() => handleMonitorSelect(monitor)}
                          className={`w-full text-left pl-8 pr-3 py-2.5 border-l-2 transition-colors
                                   ${isSelected
                                     ? 'bg-blue-50 dark:bg-blue-950/25 border-l-blue-500 dark:border-l-blue-400'
                                     : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0">{icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {monitor.name}
                                </span>
                                <StatusDot status={monitor.status} paused={monitor.paused} />
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {label} · {monitor.heartBeatInterval}m
                                </span>
                                <ResponseTimeBadge responseTime={monitor.monitorStatusDashboard.responseTime} />
                                <CertBadge
                                  checkCertExpiry={monitor.checkCertExpiry}
                                  daysToExpire={monitor.daysToExpireCert}
                                  monitorTypeId={monitor.monitorTypeId}
                                />
                              </div>
                              <div className="mt-1.5">
                                <UptimeMini
                                  uptime24Hrs={monitor.monitorStatusDashboard.uptime24Hrs}
                                  uptime7Days={monitor.monitorStatusDashboard.uptime7Days}
                                />
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <AddMonitorModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (newMonitor) => {
            try {
              const isK8sMonitor = (newMonitor as any)?.MonitorTypeId === 4 || (newMonitor as any)?.monitorTypeId === 4;
              
              if (!isK8sMonitor) {
                await monitorService.createMonitor(newMonitor);
              }
              const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
              setGroups(updatedGroups);
              setShowAddModal(false);
            } catch (error) {
              console.error('Failed to create monitor:', error);
            }
          }}
        />
      )}

      {showEditModal && monitorToEdit && (
        <AddMonitorModal
          onClose={() => {
            setShowEditModal(false);
            setMonitorToEdit(null);
          }}
          onAdd={async () => {}}
          onUpdate={async (updated) => {
            try {
              if (monitorToEdit.monitorTypeId === 3) {
                const success = await monitorService.updateMonitorTcp(updated as any);
                if (success) {
                  toast.success('Monitor updated successfully', { position: 'bottom-right' });
                  setShowEditModal(false);
                  const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
                  setGroups(updatedGroups);
                }
              } else if (monitorToEdit.monitorTypeId === 4) {
                await monitorService.updateMonitorK8s(updated as any);
                toast.success('Monitor updated successfully', { position: 'bottom-right' });
                setShowEditModal(false);
                const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
                setGroups(updatedGroups);
              } else {
                const success = await monitorService.updateMonitorHttp(updated as any);
                if (success) {
                  toast.success('Monitor updated successfully', { position: 'bottom-right' });
                  setShowEditModal(false);
                  const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
                  setGroups(updatedGroups);
                }
              }
            } catch (error) {
              console.error('Failed to update monitor:', error);
              toast.error('Failed to update monitor', { position: 'bottom-right' });
            }
          }}
          existingMonitor={monitorToEdit}
          isEditing={true}
        />
      )}

      {showGroupFilterModal && (
        <GroupFilterModal
          groups={groups}
          selectedGroups={selectedGroups}
          onClose={() => setShowGroupFilterModal(false)}
          onApply={setSelectedGroups}
        />
      )}
    </div>
  );
}
