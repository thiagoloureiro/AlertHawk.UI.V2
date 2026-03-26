import { useEffect, useState, useSyncExternalStore } from 'react';
import { X, TrendingUp, AlertCircle, CalendarDays } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { LoadingSpinner } from './ui';
import finopsService, { HistoricalCostDetail } from '../services/finopsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysisRunId: number;
  subscriptionName: string;
}

type Granularity = 'daily' | 'monthly';

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

function buildDailyData(records: HistoricalCostDetail[], cutoff: Date): ChartPoint[] {
  const totals = records
    .filter((r) => r.costType === 'Total' && new Date(r.costDate) >= cutoff)
    .reduce<Record<string, number>>((acc, r) => {
      const day = r.costDate.slice(0, 10); // YYYY-MM-DD
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
    .filter((r) => r.costType === 'Total' && new Date(r.costDate) >= cutoff)
    .reduce<Record<string, number>>((acc, r) => {
      const month = r.costDate.slice(0, 7); // YYYY-MM
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

/** Matches Tailwind `text-amber-600` / `dark:text-amber-400` on the Peak card */
const PEAK_BAR_LIGHT = '#d97706';
const PEAK_BAR_DARK = '#fbbf24';
const DEFAULT_BAR_FILL = '#0d9488'; // teal-600, matches header / toggle

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

export function HistoricalResultsModal({ isOpen, onClose, analysisRunId, subscriptionName }: Props) {
  const [records, setRecords] = useState<HistoricalCostDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [includeInfraSupport, setIncludeInfraSupport] = useState(false);
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    if (!isOpen) return;
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
    fetchData();
  }, [isOpen, analysisRunId]);

  if (!isOpen) return null;

  const cutoff = getSixMonthsCutoff();
  const baseChartData: ChartPoint[] =
    granularity === 'daily'
      ? buildDailyData(records, cutoff)
      : buildMonthlyData(records, cutoff);

  const chartData = baseChartData.map((p) => {
    const infraSupport = includeInfraSupport
      ? infraSupportForBucket(p.periodKey, granularity)
      : 0;
    const total = p.cloudCost + infraSupport;
    return { ...p, infraSupport, total };
  });

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

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historical Results</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{subscriptionName} — Last 6 months</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Granularity toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">View by:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm font-medium">
              <button
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
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={includeInfraSupport}
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
              No historical data available for the last 6 months.
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total (6 mo)</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">${totalCost.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Avg per {granularity === 'daily' ? 'Day' : 'Month'}
                  </p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${avgCost.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Peak {granularity === 'daily' ? 'Day' : 'Month'}
                  </p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">${maxCost.toFixed(2)}</p>
                </div>
              </div>

              {/* Bar chart */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Total Cost — {granularity === 'daily' ? 'Daily' : 'Monthly'} Breakdown (USD)
                  {includeInfraSupport && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-1">
                      Includes ${INFRA_SUPPORT_MONTHLY_USD}/month infra support
                      {granularity === 'daily' ? ', split evenly across calendar days' : ''}.
                    </span>
                  )}
                </h3>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: granularity === 'daily' ? Math.max(chartData.length * 14, 600) : 500 }}>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        key={granularity}
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="2 6" stroke={gridStroke} strokeOpacity={gridOpacity} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          angle={-45}
                          textAnchor="end"
                          interval={granularity === 'daily' && chartData.length > 30 ? Math.floor(chartData.length / 20) : 0}
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
                              includeInfraSupport={includeInfraSupport}
                            />
                          }
                        />
                        <Bar
                          dataKey="cloudCost"
                          name="Cloud"
                          stackId="cost"
                          fill={DEFAULT_BAR_FILL}
                          radius={includeInfraSupport ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                          maxBarSize={barWidth ?? 40}
                        >
                          {!includeInfraSupport ? (
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
                        {includeInfraSupport && (
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
