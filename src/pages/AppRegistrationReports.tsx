import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../components/ui';
import azureAppSecretService, {
  AzureSecretsStatus,
  MonitorHistoryEntry,
} from '../services/azureAppSecretService';
import { AlertIncident } from '../types';
import { convertUTCToLocal } from '../utils/dateUtils';

const periodOptions = [
  { value: 7, label: 'Last 7 days' },
  { value: 15, label: 'Last 15 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
];

export function AppRegistrationReports() {
  const [status, setStatus] = useState<AzureSecretsStatus | null>(null);
  const [history, setHistory] = useState<MonitorHistoryEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertIncident[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'alerts'>('history');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusData, historyData, alertsData] = await Promise.all([
        azureAppSecretService.getStatus(),
        azureAppSecretService.getHistory(days),
        azureAppSecretService.getAlerts(days),
      ]);
      setStatus(statusData);
      setHistory(historyData);
      setAlerts(alertsData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const noMonitor = !status?.monitorId;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            App Registration Reports
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Check history and alerts for Azure app secret monitoring
            {status?.monitorName ? ` — ${status.monitorName}` : ''}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {noMonitor && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-amber-800 dark:text-amber-200">
          No notification monitor configured. Create one in App Registration Manager first.
        </div>
      )}

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Registered apps</p>
            <p className="text-2xl font-semibold">{status.registeredAppsCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total secrets</p>
            <p className="text-2xl font-semibold">{status.totalSecrets}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Expiring</p>
            <p className="text-2xl font-semibold text-amber-600">{status.expiringCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Alert threshold</p>
            <p className="text-2xl font-semibold">{status.daysBeforeExpiryToAlert} days</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Monitor</p>
            <p className="text-lg font-semibold">{status.monitorStatus ? 'Healthy' : 'Alert'}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Check history ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
              activeTab === 'alerts'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Alerts ({alerts.length})
          </button>
        </div>

        {activeTab === 'history' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-3">Timestamp</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      No history records for this period.
                    </td>
                  </tr>
                ) : (
                  history.map((entry, idx) => (
                    <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-3 whitespace-nowrap">{convertUTCToLocal(entry.timeStamp)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            entry.status
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {entry.status ? 'OK' : 'Alert'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-pre-wrap max-w-2xl">{entry.responseMessage}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-3">Timestamp</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      No alerts for this period.
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => (
                    <tr key={alert.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-3 whitespace-nowrap">{convertUTCToLocal(alert.timeStamp)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            alert.status
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {alert.status ? 'Recovered' : 'Alert'}
                        </span>
                      </td>
                      <td className="p-3">{alert.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
