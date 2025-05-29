import { useState, useEffect, useMemo } from 'react';
import { MonitorGroup, Monitor } from '../types';
import { 
  AlertCircle, Loader2, Globe, Network, ChevronDown, ChevronRight, 
  Search, Plus, ChevronsDown, ChevronsUp, Server, Filter
} from 'lucide-react';
import monitorService from '../services/monitorService';
import { AddMonitorModal } from './AddMonitorModal';
import { GroupFilterModal } from './GroupFilterModal';
import { toast } from 'react-hot-toast';

interface MetricsListProps {
  selectedMetric: Monitor | null;
  onSelectMetric: (metric: Monitor | null, group?: MonitorGroup) => void;
}

// Helper function to get monitor type icon and label
const getMonitorTypeInfo = (typeId: number, isOnline: boolean, isPaused: boolean) => {
  const statusColor = isPaused 
    ? 'text-gray-400 dark:text-gray-500'
    : isOnline 
      ? 'text-green-500 dark:text-green-400' 
      : 'text-red-500 dark:text-red-400';
  
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className={`w-4 h-4 ${statusColor}`} />,
        label: 'HTTP(S)'
      };
    case 3:  // Changed from 2 to 3 for TCP
      return {
        icon: <Network className={`w-4 h-4 ${statusColor}`} />,
        label: 'TCP'
      };
    case 4:
      return {
        icon: <Server className={`w-4 h-4 ${statusColor}`} />,
        label: 'Kubernetes'
      };
    default:
      return {
        icon: <Globe className={`w-4 h-4 ${statusColor}`} />,
        label: 'Unknown'
      };
  }
};

// Update the monitor counts function to include paused
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

export function MetricsList({ selectedMetric, onSelectMetric }: MetricsListProps) {
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<MonitorGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<number>(6); // Default to Production (6)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null);
  const [areAllCollapsed, setAreAllCollapsed] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupFilterModal, setShowGroupFilterModal] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredGroups]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        const groups = await monitorService.getDashboardGroups(selectedEnvironment);
        setGroups(groups);
        setFilteredGroups(groups);
      } catch (err) {
        console.error('Failed to fetch monitor groups:', err);
        setError('Failed to load monitor groups');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [selectedEnvironment]);

  // Filter monitors based on search term, status, and selected groups
  useEffect(() => {
    const filtered = groups
      .filter(group => selectedGroups.length === 0 || selectedGroups.includes(group.id.toString()))
      .map(group => ({
        ...group,
        monitors: group.monitors.filter(monitor => {
          const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === 'all' 
            ? true 
            : statusFilter === 'online' ? monitor.status : !monitor.status;
          return matchesSearch && matchesStatus;
        })
      })).filter(group => group.monitors.length > 0); // Only show groups with matching monitors

    setFilteredGroups(filtered);
  }, [groups, searchTerm, statusFilter, selectedGroups]);

  // Separate toggle collapse function
  const toggleCollapse = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation(); // Prevent triggering the group selection
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Update group selection function
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

  // Add environment options
  const environments = [
    { id: 1, name: 'Development' },
    { id: 2, name: 'Staging' },
    { id: 3, name: 'QA' },
    { id: 4, name: 'Testing' },
    { id: 5, name: 'PreProd' },
    { id: 6, name: 'Production' }
  ];

  // Update the toggle function
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

  // Add this function to handle monitor selection
  const handleMonitorSelect = async (monitor: Monitor) => {
    try {
      if (monitor.monitorTypeId === 3) {
        // Fetch TCP details
        const tcpDetails = await monitorService.getMonitorTcpDetails(monitor.id);
        // Create the monitor object with TCP details
        const monitorWithTcp: Monitor = {
          ...monitor,
          monitorTcp: {
            IP: tcpDetails.ip,
            port: tcpDetails.port
          }
        };
        onSelectMetric(monitorWithTcp);
      } else if (monitor.monitorTypeId === 4) {
        // Fetch Kubernetes details
        const k8sDetails = await monitorService.getMonitorK8sDetails(monitor.id);
        // Create the monitor object with K8s details
        const monitorWithK8s: Monitor = {
          ...monitor,
          monitorK8s: {
            clusterName: k8sDetails.ClusterName,
            kubeConfig: k8sDetails.KubeConfig,
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
      // Still select the monitor even if details fail to load
      onSelectMetric(monitor);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading monitors...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b dark:border-gray-700 border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">Monitors</h2>
        </div>

        {/* Search and Add Button Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-5 h-5 dark:text-gray-400 text-gray-500" />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                       dark:border-gray-700 border-gray-200 dark:text-white text-gray-900"
            />
          </div>
          <button
            onClick={() => setShowGroupFilterModal(true)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200
                     ${selectedGroups.length > 0 
                       ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                       : 'dark:bg-gray-800 bg-white dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Filter className="w-4 h-4" />
            {selectedGroups.length > 0 ? `${selectedGroups.length} selected` : 'Filter Groups'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                     flex items-center gap-1.5 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="p-4 border-b dark:border-gray-700 border-gray-200">
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Environment Dropdown */}
          <select
            value={selectedEnvironment}
            onChange={(e) => setSelectedEnvironment(Number(e.target.value))}
            className="px-3 py-1 rounded-lg text-sm dark:bg-gray-800 bg-white border 
                     dark:border-gray-700 border-gray-300 dark:text-white text-gray-900
                     focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                     transition-colors duration-200"
          >
            {environments.map(env => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-4">
            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  statusFilter === 'all'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'dark:bg-gray-800 bg-white dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  statusFilter === 'online'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'dark:bg-gray-800 bg-white dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Online
              </button>
              <button
                onClick={() => setStatusFilter('offline')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  statusFilter === 'offline'
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'dark:bg-gray-800 bg-white dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Offline
              </button>
            </div>

            {/* Toggle Collapse/Expand Button */}
            <button
              onClick={handleToggleAll}
              className="p-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                       border-gray-300 dark:text-gray-300 text-gray-700
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              title={areAllCollapsed ? "Expand All" : "Collapse All"}
            >
              {areAllCollapsed ? (
                <ChevronsDown className="w-5 h-5" />
              ) : (
                <ChevronsUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Monitor List */}
      <div className="flex-1 overflow-y-auto">
        {sortedGroups.map(group => {
          const { online, offline, paused } = getMonitorCounts(group.monitors);
          
          return (
            <div key={group.id} className="space-y-2">
              <div
                className={`flex items-center justify-between p-4 rounded-lg 
                         ${selectedGroup === group.id.toString() 
                           ? 'bg-blue-50 dark:bg-blue-900/20' 
                           : 'dark:bg-gray-800/40 bg-gray-50/80 hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}
              >
                <div className="flex items-center gap-2">
                  {/* Collapse/Expand button */}
                  <button
                    onClick={(e) => toggleCollapse(e, group.id.toString())}
                    className="p-1 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {collapsedGroups[group.id.toString()] ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Group info and metrics - clickable for group selection */}
                  <div
                    onClick={() => handleGroupSelect(group)}
                    className="flex-1 cursor-pointer"
                  >
                    <h2 className="text-lg font-medium dark:text-white text-gray-900">{group.name}</h2>
                    <div className="text-sm dark:text-gray-400 text-gray-600">
                      Avg Uptime (24h): {group.avgUptime24Hrs.toFixed(2)}%
                    </div>
                  </div>
                </div>
                
                {/* Status indicators - also clickable for group selection */}
                <div 
                  onClick={() => handleGroupSelect(group)}
                  className="text-sm flex flex-col gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 justify-start">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="dark:text-gray-400 text-gray-600">{online} online</span>
                  </div>
                  <div className="flex items-center gap-2 justify-start">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    <span className="dark:text-gray-400 text-gray-600">{offline} offline</span>
                  </div>
                  {paused > 0 && (
                    <div className="flex items-center gap-2 justify-start">
                      <span className="h-2 w-2 rounded-full bg-gray-500 dark:bg-gray-400"></span>
                      <span className="dark:text-gray-400 text-gray-600">{paused} paused</span>
                    </div>
                  )}
                </div>
              </div>
              
              {!collapsedGroups[group.id.toString()] && (
                <div className="space-y-2 ml-7">
                  {group.monitors.map(monitor => {
                    const { icon, label } = getMonitorTypeInfo(
                      monitor.monitorTypeId, 
                      monitor.status,
                      monitor.paused
                    );
                    
                    return (
                      <div
                        key={monitor.id}
                        onClick={() => handleMonitorSelect(monitor)}
                        className={`p-4 rounded-lg cursor-pointer transition-colors duration-200
                                 ${selectedMetric?.id === monitor.id 
                                   ? 'bg-blue-50 dark:bg-blue-900/20' 
                                   : 'dark:bg-gray-800/40 bg-gray-50/80 hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{icon}</div>
                          
                          <div className="flex-1">
                            <h3 className="font-medium dark:text-white text-gray-900">
                              {monitor.name}
                            </h3>
                            <div className="text-sm dark:text-gray-400 text-gray-600">
                              {label}
                            </div>
                            
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div className="dark:text-gray-400 text-gray-600">
                                Response: {monitor.monitorStatusDashboard.responseTime.toFixed(0)}ms
                              </div>
                              <div className="dark:text-gray-400 text-gray-600">
                                Uptime 24h: {monitor.monitorStatusDashboard.uptime24Hrs.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Monitor Modal */}
      {showAddModal && (
        <AddMonitorModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (newMonitor) => {
            try {
              await monitorService.createMonitor(newMonitor);
              // Refresh the list
              const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
              setGroups(updatedGroups);
              setShowAddModal(false);
            } catch (error) {
              console.error('Failed to create monitor:', error);
            }
          }}
        />
      )}

      {/* Edit Monitor Modal */}
      {showEditModal && monitorToEdit && (
        <AddMonitorModal
          onClose={() => {
            setShowEditModal(false);
            setMonitorToEdit(null);
          }}
          onAdd={async () => {}} // Not used in edit mode
          onUpdate={async (updatedMonitor) => {
            try {
              const success = await monitorService.updateMonitorHttp(updatedMonitor);
              if (success) {
                toast.success('Monitor updated successfully', { position: 'bottom-right' });
                setShowEditModal(false);
                // Refresh the list
                const updatedGroups = await monitorService.getDashboardGroups(selectedEnvironment);
                setGroups(updatedGroups);
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

      {/* Group Filter Modal */}
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