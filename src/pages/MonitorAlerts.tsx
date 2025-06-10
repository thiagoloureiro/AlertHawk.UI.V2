import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { AlertIncident, getEnvironmentName } from '../types';
import { convertUTCToLocal } from '../utils/dateUtils';
import { useParams } from 'react-router-dom';
import monitorService from '../services/monitorService';
import { toast } from 'react-hot-toast';

const timePeriods = [
  { value: '7', label: 'Last 7 Days' },
  { value: '15', label: 'Last 15 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' }
];

const environmentOptions = [
  { value: '0', label: 'All Environments' },
  { value: '1', label: 'Development' },
  { value: '2', label: 'Staging' },
  { value: '3', label: 'QA' },
  { value: '4', label: 'Testing' },
  { value: '5', label: 'PreProd' },
  { value: '6', label: 'Production' }
];

const recordsPerPageOptions = [10, 25, 50, 100];

const tableHeaders = [
  { label: 'Timestamp', key: 'timeStamp' },
  { label: 'Monitor Name', key: 'monitorName' },
  { label: 'Environment', key: 'environment' },
  { label: 'Message', key: 'message' },
  { label: 'Offline Duration', key: 'periodOffline' }
] as const;

export function MonitorAlerts() {
  const { monitorId } = useParams<{ monitorId?: string }>();
  const [alerts, setAlerts] = useState<AlertIncident[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [selectedEnvironment, setSelectedEnvironment] = useState('0');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const id = monitorId ? parseInt(monitorId, 10) : 0;
        const days = parseInt(selectedPeriod, 10);
        const data = await monitorService.getMonitorAlerts(id, days);
        // Sort the alerts by timestamp in descending order
        const sorted = [...data].sort((a, b) => {
          return new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime();
        });
        setAlerts(sorted);
        setFilteredAlerts(sorted);
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
        toast.error('Failed to fetch alerts', { position: 'bottom-right' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [monitorId, selectedPeriod]);

  // Filter alerts based on search term and environment
  useEffect(() => {
    let filtered = alerts;

    // Apply environment filter
    if (selectedEnvironment !== '0') {
      filtered = filtered.filter(alert => alert.environment === parseInt(selectedEnvironment, 10));
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(alert =>
        alert.monitorName.toLowerCase().includes(searchLower) ||
        alert.message.toLowerCase().includes(searchLower) ||
        alert.urlToCheck.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAlerts(filtered);
  }, [searchTerm, alerts, selectedEnvironment]);

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / recordsPerPage);
  const paginatedAlerts = filteredAlerts.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  if (isLoading) {
    return <div>Loading alerts...</div>;
  }

  return (
    <div className="h-full flex flex-col dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
      <div className="p-6">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {timePeriods.map(period => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Environment
            </label>
            <select
              value={selectedEnvironment}
              onChange={e => setSelectedEnvironment(e.target.value)}
              className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {environmentOptions.map(env => (
                <option key={env.value} value={env.value}>{env.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 dark:text-gray-400 text-gray-500" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                         border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                         dark:focus:ring-blue-400 transition-colors duration-200"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-6">
  
        {error ? (
          <div className="rounded-lg dark:bg-red-900/20 bg-red-50 p-4 mb-4 flex items-center gap-3
                        dark:text-red-200 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative flex-1 overflow-auto">
              {isLoading && (
                <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin dark:text-blue-400 text-blue-600" />
                </div>
              )}
              
              <table className="w-full dark:bg-gray-800 bg-white rounded-lg shadow-xs">
                <thead>
                  <tr className="dark:bg-gray-700 bg-gray-50">
                    {tableHeaders.map(({ label, key }) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} className="px-4 py-8 text-center dark:text-gray-400 text-gray-500">
                        No alerts found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    paginatedAlerts.map(alert => (
                      <tr key={alert.id} className="dark:hover:bg-gray-700 hover:bg-gray-50 
                                                  border-t dark:border-gray-700 border-gray-200
                                                  transition-colors duration-200">
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {convertUTCToLocal(alert.timeStamp)}
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          <div>
                            <div>{alert.monitorName}</div>
                            <div className="text-sm text-gray-500">{alert.urlToCheck}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium
                                           ${alert.environment === 6 
                                             ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                             : alert.environment === 2 
                                               ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                                               : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'}`}>
                            {getEnvironmentName(alert.environment)}
                          </span>
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {alert.message}
                        </td>
                        <td className="px-4 py-3 dark:text-gray-300 text-gray-900">
                          {alert.periodOffline} min
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 py-4 border-t dark:border-gray-700 border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm dark:text-gray-300 text-gray-700">
                Records per page:
              </label>
              <select
                value={recordsPerPage}
                onChange={e => {
                  setRecordsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                         dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
              >
                {recordsPerPageOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                         dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                         transition-colors duration-200"
              >
                Previous
              </button>
              <span className="dark:text-gray-300 text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                         dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                         transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}