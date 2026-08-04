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
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" text="Loading SSL certificates..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Failed to load certificates
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{error}</p>
          <button
            onClick={fetchSSLCertificates}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
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
        <div className="px-4 lg:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Monitoring
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              SSL certificate monitor
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Active HTTP monitors with certificate expiry checks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Environment
            </span>
            <select
              id="environment"
              value={environment}
              onChange={(e) => setEnvironment(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[10rem]"
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
      </div>

      <div className="p-4 lg:p-6">
        {monitors.length === 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 text-center">
            <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              No active SSL monitors found
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              No active HTTP monitors with SSL certificate monitoring enabled for this environment
              (certificate check on, not paused, HTTP type).
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Certificate status
                <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">
                  · {monitors.length} monitor{monitors.length === 1 ? '' : 's'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Sorted cert expiry for active SSL-enabled HTTP monitors
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Monitor name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                      onClick={() => handleSort('url')}
                    >
                      <div className="flex items-center gap-1">
                        URL
                        {getSortIcon('url')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                      onClick={() => handleSort('daysToExpire')}
                    >
                      <div className="flex items-center gap-1">
                        Days to expire
                        {getSortIcon('daysToExpire')}
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {getSortedMonitors().map((monitor) => {
                    const status = getCertificateStatus(monitor.daysToExpireCert);
                    return (
                      <tr
                        key={monitor.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/60"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusColor(status)}`}
                            >
                              {getStatusText(status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {monitor.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-600 dark:text-gray-300 break-all font-mono text-xs">
                            {monitor.urlToCheck}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium tabular-nums text-gray-900 dark:text-white">
                            {formatDaysToExpire(monitor.daysToExpireCert)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => openUrl(monitor.urlToCheck)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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
    </div>
  );
}
