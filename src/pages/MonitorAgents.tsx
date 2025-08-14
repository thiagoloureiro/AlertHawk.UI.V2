import { useState, useEffect } from 'react';
import { Server, Globe, Info, AlertCircle, Activity, MapPin, Clock, Users, Zap, HelpCircle, X } from 'lucide-react';
import axios from 'axios';

interface MonitorAgent {
  id: number;
  hostname: string;
  timeStamp: string;
  isMaster: boolean;
  listTasks: number;
  version: string;
  monitorRegion: number;
}

// Helper function to convert region number to location name
const getRegionName = (region: number): string => {
  const regions: { [key: number]: string } = {
    1: 'Europe',
    2: 'Oceania',
    3: 'North America',
    4: 'South America',
    5: 'Africa',
    6: 'Asia',
    7: 'Custom',
    8: 'Custom2',
    9: 'Custom3',
    10: 'Custom4',
    11: 'Custom5'
  };
  return regions[region] || 'Unknown';
};

// Helper function to get region icon
const getRegionIcon = (region: number) => {
  const regionIcons: { [key: number]: JSX.Element } = {
    1: <Globe className="w-4 h-4 text-blue-500" />,
    2: <Globe className="w-4 h-4 text-green-500" />,
    3: <Globe className="w-4 h-4 text-purple-500" />,
    4: <Globe className="w-4 h-4 text-orange-500" />,
    5: <Globe className="w-4 h-4 text-red-500" />,
    6: <Globe className="w-4 h-4 text-indigo-500" />,
    7: <Server className="w-4 h-4 text-gray-500" />,
    8: <Server className="w-4 h-4 text-gray-500" />,
    9: <Server className="w-4 h-4 text-gray-500" />,
    10: <Server className="w-4 h-4 text-gray-500" />,
    11: <Server className="w-4 h-4 text-gray-500" />
  };
  return regionIcons[region] || <Server className="w-4 h-4 text-gray-500" />;
};

// Helper function to format relative time
const getRelativeTime = (timestamp: string): string => {
  try {
    const now = new Date();
    const checkTime = new Date(timestamp);
    const diffMs = now.getTime() - checkTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  } catch (error) {
    return 'Unknown';
  }
};

export function MonitorAgents() {
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMasterInfo, setShowMasterInfo] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await axios.get<MonitorAgent[]>(
          `${import.meta.env.VITE_APP_MONITORING_API_URL}api/Monitor/allMonitorAgents`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        setAgents(response.data);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setError('Failed to load monitor agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const totalAgents = agents.length;
  const totalMonitors = agents.reduce((sum, agent) => sum + agent.listTasks, 0);
  const masterAgent = agents.find(agent => agent.isMaster);
  const activeAgents = agents.filter(agent => agent.listTasks > 0).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="relative">
            <Server className="w-8 h-8 animate-pulse text-blue-500" />
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
          </div>
          <div className="text-lg font-medium">Loading monitor agents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Agents</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      {/* Enhanced Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
            <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold dark:text-white text-gray-900">Monitor Agents</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage and monitor your distributed monitoring infrastructure</p>
          </div>
        </div>
      </div>

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
              <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAgents}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
              <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Active Monitors</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalMonitors}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Active Agents</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeAgents}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-xl">
              <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Master Agent</p>
                <button
                  onClick={() => setShowMasterInfo(true)}
                  className="p-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-full transition-colors duration-200"
                  title="Learn about Master Agent"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {masterAgent ? getRegionName(masterAgent.monitorRegion) : 'None'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                v{masterAgent?.version || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Agents List */}
      <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Server className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <h2 className="text-xl font-semibold dark:text-white text-gray-900">Agent List</h2>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400 rounded-full">
              {totalAgents} agents
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="dark:bg-gray-700/50 bg-gray-50">
                <th className="px-6 py-4 text-left text-sm font-semibold dark:text-gray-300 text-gray-700">Agent Details</th>
                <th className="px-6 py-4 text-left text-sm font-semibold dark:text-gray-300 text-gray-700">Location</th>
                <th className="px-6 py-4 text-left text-sm font-semibold dark:text-gray-300 text-gray-700">Tasks</th>
                <th className="px-6 py-4 text-left text-sm font-semibold dark:text-gray-300 text-gray-700">Version</th>
                <th className="px-6 py-4 text-left text-sm font-semibold dark:text-gray-300 text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => (
                <tr 
                  key={agent.id}
                  className={`dark:hover:bg-gray-700/50 hover:bg-gray-50 transition-all duration-200 ${
                    index === 0 ? '' : 'border-t dark:border-gray-700/50 border-gray-200'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        agent.isMaster 
                          ? 'bg-purple-100 dark:bg-purple-900/20' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Server className={`w-5 h-5 ${
                          agent.isMaster 
                            ? 'text-purple-600 dark:text-purple-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold dark:text-white text-gray-900">
                            {agent.hostname}
                          </span>
                          {agent.isMaster && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 
                                         dark:bg-purple-900/20 dark:text-purple-200">
                              Master
                            </span>
                          )}
                        </div>
                        
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getRegionIcon(agent.monitorRegion)}
                      <span className="font-medium dark:text-gray-300 text-gray-700">
                        {getRegionName(agent.monitorRegion)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        agent.listTasks > 0
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
                      }`}>
                        {agent.listTasks} {agent.listTasks === 1 ? 'task' : 'tasks'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm dark:text-gray-300 text-gray-700">
                        v{agent.version}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      agent.listTasks > 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        agent.listTasks > 0 ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      {agent.listTasks > 0 ? 'Active' : 'Idle'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master Agent Info Dialog */}
      {showMasterInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl dark:bg-gray-800 bg-white rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold dark:text-white text-gray-900">Monitor Manager</h3>
              </div>
              <button
                onClick={() => setShowMasterInfo(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                The Monitor Manager system distributes monitoring tasks across multiple agents for optimal performance and reliability.
              </p>
              
              <div className="mb-6">
                <h4 className="text-lg font-semibold dark:text-white text-gray-900 mb-3">How It Works</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <strong>Scenario with 600 items to monitor:</strong> The Monitor Master fetches the list, checks which monitors are online, and distributes the tasks among them:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Master:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 1:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 2:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 3:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 4:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 5:</strong> 100 tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                      <span className="text-gray-700 dark:text-gray-300"><strong>Monitor Child 6:</strong> 100 tasks</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium dark:text-white text-gray-900 mb-1">Master Failover</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      If the master monitor goes offline, one of the child agents automatically assumes the master role.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium dark:text-white text-gray-900 mb-1">Dynamic Redistribution</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      If any child monitor goes offline, the 600 tasks are automatically redistributed among the remaining active agents.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end p-6 border-t dark:border-gray-700 border-gray-200">
              <button
                onClick={() => setShowMasterInfo(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}