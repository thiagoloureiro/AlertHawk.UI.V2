import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { X, TrendingUp, AlertCircle, CalendarDays, Filter } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { LoadingSpinner } from './ui';
import finopsService, { HistoricalCostDetail } from '../services/finopsService';
import { deriveServiceTypeLabel, garIdFromTags } from '../utils/finopsCostLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysisRunId: number;
  subscriptionName: string;
  /** Optional monthly budget in USD; shown as a reference line on the chart. */
  budget?: number | null;
}

type Granularity = 'daily' | 'monthly';

const FILTER_ALL = 'all';

/** Fixed monthly overlay for charts ($400/mo); daily view splits by calendar days in each month. */
const INFRA_SUPPORT_MONTHLY_USD = 400;

interface ChartPoint {
  label: string;
  /** YYYY-MM-DD for daily, YYYY-MM for monthly */
  periodKey: string;
  cloudCost: number;
}

function daysInCalendarMonth(year: number, month1To12: number): number {
  return new Date(year, month1To12, 0).getDate();
}

/** Infra share for one bucket: full $400 per month bar; per-day = 400 / days in that calendar month. */
function infraSupportForBucket(periodKey: string, granularity: Granularity): number {
  if (granularity === 'monthly') {
    return Math.round(INFRA_SUPPORT_MONTHLY_USD * 100) / 100;
  }
  const y = Number(periodKey.slice(0, 4));
  const m = Number(periodKey.slice(5, 7));
  const dim = daysInCalendarMonth(y, m);
  return Math.round((INFRA_SUPPORT_MONTHLY_USD / dim) * 100) / 100;
}

function getMonthlyBudget(budget: number | null | undefined): number | null {
  if (budget == null || !Number.isFinite(budget) || budget <= 0) return null;
  return budget;
}

/**
 * Budget reference for the chart: full monthly amount in monthly view;
 * current-month daily rate (budget / days in month) in daily view.
 */
function budgetLineForGranularity(
  monthlyBudget: number | null,
  granularity: Granularity,
): number | null {
  if (monthlyBudget == null) return null;
  if (granularity === 'monthly') {
    return Math.round(monthlyBudget * 100) / 100;
  }
  const now = new Date();
  const dim = daysInCalendarMonth(now.getFullYear(), now.getMonth() + 1);
  return Math.round((monthlyBudget / dim) * 100) / 100;
}

function getAppIdLabel(record: HistoricalCostDetail): string {
  return garIdFromTags(record.tags) || 'Unassigned';
}

function getResourceGroupLabel(record: HistoricalCostDetail): string {
  if (record.costType === 'ResourceGroup') {
    return record.resourceGroup?.trim() || record.name?.trim() || 'Unassigned';
  }
  return record.resourceGroup?.trim() || 'Unassigned';
}

function getServiceTypeLabel(record: HistoricalCostDetail): string {
  return deriveServiceTypeLabel(record.name);
}

function withinCutoff(record: HistoricalCostDetail, cutoff: Date): boolean {
  return new Date(record.costDate) >= cutoff;
}

/**
 * Detail rows used when any dimensional filter is active.
 * Prefer Service (has app id, RG, and service type); fall back to ResourceGroup.
 */
function getDetailRows(records: HistoricalCostDetail[]): HistoricalCostDetail[] {
  const services = records.filter((r) => r.costType === 'Service');
  if (services.length > 0) return services;
  return records.filter((r) => r.costType === 'ResourceGroup');
}

function matchesFilters(
  record: HistoricalCostDetail,
  appId: string,
  resourceGroup: string,
  serviceType: string,
): boolean {
  if (appId !== FILTER_ALL && getAppIdLabel(record) !== appId) return false;
  if (resourceGroup !== FILTER_ALL && getResourceGroupLabel(record) !== resourceGroup) return false;
  if (serviceType !== FILTER_ALL && getServiceTypeLabel(record) !== serviceType) return false;
  return true;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildDailyData(records: HistoricalCostDetail[], cutoff: Date): ChartPoint[] {
  const totals = records
    .filter((r) => withinCutoff(r, cutoff))
    .reduce<Record<string, number>>((acc, r) => {
      const day = r.costDate.slice(0, 10);
      acc[day] = (acc[day] ?? 0) + r.cost;
      return acc;
    }, {});

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, cost]) => ({
      periodKey: day,
      label: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cloudCost: Math.round(cost * 100) / 100,
    }));
}

function buildMonthlyData(records: HistoricalCostDetail[], cutoff: Date): ChartPoint[] {
  const totals = records
    .filter((r) => withinCutoff(r, cutoff))
    .reduce<Record<string, number>>((acc, r) => {
      const month = r.costDate.slice(0, 7);
      acc[month] = (acc[month] ?? 0) + r.cost;
      return acc;
    }, {});

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => ({
      periodKey: month,
      label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      cloudCost: Math.round(cost * 100) / 100,
    }));
}

function getSixMonthsCutoff(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cent-rounded match so peak day / peak month bars always highlight (avoids float drift). */
function isPeakCost(cost: number, maxCost: number): boolean {
  if (maxCost <= 0) return false;
  return Math.round(cost * 100) === Math.round(maxCost * 100);
}

const PEAK_BAR_LIGHT = '#d97706';
const PEAK_BAR_DARK = '#fbbf24';
const DEFAULT_BAR_FILL = '#0d9488';

function subscribeDarkClass(callback: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(callback);
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getIsDarkModeSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function useIsDarkMode() {
  return useSyncExternalStore(subscribeDarkClass, getIsDarkModeSnapshot, () => false);
}

const INFRA_BAR_FILL_LIGHT = '#6366f1';
const INFRA_BAR_FILL_DARK = '#818cf8';

const selectClassName =
  'w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500';

const CustomTooltip = ({
  active,
  payload,
  label,
  maxTotal,
  granularity,
  includeInfraSupport,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string; name?: string }[];
  label?: string;
  maxTotal: number;
  granularity: Granularity;
  includeInfraSupport: boolean;
}) => {
  if (!active || !payload?.length) return null;

  const cloud = payload.find((p) => p.dataKey === 'cloudCost')?.value ?? 0;
  const infra = includeInfraSupport
    ? (payload.find((p) => p.dataKey === 'infraSupport')?.value ?? 0)
    : 0;
  const total = includeInfraSupport ? cloud + infra : cloud;
  const isPeak = isPeakCost(total, maxTotal);
  const peakLabel = granularity === 'daily' ? 'peak day' : 'peak month';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-900 dark:text-white mb-1">{label}</p>
      {includeInfraSupport ? (
        <div className="space-y-0.5">
          <p className="text-teal-600 dark:text-teal-400">
            Cloud: <span className="font-semibold">${cloud.toFixed(2)}</span>
          </p>
          <p className="text-indigo-600 dark:text-indigo-400">
            Infra support: <span className="font-semibold">${infra.toFixed(2)}</span>
          </p>
          <p
            className={
              isPeak
                ? 'text-amber-600 dark:text-amber-400 font-semibold pt-1 border-t border-gray-200 dark:border-gray-600 mt-1'
                : 'text-gray-900 dark:text-white font-semibold pt-1 border-t border-gray-200 dark:border-gray-600 mt-1'
            }
          >
            Total: ${total.toFixed(2)}
            {isPeak && (
              <span className="ml-1.5 text-xs font-normal text-amber-700/80 dark:text-amber-300/90">
                ({peakLabel})
              </span>
            )}
          </p>
        </div>
      ) : (
        <p
          className={
            isPeak
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-emerald-600 dark:text-emerald-400 font-semibold'
          }
        >
          ${cloud.toFixed(2)}
          {isPeak && (
            <span className="ml-1.5 text-xs font-normal text-amber-700/80 dark:text-amber-300/90">
              ({peakLabel})
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export function HistoricalResultsModal({
  isOpen,
  onClose,
  analysisRunId,
  subscriptionName,
  budget,
}: Props) {
  const [records, setRecords] = useState<HistoricalCostDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [includeInfraSupport, setIncludeInfraSupport] = useState(false);
  const [appIdFilter, setAppIdFilter] = useState(FILTER_ALL);
  const [resourceGroupFilter, setResourceGroupFilter] = useState(FILTER_ALL);
  const [serviceTypeFilter, setServiceTypeFilter] = useState(FILTER_ALL);
  const isDarkMode = useIsDarkMode();

  const monthlyBudget = useMemo(() => getMonthlyBudget(budget), [budget]);
  const budgetLine = useMemo(
    () => budgetLineForGranularity(monthlyBudget, granularity),
    [monthlyBudget, granularity],
  );

  useEffect(() => {
    if (!isOpen) return;
    setAppIdFilter(FILTER_ALL);
    setResourceGroupFilter(FILTER_ALL);
    setServiceTypeFilter(FILTER_ALL);
    setIncludeInfraSupport(false);

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await finopsService.getHistoricalCostDetails(analysisRunId);
        setRecords(data);
      } catch {
        setError('Failed to load historical cost data.');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [isOpen, analysisRunId]);

  const cutoff = useMemo(() => getSixMonthsCutoff(), []);

  const detailRowsInWindow = useMemo(
    () => getDetailRows(records).filter((r) => withinCutoff(r, cutoff)),
    [records, cutoff],
  );

  const filtersActive =
    appIdFilter !== FILTER_ALL ||
    resourceGroupFilter !== FILTER_ALL ||
    serviceTypeFilter !== FILTER_ALL;

  const appIdOptions = useMemo(() => {
    const rows = detailRowsInWindow.filter((r) =>
      matchesFilters(r, FILTER_ALL, resourceGroupFilter, serviceTypeFilter),
    );
    return uniqueSorted(rows.map(getAppIdLabel));
  }, [detailRowsInWindow, resourceGroupFilter, serviceTypeFilter]);

  const resourceGroupOptions = useMemo(() => {
    const rows = detailRowsInWindow.filter((r) =>
      matchesFilters(r, appIdFilter, FILTER_ALL, serviceTypeFilter),
    );
    return uniqueSorted(rows.map(getResourceGroupLabel));
  }, [detailRowsInWindow, appIdFilter, serviceTypeFilter]);

  const serviceTypeOptions = useMemo(() => {
    const rows = detailRowsInWindow.filter((r) =>
      matchesFilters(r, appIdFilter, resourceGroupFilter, FILTER_ALL),
    );
    return uniqueSorted(rows.map(getServiceTypeLabel));
  }, [detailRowsInWindow, appIdFilter, resourceGroupFilter]);

  // Keep selected values valid when cascading options shrink.
  useEffect(() => {
    if (appIdFilter !== FILTER_ALL && !appIdOptions.includes(appIdFilter)) {
      setAppIdFilter(FILTER_ALL);
    }
  }, [appIdFilter, appIdOptions]);

  useEffect(() => {
    if (resourceGroupFilter !== FILTER_ALL && !resourceGroupOptions.includes(resourceGroupFilter)) {
      setResourceGroupFilter(FILTER_ALL);
    }
  }, [resourceGroupFilter, resourceGroupOptions]);

  useEffect(() => {
    if (serviceTypeFilter !== FILTER_ALL && !serviceTypeOptions.includes(serviceTypeFilter)) {
      setServiceTypeFilter(FILTER_ALL);
    }
  }, [serviceTypeFilter, serviceTypeOptions]);

  const chartSourceRecords = useMemo(() => {
    if (!filtersActive) {
      return records.filter((r) => r.costType === 'Total');
    }
    return detailRowsInWindow.filter((r) =>
      matchesFilters(r, appIdFilter, resourceGroupFilter, serviceTypeFilter),
    );
  }, [
    records,
    detailRowsInWindow,
    filtersActive,
    appIdFilter,
    resourceGroupFilter,
    serviceTypeFilter,
  ]);

  const applyInfra = includeInfraSupport && !filtersActive;

  const baseChartData: ChartPoint[] = useMemo(
    () =>
      granularity === 'daily'
        ? buildDailyData(chartSourceRecords, cutoff)
        : buildMonthlyData(chartSourceRecords, cutoff),
    [chartSourceRecords, cutoff, granularity],
  );

  const chartData = useMemo(
    () =>
      baseChartData.map((p) => {
        const infraSupport = applyInfra ? infraSupportForBucket(p.periodKey, granularity) : 0;
        const total = p.cloudCost + infraSupport;
        return { ...p, infraSupport, total };
      }),
    [baseChartData, applyInfra, granularity],
  );

  const totalCost = chartData.reduce((s, p) => s + p.total, 0);
  const avgCost = chartData.length ? totalCost / chartData.length : 0;
  const maxCostRaw = chartData.length ? Math.max(...chartData.map((p) => p.total)) : 0;
  const maxCost = Math.round(maxCostRaw * 100) / 100;

  const barWidth = granularity === 'daily' && chartData.length > 60 ? 6 : undefined;
  const gridStroke = '#6b7280';
  const gridOpacity = 0.18;
  const axisTickColor = '#6b7280';
  const peakBarFill = isDarkMode ? PEAK_BAR_DARK : PEAK_BAR_LIGHT;
  const infraBarFill = isDarkMode ? INFRA_BAR_FILL_DARK : INFRA_BAR_FILL_LIGHT;
  const budgetStroke = isDarkMode ? '#fbbf24' : '#d97706';
  const avgVsBudget =
    budgetLine != null && avgCost > 0 ? Math.round((avgCost / budgetLine) * 100) : null;

  const filterSummary = [
    appIdFilter !== FILTER_ALL ? `App ID: ${appIdFilter}` : null,
    resourceGroupFilter !== FILTER_ALL ? `RG: ${resourceGroupFilter}` : null,
    serviceTypeFilter !== FILTER_ALL ? `Service: ${serviceTypeFilter}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historical Results</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subscriptionName} — Last 6 months
                {filterSummary ? ` · ${filterSummary}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">App ID</span>
                <select
                  value={appIdFilter}
                  onChange={(e) => setAppIdFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value={FILTER_ALL}>All</option>
                  {appIdOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Resource group</span>
                <select
                  value={resourceGroupFilter}
                  onChange={(e) => setResourceGroupFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value={FILTER_ALL}>All</option>
                  {resourceGroupOptions.map((rg) => (
                    <option key={rg} value={rg}>
                      {rg}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Service type</span>
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value={FILTER_ALL}>All</option>
                  {serviceTypeOptions.map((svc) => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">View by:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm font-medium">
              <button
                type="button"
                onClick={() => setGranularity('daily')}
                className={`px-4 py-1.5 transition-colors ${
                  granularity === 'daily'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setGranularity('monthly')}
                className={`px-4 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${
                  granularity === 'monthly'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                Monthly
              </button>
            </div>
            <label
              className={`flex items-center gap-2 select-none text-sm text-gray-600 dark:text-gray-400 ${
                filtersActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={
                filtersActive
                  ? 'Infra support applies to the full subscription total only'
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={applyInfra}
                disabled={filtersActive}
                onChange={(e) => setIncludeInfraSupport(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-teal-600 focus:ring-teal-500"
              />
              <span>Infra support costs (${INFRA_SUPPORT_MONTHLY_USD}/mo, proportional per day)</span>
            </label>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 flex items-center gap-3 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && chartData.length === 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-10 text-center text-gray-500 dark:text-gray-400">
              {filtersActive
                ? 'No historical data matches the selected filters.'
                : 'No historical data available for the last 6 months.'}
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className={`grid gap-4 ${budgetLine != null ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Total (6 mo)
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${totalCost.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Avg per {granularity === 'daily' ? 'Day' : 'Month'}
                  </p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    ${avgCost.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Peak {granularity === 'daily' ? 'Day' : 'Month'}
                  </p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    ${maxCost.toFixed(2)}
                  </p>
                </div>
                {budgetLine != null && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      {granularity === 'daily' ? 'Daily budget' : 'Monthly budget'}
                    </p>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      ${budgetLine.toFixed(2)}
                    </p>
                    {monthlyBudget != null && (
                      <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {granularity === 'daily'
                          ? `from $${monthlyBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`
                          : 'subscription budget'}
                        {avgVsBudget != null ? ` · avg ${avgVsBudget}%` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {filtersActive ? 'Filtered cost' : 'Total cost'} —{' '}
                    {granularity === 'daily' ? 'Daily' : 'Monthly'} Breakdown (USD)
                    {applyInfra && (
                      <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-1">
                        Includes ${INFRA_SUPPORT_MONTHLY_USD}/month infra support
                        {granularity === 'daily' ? ', split evenly across calendar days' : ''}.
                      </span>
                    )}
                  </h3>
                  {budgetLine != null && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span
                        className="h-0.5 w-4 rounded-full border-t-2 border-dotted"
                        style={{ borderColor: budgetStroke }}
                      />
                      {granularity === 'daily' ? 'Daily budget' : 'Monthly budget'}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <div
                    style={{
                      minWidth:
                        granularity === 'daily' ? Math.max(chartData.length * 14, 600) : 500,
                    }}
                  >
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        key={`${granularity}-${appIdFilter}-${resourceGroupFilter}-${serviceTypeFilter}`}
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 60 }}
                      >
                        <CartesianGrid
                          strokeDasharray="2 6"
                          stroke={gridStroke}
                          strokeOpacity={gridOpacity}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          angle={-45}
                          textAnchor="end"
                          interval={
                            granularity === 'daily' && chartData.length > 30
                              ? Math.floor(chartData.length / 20)
                              : 0
                          }
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          tickFormatter={(v) => `$${v}`}
                          width={60}
                        />
                        <Tooltip
                          content={
                            <CustomTooltip
                              maxTotal={maxCost}
                              granularity={granularity}
                              includeInfraSupport={applyInfra}
                            />
                          }
                        />
                        {budgetLine != null && (
                          <ReferenceLine
                            y={budgetLine}
                            stroke={budgetStroke}
                            strokeDasharray="2 6"
                            strokeWidth={1.5}
                            label={{
                              value:
                                granularity === 'daily'
                                  ? `Budget $${budgetLine.toFixed(2)}/day`
                                  : `Budget $${budgetLine.toFixed(0)}/mo`,
                              position: 'insideTopLeft',
                              fill: budgetStroke,
                              fontSize: 11,
                            }}
                          />
                        )}
                        <Bar
                          dataKey="cloudCost"
                          name="Cloud"
                          stackId="cost"
                          fill={DEFAULT_BAR_FILL}
                          radius={applyInfra ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                          maxBarSize={barWidth ?? 40}
                        >
                          {!applyInfra ? (
                            chartData.map((entry, index) => {
                              const isPeak = isPeakCost(entry.total, maxCost);
                              return (
                                <Cell
                                  key={`cloud-${entry.label}-${index}`}
                                  fill={isPeak ? peakBarFill : DEFAULT_BAR_FILL}
                                />
                              );
                            })
                          ) : (
                            chartData.map((entry, index) => (
                              <Cell key={`cloud-${entry.label}-${index}`} fill={DEFAULT_BAR_FILL} />
                            ))
                          )}
                        </Bar>
                        {applyInfra && (
                          <Bar
                            dataKey="infraSupport"
                            name="Infra support"
                            stackId="cost"
                            fill={infraBarFill}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={barWidth ?? 40}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
