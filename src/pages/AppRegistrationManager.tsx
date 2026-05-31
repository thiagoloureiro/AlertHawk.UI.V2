import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../components/ui';
import azureAppSecretService, {
  AzureAppRegistrationWatch,
  AzureAppSecret,
  AzureSecretsConfig,
  AzureSecretsStatus,
} from '../services/azureAppSecretService';
import monitorService from '../services/monitorService';
import { MonitorGroup } from '../types';

type SortField = 'applicationDisplayName' | 'daysUntilExpiry' | 'lastChecked';

const emptyManualForm = {
  applicationDisplayName: '',
  appId: '',
  applicationObjectId: '',
};

export function AppRegistrationManager() {
  const [secrets, setSecrets] = useState<AzureAppSecret[]>([]);
  const [registrations, setRegistrations] = useState<AzureAppRegistrationWatch[]>([]);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [status, setStatus] = useState<AzureSecretsStatus | null>(null);
  const [config, setConfig] = useState<AzureSecretsConfig | null>(null);
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('daysUntilExpiry');

  const [monitorForm, setMonitorForm] = useState({
    name: 'Azure App Registration Secrets',
    monitorGroup: 0,
    monitorRegion: 3,
    monitorEnvironment: 6,
    heartBeatInterval: 60,
  });

  const [configForm, setConfigForm] = useState({
    enabled: false,
    daysBeforeExpiryToAlert: 30,
    cron: '0 */6 * * *',
  });

  const userInfo = useMemo(() => {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  }, []);

  const isAdmin = userInfo?.isAdmin === true;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [secretsData, statusData, configData, groupsData, registrationsData] = await Promise.all([
        azureAppSecretService.getSecrets(showExpiringOnly),
        azureAppSecretService.getStatus(),
        azureAppSecretService.getConfig(),
        monitorService.getMonitorGroupListByUser(),
        azureAppSecretService.getRegistrations(),
      ]);
      setSecrets(secretsData);
      setRegistrations(registrationsData);
      setStatus(statusData);
      setConfig(configData);
      setGroups(groupsData);
      setConfigForm({
        enabled: configData.enabled,
        daysBeforeExpiryToAlert: configData.daysBeforeExpiryToAlert,
        cron: configData.cron,
      });

      if (configData.monitorId > 0) {
        const monitor = await azureAppSecretService.getAnchorMonitor();
        if (monitor) {
          setMonitorForm({
            name: monitor.name,
            monitorGroup: 0,
            monitorRegion: monitor.monitorRegion,
            monitorEnvironment: monitor.monitorEnvironment,
            heartBeatInterval: monitor.heartBeatInterval,
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load app registration data');
    } finally {
      setLoading(false);
    }
  }, [showExpiringOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSecretStatus = (days: number) => {
    if (days <= 0) return 'expired';
    if (days <= 7) return 'critical';
    if (days <= 30) return 'warning';
    return 'healthy';
  };

  const sortedSecrets = useMemo(() => {
    return [...secrets].sort((a, b) => {
      if (sortField === 'applicationDisplayName') {
        return a.applicationDisplayName.localeCompare(b.applicationDisplayName);
      }
      if (sortField === 'lastChecked') {
        return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime();
      }
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
  }, [secrets, sortField]);

  const handleSaveConfig = async () => {
    if (!isAdmin) {
      toast.error('Admin access required to update configuration');
      return;
    }
    try {
      setSaving(true);
      const updated = await azureAppSecretService.updateConfig(configForm);
      setConfig(updated);
      toast.success('Configuration saved');
      await loadData();
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = manualForm.applicationDisplayName.trim();
    const appId = manualForm.appId.trim();
    const objectId = manualForm.applicationObjectId.trim();

    if (!name || !appId || !objectId) {
      toast.error('Display name, Application (client) ID, and Object ID are required');
      return;
    }

    try {
      setSaving(true);
      await azureAppSecretService.registerApplication({
        applicationObjectId: objectId,
        applicationDisplayName: name,
        appId,
      });
      toast.success(`Registered ${name}`);
      setManualForm(emptyManualForm);
      await loadData();
    } catch {
      toast.error('Failed to register app. It may already be registered.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnregister = async (id: number, name: string) => {
    if (!window.confirm(`Stop monitoring "${name}"?`)) {
      return;
    }
    try {
      await azureAppSecretService.unregisterApplication(id);
      toast.success('App unregistered');
      await loadData();
    } catch {
      toast.error('Failed to unregister app');
    }
  };

  const handleSaveMonitor = async () => {
    if (!monitorForm.name.trim() || !monitorForm.monitorGroup) {
      toast.error('Monitor name and group are required');
      return;
    }
    try {
      setSaving(true);
      if (config?.monitorId && config.monitorId > 0) {
        await azureAppSecretService.updateAnchorMonitor(monitorForm);
        toast.success('Monitor updated');
      } else {
        const id = await azureAppSecretService.createAnchorMonitor(monitorForm);
        toast.success(`Monitor created (ID: ${id})`);
      }
      await loadData();
    } catch {
      toast.error('Failed to save monitor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-7 h-7 text-blue-600" />
            App Registration Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Add app registrations manually to monitor client secret expiry
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Registered apps" value={status.registeredAppsCount} />
          <StatCard label="Total secrets" value={status.totalSecrets} />
          <StatCard label="Expiring soon" value={status.expiringCount} variant={status.expiringCount > 0 ? 'warning' : 'ok'} />
          <StatCard
            label="Monitor status"
            value={status.monitorStatus === undefined ? 'N/A' : status.monitorStatus ? 'Healthy' : 'Alert'}
            variant={status.monitorStatus === false ? 'error' : 'ok'}
          />
          <StatCard
            label="Last check"
            value={status.lastChecked ? new Date(status.lastChecked).toLocaleString() : 'Not yet'}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration
          </h2>
          {!config?.hasCredentials && (
            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              Azure credentials (TenantId, ClientId, ClientSecret) must be set in server appsettings for
              scheduled secret checks.
            </p>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={configForm.enabled}
              onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
              disabled={!isAdmin}
            />
            <span>Enabled</span>
          </label>
          <div>
            <label className="block text-sm font-medium mb-1">Days before expiry to alert</label>
            <input
              type="number"
              min={1}
              value={configForm.daysBeforeExpiryToAlert}
              onChange={(e) =>
                setConfigForm({ ...configForm, daysBeforeExpiryToAlert: parseInt(e.target.value, 10) || 30 })
              }
              disabled={!isAdmin}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check schedule (cron)</label>
            <input
              type="text"
              value={configForm.cron}
              onChange={(e) => setConfigForm({ ...configForm, cron: e.target.value })}
              disabled={!isAdmin}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500 mt-1">Background job checks registered apps on this schedule.</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save configuration
            </button>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Notification monitor</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Anchor monitor used for alerts and history. It stays paused and does not run HTTP checks.
          </p>
          {config?.monitorId ? (
            <p className="text-sm text-gray-500">Monitor ID: {config.monitorId}</p>
          ) : null}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={monitorForm.name}
              onChange={(e) => setMonitorForm({ ...monitorForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monitor group</label>
            <select
              value={monitorForm.monitorGroup}
              onChange={(e) => setMonitorForm({ ...monitorForm, monitorGroup: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value={0}>Select group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveMonitor}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {config?.monitorId ? 'Update monitor' : 'Create monitor'}
          </button>
        </section>
      </div>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-1">Registered for monitoring</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enter details from the Azure Portal (App registrations → your app → Overview).
          </p>

          <form onSubmit={handleRegister} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Display name</label>
              <input
                type="text"
                value={manualForm.applicationDisplayName}
                onChange={(e) => setManualForm({ ...manualForm, applicationDisplayName: e.target.value })}
                placeholder="My API App"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Application (client) ID</label>
              <input
                type="text"
                value={manualForm.appId}
                onChange={(e) => setManualForm({ ...manualForm, appId: e.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Object ID</label>
              <input
                type="text"
                value={manualForm.applicationObjectId}
                onChange={(e) => setManualForm({ ...manualForm, applicationObjectId: e.target.value })}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add app registration
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-3">Application</th>
                  <th className="text-left p-3">Client ID</th>
                  <th className="text-left p-3">Object ID</th>
                  <th className="text-left p-3">Added</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No apps registered yet. Use the form above to add one.
                    </td>
                  </tr>
                ) : (
                  registrations.map((reg) => (
                    <tr key={reg.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-3 font-medium">{reg.applicationDisplayName}</td>
                      <td className="p-3 font-mono text-xs">{reg.appId}</td>
                      <td className="p-3 font-mono text-xs">{reg.applicationObjectId}</td>
                      <td className="p-3">{new Date(reg.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleUnregister(reg.id, reg.applicationDisplayName)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Secret expiry (registered apps)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Updated by the scheduled background check when monitoring is enabled.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showExpiringOnly}
                onChange={(e) => setShowExpiringOnly(e.target.checked)}
              />
              Expiring only
            </label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="daysUntilExpiry">Sort by expiry</option>
              <option value="applicationDisplayName">Sort by name</option>
              <option value="lastChecked">Sort by last checked</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left p-3">Application</th>
                <th className="text-left p-3">App ID</th>
                <th className="text-left p-3">Secret</th>
                <th className="text-left p-3">Expires</th>
                <th className="text-left p-3">Days left</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedSecrets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {registrations.length === 0
                      ? 'Add app registrations above to start monitoring.'
                      : 'No secret data yet. Wait for the next scheduled check or enable monitoring in configuration.'}
                  </td>
                </tr>
              ) : (
                sortedSecrets.map((secret) => {
                  const st = getSecretStatus(secret.daysUntilExpiry);
                  return (
                    <tr key={`${secret.applicationObjectId}-${secret.keyId}`} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-3 font-medium">{secret.applicationDisplayName}</td>
                      <td className="p-3 font-mono text-xs">{secret.appId}</td>
                      <td className="p-3">{secret.secretDisplayName || secret.keyId}</td>
                      <td className="p-3">{new Date(secret.endDateTime).toLocaleDateString()}</td>
                      <td className="p-3">{secret.daysUntilExpiry}</td>
                      <td className="p-3">
                        <StatusBadge status={st} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'ok' | 'warning' | 'error';
}) {
  const colors = {
    default: 'border-gray-200 dark:border-gray-700',
    ok: 'border-green-200 dark:border-green-800',
    warning: 'border-yellow-200 dark:border-yellow-800',
    error: 'border-red-200 dark:border-red-800',
  };
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border p-4 ${colors[variant]}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-semibold mt-1 text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    expired: {
      icon: <AlertTriangle className="w-4 h-4" />,
      label: 'Expired',
      className: 'text-red-700 bg-red-50 dark:bg-red-900/20',
    },
    critical: {
      icon: <AlertTriangle className="w-4 h-4" />,
      label: 'Critical',
      className: 'text-red-700 bg-red-50 dark:bg-red-900/20',
    },
    warning: {
      icon: <Clock className="w-4 h-4" />,
      label: 'Warning',
      className: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20',
    },
    healthy: {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Healthy',
      className: 'text-green-700 bg-green-50 dark:bg-green-900/20',
    },
  };
  const c = config[status] ?? config.healthy;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}
