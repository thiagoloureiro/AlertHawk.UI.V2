import { useState, useEffect } from 'react';
import { Server, Globe, Info, AlertCircle } from 'lucide-react';
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

export function MonitorAgents() {
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="flex items-center gap-2 dark:text-gray-400 text-gray-600">
          <Server className="w-5 h-5 animate-pulse" />
          Loading agents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="text-red-500 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Monitor Agents</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Server className="w-6 h-6 dark:text-blue-400 text-blue-500" />
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Total Agents</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">{totalAgents}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Globe className="w-6 h-6 dark:text-green-400 text-green-500" />
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Running Tasks</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">{totalMonitors}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Info className="w-6 h-6 dark:text-purple-400 text-purple-500" />
            </div>
            <div>
              <p className="text-sm dark:text-gray-400 text-gray-600">Master Agent</p>
              <p className="text-lg font-medium dark:text-white text-gray-900">
                {masterAgent ? getRegionName(masterAgent.monitorRegion) : 'None'}
              </p>
              <p className="text-sm dark:text-gray-400 text-gray-600">
                v{masterAgent?.version || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 border-gray-200">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">Agent List</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="dark:bg-gray-700 bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Hostname</th>
                <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Tasks</th>
                <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Version</th>
                <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr 
                  key={agent.id}
                  className="dark:hover:bg-gray-700 hover:bg-gray-50 border-t 
                           dark:border-gray-700 border-gray-200 transition-colors duration-200"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="dark:text-white text-gray-900 font-medium">
                        {agent.hostname}
                      </span>
                      {agent.isMaster && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 
                                     dark:bg-purple-900/20 dark:text-purple-200">
                          Master
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 dark:text-gray-300 text-gray-700">
                    {getRegionName(agent.monitorRegion)}
                  </td>
                  <td className="px-4 py-3 dark:text-gray-300 text-gray-700">
                    {agent.listTasks}
                  </td>
                  <td className="px-4 py-3 dark:text-gray-300 text-gray-700">
                    v{agent.version}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                   bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                      running
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}