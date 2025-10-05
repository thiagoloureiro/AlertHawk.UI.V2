import React, { useState, useEffect } from 'react';
import { Monitor, MonitorGroup } from '../types';
import monitorService from '../services/monitorService';
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';

type SortField = 'name' | 'url' | 'daysToExpire' | 'status';
type SortDirection = 'asc' | 'desc';

export function SSLCertificateMonitor() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<number>(6); // Default to Production
  const [sortField, setSortField] = useState<SortField>('daysToExpire');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchSSLCertificates();
  }, [environment]);

  const fetchSSLCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all monitor groups for the selected environment
      const groups = await monitorService.getDashboardGroups(environment);
      
      // Filter for HTTP monitors only (monitorTypeId = 1) with certificate checking enabled and not paused
      const httpMonitors = groups.flatMap((group: MonitorGroup) => 
        group.monitors.filter((monitor: Monitor) => 
          monitor.monitorTypeId === 1 && 
          monitor.urlToCheck &&
          monitor.checkCertExpiry === true &&
          monitor.paused === false
        )
      );

      setMonitors(httpMonitors);
    } catch (err) {
      console.error('Failed to fetch SSL certificates:', err);
      setError('Failed to load SSL certificate data');
    } finally {
      setLoading(false);
    }
  };

  const getCertificateStatus = (daysToExpire: number) => {
    if (daysToExpire <= 0) return 'expired';
    if (daysToExpire <= 7) return 'critical';
    if (daysToExpire <= 30) return 'warning';
    return 'healthy';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'expired':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300';
      case 'healthy':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'expired':
        return 'Expired';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Warning';
      case 'healthy':
        return 'Healthy';
      default:
        return 'Unknown';
    }
  };

  const formatDaysToExpire = (days: number) => {
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedMonitors = () => {
    return [...monitors].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'url':
          aValue = a.urlToCheck.toLowerCase();
          bValue = b.urlToCheck.toLowerCase();
          break;
        case 'daysToExpire':
          aValue = a.daysToExpireCert;
          bValue = b.daysToExpireCert;
          break;
        case 'status':
          aValue = getCertificateStatus(a.daysToExpireCert);
          bValue = getCertificateStatus(b.daysToExpireCert);
          // Custom order for status: expired, critical, warning, healthy
          const statusOrder = { 'expired': 0, 'critical': 1, 'warning': 2, 'healthy': 3 };
          aValue = statusOrder[aValue as keyof typeof statusOrder] ?? 4;
          bValue = statusOrder[bValue as keyof typeof statusOrder] ?? 4;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-300" /> : 
      <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading SSL certificates..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSSLCertificates}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SSL Certificate Monitor</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <label htmlFor="environment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Environment:
          </label>
          <select
            id="environment"
            value={environment}
            onChange={(e) => setEnvironment(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value={1}>Development</option>
            <option value={2}>Staging</option>
            <option value={3}>QA</option>
            <option value={4}>Testing</option>
            <option value={5}>PreProd</option>
            <option value={6}>Production</option>
          </select>
        </div>
      </div>

      {monitors.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active SSL Monitors Found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            No active HTTP monitors with SSL certificate monitoring enabled found for the selected environment.
          </p>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>Only monitors with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Certificate monitoring enabled (checkCertExpiry = true)</li>
              <li>Monitor not paused</li>
              <li>HTTP monitor type</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active SSL Certificate Status ({monitors.length} monitors)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Showing only active HTTP monitors with certificate monitoring enabled
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Monitor Name
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('url')}
                  >
                    <div className="flex items-center gap-1">
                      URL
                      {getSortIcon('url')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('daysToExpire')}
                  >
                    <div className="flex items-center gap-1">
                      Days to Expire
                      {getSortIcon('daysToExpire')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {getSortedMonitors().map((monitor) => {
                  const status = getCertificateStatus(monitor.daysToExpireCert);
                  return (
                    <tr key={monitor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(status)}`}>
                            {getStatusText(status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{monitor.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white break-all">{monitor.urlToCheck}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDaysToExpire(monitor.daysToExpireCert)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openUrl(monitor.urlToCheck)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open URL
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
