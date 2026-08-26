import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { X, LineChart as LineChartIcon, AlertCircle, CalendarRange } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { LoadingSpinner } from './ui';
import finopsService, { HistoricalCostDetail } from '../services/finopsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analysisRunId: number;
  subscriptionName: string;
}

type ForecastHorizon = 7 | 14 | 30;

interface DailyPoint {
  dateKey: string;
  label: string;
  actual: number | null;
  forecast: number | null;
}

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

function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Local calendar day as YYYY-MM-DD (incomplete until day rolls over). */
function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Daily Total cost series sorted ascending by date.
 * Excludes today (in-progress / incomplete day) so forecast uses D-1 as the last actual.
 */
function buildDailyTotals(records: HistoricalCostDetail[]): { dateKey: string; cost: number }[] {
  const todayKey = getTodayDateKey();
  const totals = records
    .filter((r) => r.costType === 'Total')
    .reduce<Record<string, number>>((acc, r) => {
      const day = r.costDate.slice(0, 10);
      if (day >= todayKey) return acc;
      acc[day] = (acc[day] ?? 0) + r.cost;
      return acc;
    }, {});

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, cost]) => ({
      dateKey,
      cost: Math.round(cost * 100) / 100,
    }));
}

/**
 * Simple linear regression on recent daily costs, then project `horizonDays` ahead.
 * Uses up to the last 60 days so short spikes don't dominate forever.
 */
function buildForecastSeries(
  daily: { dateKey: string; cost: number }[],
  horizonDays: ForecastHorizon,
): {
  chartData: DailyPoint[];
  slope: number;
  avgDaily: number;
  projectedTotal: number;
  lastActual: number | null;
} {
  if (daily.length === 0) {
    return { chartData: [], slope: 0, avgDaily: 0, projectedTotal: 0, lastActual: null };
  }

  const lookback = daily.slice(-60);
  const n = lookback.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  lookback.forEach((p, i) => {
    sumX += i;
    sumY += p.cost;
    sumXY += i * p.cost;
    sumXX += i * i;
  });

  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const avgDaily = sumY / n;

  const historyPoints: DailyPoint[] = lookback.map((p) => ({
    dateKey: p.dateKey,
    label: formatDayLabel(p.dateKey),
    actual: p.cost,
    forecast: null,
  }));

  // Bridge: last actual also starts the forecast line so the series connects visually.
  const last = lookback[lookback.length - 1];
  historyPoints[historyPoints.length - 1] = {
    ...historyPoints[historyPoints.length - 1],
    forecast: last.cost,
  };

  const forecastPoints: DailyPoint[] = [];
  let projectedTotal = 0;
  for (let i = 1; i <= horizonDays; i++) {
    const dateKey = addDays(last.dateKey, i);
    const predicted = Math.max(0, intercept + slope * (n - 1 + i));
    const rounded = Math.round(predicted * 100) / 100;
    projectedTotal += rounded;
    forecastPoints.push({
      dateKey,
      label: formatDayLabel(dateKey),
      actual: null,
      forecast: rounded,
    });
  }

  return {
    chartData: [...historyPoints, ...forecastPoints],
    slope: Math.round(slope * 100) / 100,
    avgDaily: Math.round(avgDaily * 100) / 100,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    lastActual: last.cost,
  };
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string; name?: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const actual = payload.find((p) => p.dataKey === 'actual' && p.value != null)?.value;
  const forecast = payload.find((p) => p.dataKey === 'forecast' && p.value != null)?.value;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-900 dark:text-white mb-1">{label}</p>
      {actual != null && (
        <p className="text-teal-600 dark:text-teal-400">
          Actual: <span className="font-semibold">${actual.toFixed(2)}</span>
        </p>
      )}
      {forecast != null && (
        <p className="text-violet-600 dark:text-violet-400">
          Forecast: <span className="font-semibold">${forecast.toFixed(2)}</span>
        </p>
      )}
    </div>
  );
};

export function CostForecastModal({ isOpen, onClose, analysisRunId, subscriptionName }: Props) {
  const [records, setRecords] = useState<HistoricalCostDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizon>(14);
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
        setError('Failed to load historical cost data for forecast.');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [isOpen, analysisRunId]);

  const daily = useMemo(() => buildDailyTotals(records), [records]);

  const { chartData, slope, avgDaily, projectedTotal, lastActual } = useMemo(
    () => buildForecastSeries(daily, horizon),
    [daily, horizon],
  );

  const trendLabel =
    slope > 0.5 ? 'Rising' : slope < -0.5 ? 'Falling' : 'Stable';
  const trendColor =
    slope > 0.5
      ? 'text-amber-600 dark:text-amber-400'
      : slope < -0.5
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-gray-700 dark:text-gray-300';

  const gridStroke = '#6b7280';
  const axisTickColor = '#6b7280';
  const actualStroke = '#0d9488';
  const forecastStroke = isDarkMode ? '#a78bfa' : '#7c3aed';
  const lastCompleteKey = daily.length ? daily[daily.length - 1].dateKey : null;

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
            <LineChartIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cost forecast</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subscriptionName} — projected from daily historical totals
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
          <div className="flex flex-wrap items-center gap-3">
            <CalendarRange className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Forecast horizon:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm font-medium">
              {([7, 14, 30] as ForecastHorizon[]).map((days, idx) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setHorizon(days)}
                  className={`px-4 py-1.5 transition-colors ${
                    idx > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''
                  } ${
                    horizon === days
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 w-full sm:w-auto sm:ml-auto">
              Linear trend over complete days only (excludes today). More forecast options coming soon.
            </p>
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
              Not enough historical data to build a forecast yet.
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Last complete day (D-1)
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${lastActual?.toFixed(2) ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Avg daily (lookback)
                  </p>
                  <p className="text-xl font-bold text-teal-600 dark:text-teal-400">
                    ${avgDaily.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Projected ({horizon}d)
                  </p>
                  <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                    ${projectedTotal.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Daily trend
                  </p>
                  <p className={`text-xl font-bold ${trendColor}`}>
                    {trendLabel}
                    <span className="ml-1.5 text-sm font-medium tabular-nums">
                      ({slope >= 0 ? '+' : ''}
                      {slope.toFixed(2)}/day)
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Actual vs forecast — daily cost (USD)
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-0.5 w-4 rounded-full"
                        style={{ backgroundColor: actualStroke }}
                      />
                      Actual
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-0.5 w-4 rounded-full border-t-2 border-dashed"
                        style={{ borderColor: forecastStroke }}
                      />
                      Forecast
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: Math.max(chartData.length * 10, 560) }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 36 }}
                      >
                        <CartesianGrid
                          strokeDasharray="2 6"
                          stroke={gridStroke}
                          strokeOpacity={0.18}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          angle={-45}
                          textAnchor="end"
                          height={44}
                          interval={chartData.length > 40 ? Math.floor(chartData.length / 20) : 0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          tickFormatter={(v) => `$${v}`}
                          width={60}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {lastCompleteKey && (
                          <ReferenceLine
                            x={formatDayLabel(lastCompleteKey)}
                            stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                            strokeDasharray="4 4"
                            label={{
                              value: 'Last complete',
                              position: 'insideTopRight',
                              fill: axisTickColor,
                              fontSize: 11,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="Actual"
                          stroke={actualStroke}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          name="Forecast"
                          stroke={forecastStroke}
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          connectNulls={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
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
