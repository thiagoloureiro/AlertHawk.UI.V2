import { useEffect, useMemo, useState } from 'react';
import { X, Layers, Server, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { LoadingSpinner } from './ui';
import finopsService, { CostDetail, HistoricalCostDetail } from '../services/finopsService';

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--tooltip-bg, #1F2937)',
  border: '1px solid var(--tooltip-border, #374151)',
  borderRadius: '8px',
  color: 'var(--tooltip-text, #F9FAFB)',
  fontSize: '12px',
};

interface CostDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisRunId: number;
  subscriptionName: string;
}

type DisplayCostDetail = {
  id: number;
  costType: string;
  name: string | null;
  resourceGroup: string | null;
  cost: number;
  recordedAt: string;
};

type GroupedResourceGroupDetail = {
  id: number;
  costType: 'ResourceGroup';
  name: string;
  resourceGroup: string;
  cost: number;
  recordedAt: string;
};

type GroupedServiceDetail = {
  id: number;
  costType: 'Service';
  name: string;
  resourceGroup: string;
  cost: number;
  recordedAt: string;
};

type MonthOption = {
  key: string;
  label: string;
  isCurrentMonth: boolean;
};

function getMonthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return 'Unknown period';
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function normalizeCurrentCostDetails(details: CostDetail[]): DisplayCostDetail[] {
  return details.map((detail) => ({
    id: detail.id,
    costType: detail.costType,
    name: detail.name,
    resourceGroup: detail.resourceGroup,
    cost: detail.cost,
    recordedAt: detail.recordedAt,
  }));
}

function normalizeHistoricalCostDetails(details: HistoricalCostDetail[]): Record<string, DisplayCostDetail[]> {
  return details.reduce<Record<string, DisplayCostDetail[]>>((acc, detail, index) => {
    const monthKey = getMonthKey(detail.costDate || detail.recordedAt);
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push({
      id: detail.id ?? index,
      costType: detail.costType,
      name: detail.name,
      resourceGroup: detail.resourceGroup,
      cost: detail.cost,
      recordedAt: detail.costDate || detail.recordedAt,
    });
    return acc;
  }, {});
}

function getResourceGroupLabel(detail: Pick<DisplayCostDetail, 'name' | 'resourceGroup'>): string {
  return detail.resourceGroup?.trim() || detail.name?.trim() || 'Unassigned';
}

function groupResourceGroupDetails(details: DisplayCostDetail[]): GroupedResourceGroupDetail[] {
  const grouped = new Map<string, GroupedResourceGroupDetail>();

  for (const detail of details) {
    if (detail.costType !== 'ResourceGroup') continue;

    const resourceGroup = getResourceGroupLabel(detail);
    const existing = grouped.get(resourceGroup);

    if (existing) {
      existing.cost += detail.cost;
      if (new Date(detail.recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
        existing.recordedAt = detail.recordedAt;
      }
      continue;
    }

    grouped.set(resourceGroup, {
      id: detail.id,
      costType: 'ResourceGroup',
      name: resourceGroup,
      resourceGroup,
      cost: detail.cost,
      recordedAt: detail.recordedAt,
    });
  }

  return [...grouped.values()].sort((a, b) => b.cost - a.cost);
}

function groupServiceDetails(details: DisplayCostDetail[]): GroupedServiceDetail[] {
  const grouped = new Map<string, GroupedServiceDetail>();

  for (const detail of details) {
    if (detail.costType !== 'Service') continue;

    const name = detail.name?.trim() || 'Unnamed service';
    const resourceGroup = detail.resourceGroup?.trim() || '—';
    const groupKey = `${name}__${resourceGroup}`;
    const existing = grouped.get(groupKey);

    if (existing) {
      existing.cost += detail.cost;
      if (new Date(detail.recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
        existing.recordedAt = detail.recordedAt;
      }
      continue;
    }

    grouped.set(groupKey, {
      id: detail.id,
      costType: 'Service',
      name,
      resourceGroup,
      cost: detail.cost,
      recordedAt: detail.recordedAt,
    });
  }

  return [...grouped.values()].sort((a, b) => b.cost - a.cost);
}

/** Maps Azure resource provider namespaces to product-style labels for the cost-by-service chart. */
const AZURE_NAMESPACE_LABELS: Record<string, string> = {
  'Microsoft.OperationalInsights': 'Log Analytics',
  'Microsoft.Compute': 'Virtual Machines',
  'Microsoft.Storage': 'Storage',
  'Microsoft.Network': 'Networking',
  'Microsoft.Sql': 'SQL Database',
  'Microsoft.DocumentDB': 'Cosmos DB',
  'Microsoft.Web': 'App Service',
  'Microsoft.KeyVault': 'Key Vault',
  'Microsoft.Insights': 'Azure Monitor',
  'microsoft.insights': 'Azure Monitor',
  'Microsoft.DBforPostgreSQL': 'PostgreSQL',
  'Microsoft.DBforMySQL': 'MySQL',
  'Microsoft.Cache': 'Redis Cache',
  'Microsoft.ContainerService': 'Kubernetes Service (AKS)',
  'Microsoft.ContainerRegistry': 'Container Registry',
  'Microsoft.ServiceBus': 'Service Bus',
  'Microsoft.EventHub': 'Event Hubs',
  'Microsoft.Logic': 'Logic Apps',
  'Microsoft.StreamAnalytics': 'Stream Analytics',
  'Microsoft.DataFactory': 'Data Factory',
  'Microsoft.Search': 'Azure AI Search',
  'Microsoft.AnalysisServices': 'Analysis Services',
  'Microsoft.MachineLearningServices': 'Machine Learning',
  'Microsoft.CognitiveServices': 'Cognitive Services',
  'Microsoft.Media': 'Media Services',
  'Microsoft.BotService': 'Bot Service',
  'Microsoft.SignalRService': 'SignalR',
  'Microsoft.Automation': 'Automation',
  'Microsoft.RecoveryServices': 'Backup',
  'Microsoft.Databricks': 'Databricks',
  'Microsoft.Synapse': 'Synapse Analytics',
  'Microsoft.PowerBIDedicated': 'Power BI',
  'Microsoft.ApiManagement': 'API Management',
  'Microsoft.EventGrid': 'Event Grid',
  'Microsoft.NotificationHubs': 'Notification Hubs',
  'Microsoft.Relay': 'Relay',
  'Microsoft.TimeSeriesInsights': 'Time Series Insights',
  'Microsoft.DigitalTwins': 'Digital Twins',
  'Microsoft.IoTCentral': 'IoT Central',
  'Microsoft.Devices': 'IoT Hub',
  'Microsoft.Maps': 'Azure Maps',
  'Microsoft.Cdn': 'CDN',
  'Microsoft.FrontDoor': 'Front Door',
};

function formatNamespaceFallback(ns: string): string {
  return ns.replace(/^Microsoft\./, '').replace(/\./g, ' ');
}

/**
 * Groups individual service/meter rows into a product-style label (e.g. Log Analytics)
 * from ARM-style names or Microsoft.* provider strings.
 */
function deriveServiceTypeLabel(rawName: string | null | undefined): string {
  const trimmed = rawName?.trim();
  if (!trimmed) return 'Other';

  const armMatch = trimmed.match(/\/providers\/([^/]+)\//i);
  if (armMatch) {
    const ns = armMatch[1];
    return AZURE_NAMESPACE_LABELS[ns] ?? formatNamespaceFallback(ns);
  }

  const slashIdx = trimmed.indexOf('/');
  if (slashIdx > 0 && trimmed.startsWith('Microsoft.')) {
    const ns = trimmed.slice(0, slashIdx);
    return AZURE_NAMESPACE_LABELS[ns] ?? formatNamespaceFallback(ns);
  }

  if (trimmed.startsWith('Microsoft.')) {
    return AZURE_NAMESPACE_LABELS[trimmed] ?? formatNamespaceFallback(trimmed);
  }

  return trimmed;
}

function CostPieChart({
  data,
  title,
  icon,
  amountSuffix,
}: {
  data: { name: string; value: number }[];
  title: string;
  icon: React.ReactNode;
  /** When set, shows next to the total (e.g. month-to-date). */
  amountSuffix?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-8">
          No data available
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="ml-auto text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          ${total.toFixed(2)}
          {amountSuffix ? (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">{amountSuffix}</span>
          ) : null}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="48%"
            outerRadius={90}
            innerRadius={30}
            dataKey="value"
            labelLine={false}
            label={({ percent }) =>
              (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--tooltip-text, #F9FAFB)' }}
            labelStyle={{ color: 'var(--tooltip-text, #F9FAFB)' }}
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, 'Cost (MTD)']}
          />
          <Legend
            wrapperStyle={{
              fontSize: '11px',
              paddingTop: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
            verticalAlign="bottom"
            formatter={(value: string) => {
              // Truncate long names and add ellipsis
              const maxLen = 28;
              const truncated = value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
              return (
                <span className="text-gray-700 dark:text-gray-300 truncate" title={value}>
                  {truncated}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostDetailsModal({
  isOpen,
  onClose,
  analysisRunId,
  subscriptionName,
}: CostDetailsModalProps) {
  const [currentDetails, setCurrentDetails] = useState<DisplayCostDetail[]>([]);
  const [historicalDetailsByMonth, setHistoricalDetailsByMonth] = useState<Record<string, DisplayCostDetail[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableView, setTableView] = useState<'ResourceGroup' | 'Service'>('ResourceGroup');
  const [nameFilter, setNameFilter] = useState('');
  const [resourceGroupFilter, setResourceGroupFilter] = useState('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('current');

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setCurrentDetails([]);
      setHistoricalDetailsByMonth({});
      setSelectedMonthKey('current');
      try {
        const [currentData, historicalData] = await Promise.all([
          finopsService.getCostDetails(analysisRunId),
          finopsService.getHistoricalCostDetails(analysisRunId),
        ]);
        setCurrentDetails(normalizeCurrentCostDetails(currentData));
        setHistoricalDetailsByMonth(normalizeHistoricalCostDetails(historicalData));
      } catch {
        setError('Failed to load cost details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, analysisRunId]);

  const monthOptions = useMemo<MonthOption[]>(() => {
    const historicalMonths = Object.keys(historicalDetailsByMonth)
      .sort((a, b) => b.localeCompare(a))
      .map((monthKey) => ({
        key: monthKey,
        label: formatMonthLabel(monthKey),
        isCurrentMonth: false,
      }));

    return [
      { key: 'current', label: 'Current month', isCurrentMonth: true },
      ...historicalMonths,
    ];
  }, [historicalDetailsByMonth]);

  const selectedMonthIndex = useMemo(
    () => monthOptions.findIndex((month) => month.key === selectedMonthKey),
    [monthOptions, selectedMonthKey],
  );

  const details = useMemo(() => {
    if (selectedMonthKey === 'current') return currentDetails;
    return historicalDetailsByMonth[selectedMonthKey] ?? [];
  }, [currentDetails, historicalDetailsByMonth, selectedMonthKey]);

  const groupedResourceGroupDetails = useMemo(
    () => groupResourceGroupDetails(details),
    [details],
  );

  const groupedServiceDetails = useMemo(
    () => groupServiceDetails(details),
    [details],
  );

  const selectedMonth = monthOptions[selectedMonthIndex] ?? monthOptions[0] ?? { key: 'current', label: 'Current month', isCurrentMonth: true };

  const amountSuffix = selectedMonth.isCurrentMonth ? 'MTD' : selectedMonth.label;

  // Helper function to limit chart items and group small ones as "Other"
  const limitChartData = (
    items: { name: string; value: number }[],
    maxItems: number = 12,
  ): { name: string; value: number }[] => {
    if (items.length <= maxItems) return items;

    const top = items.slice(0, maxItems);
    const others = items.slice(maxItems);
    const otherValue = others.reduce((sum, item) => sum + item.value, 0);

    return [...top, { name: 'Other', value: otherValue }];
  };

  const rgData = useMemo(
    () => {
      const data = groupedResourceGroupDetails.map((d) => ({ name: d.resourceGroup, value: d.cost }));
      return limitChartData(data);
    },
    [groupedResourceGroupDetails],
  );

  const svcData = useMemo(() => {
    const byType = new Map<string, number>();
    for (const d of details) {
      if (d.costType !== 'Service') continue;
      const label = deriveServiceTypeLabel(d.name);
      byType.set(label, (byType.get(label) ?? 0) + d.cost);
    }
    const data = [...byType.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return limitChartData(data);
  }, [details]);

  const tableRowCount = useMemo(
    () => {
      if (tableView === 'ResourceGroup') return groupedResourceGroupDetails.length;
      return groupedServiceDetails.length;
    },
    [groupedResourceGroupDetails, groupedServiceDetails, tableView],
  );

  const sortedDetails = useMemo(() => {
    const nameQ = nameFilter.trim().toLowerCase();
    const rgQ = resourceGroupFilter.trim().toLowerCase();
    if (tableView === 'ResourceGroup') {
      let rows = groupedResourceGroupDetails.slice();
      if (nameQ) {
        rows = rows.filter((d) => d.resourceGroup.toLowerCase().includes(nameQ));
      }
      return rows;
    }

    let rows = groupedServiceDetails.slice();
    if (nameQ) {
      rows = rows.filter((d) => d.name.toLowerCase().includes(nameQ));
    }
    if (rgQ) {
      rows = rows.filter((d) => d.resourceGroup.toLowerCase().includes(rgQ));
    }
    return rows;
  }, [groupedResourceGroupDetails, groupedServiceDetails, tableView, nameFilter, resourceGroupFilter]);

  const filtersActive =
    nameFilter.trim() !== '' || (tableView === 'Service' && resourceGroupFilter.trim() !== '');

  const canGoPreviousMonth = selectedMonthIndex < monthOptions.length - 1;
  const canGoNextMonth = selectedMonthIndex > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[95vw] lg:max-w-[1400px] max-h-[96vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-none">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subscriptionName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedMonth.isCurrentMonth
                ? 'All costs shown are month-to-date (MTD).'
                : `Showing historical cost data for ${selectedMonth.label}.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 flex items-center gap-3 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && details.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              No cost details found for this analysis run.
            </div>
          )}

          {!isLoading && !error && details.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Period</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedMonth.label}</div>
                </div>
                <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => {
                      if (canGoPreviousMonth) {
                        setSelectedMonthKey(monthOptions[selectedMonthIndex + 1].key);
                      }
                    }}
                    disabled={!canGoPreviousMonth}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous month
                  </button>
                  <button
                    onClick={() => {
                      if (canGoNextMonth) {
                        setSelectedMonthKey(monthOptions[selectedMonthIndex - 1].key);
                      }
                    }}
                    disabled={!canGoNextMonth}
                    className="inline-flex items-center gap-2 px-3 py-2 border-l border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next month
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pie charts */}
              <div className="grid md:grid-cols-2 gap-4">
                <CostPieChart
                  data={rgData}
                  title="Cost by Resource Group"
                  icon={<Layers className="w-4 h-4 text-indigo-500" />}
                  amountSuffix={amountSuffix}
                />
                <CostPieChart
                  data={svcData}
                  title="Cost by Service Type"
                  icon={<Server className="w-4 h-4 text-blue-500" />}
                  amountSuffix={amountSuffix}
                />
              </div>

              {/* Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cost Details Table</h3>
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
                    <button
                      onClick={() => setTableView('ResourceGroup')}
                      className={`px-3 py-1.5 transition-colors ${
                        tableView === 'ResourceGroup'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      Resource Groups
                    </button>
                    <button
                      onClick={() => setTableView('Service')}
                      className={`px-3 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${
                        tableView === 'Service'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      Services
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[160px] flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder={
                        tableView === 'ResourceGroup'
                          ? 'Filter by resource group name…'
                          : 'Filter by service name…'
                      }
                      className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                  {tableView === 'Service' && (
                    <div className="min-w-[160px] flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Resource group
                      </label>
                      <input
                        type="text"
                        value={resourceGroupFilter}
                        onChange={(e) => setResourceGroupFilter(e.target.value)}
                        placeholder="Filter by resource group…"
                        className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                      {tableView === 'Service' && (
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Resource Group</th>
                      )}
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                        {selectedMonth.isCurrentMonth ? 'Cost (MTD)' : 'Cost'}
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Recorded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sortedDetails.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={tableView === 'Service' ? 5 : 4}>
                          {filtersActive && tableRowCount > 0
                            ? 'No rows match your filters.'
                            : `No ${tableView === 'ResourceGroup' ? 'resource group' : 'service'} records found.`}
                        </td>
                      </tr>
                    )}
                    {sortedDetails.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {d.costType === 'ResourceGroup' ? d.resourceGroup ?? 'N/A' : d.name ?? 'N/A'}
                        </td>
                        {tableView === 'Service' && (
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {d.resourceGroup ?? '—'}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              d.costType === 'ResourceGroup'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}
                          >
                            {d.costType === 'ResourceGroup' ? 'Resource Group' : d.costType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          ${d.cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                          {new Date(d.recordedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
