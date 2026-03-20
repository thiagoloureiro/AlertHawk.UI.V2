import { useEffect, useState } from 'react';
import { X, TrendingUp, AlertCircle, CalendarDays } from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface ChartPoint {
  label: string;
  cost: number;
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
      label: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: Math.round(cost * 100) / 100,
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
      label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      cost: Math.round(cost * 100) / 100,
    }));
}

function getSixMonthsCutoff(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setHours(0, 0, 0, 0);
  return d;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-900 dark:text-white mb-1">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
        ${(payload[0]?.value ?? 0).toFixed(2)}
      </p>
    </div>
  );
};

export function HistoricalResultsModal({ isOpen, onClose, analysisRunId, subscriptionName }: Props) {
  const [records, setRecords] = useState<HistoricalCostDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('daily');

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
  const chartData: ChartPoint[] =
    granularity === 'daily'
      ? buildDailyData(records, cutoff)
      : buildMonthlyData(records, cutoff);

  const totalCost = chartData.reduce((s, p) => s + p.cost, 0);
  const avgCost = chartData.length ? totalCost / chartData.length : 0;
  const maxCost = chartData.length ? Math.max(...chartData.map((p) => p.cost)) : 0;

  const barWidth = granularity === 'daily' && chartData.length > 60 ? 6 : undefined;

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
          <div className="flex items-center gap-3">
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
                </h3>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: granularity === 'daily' ? Math.max(chartData.length * 14, 600) : 500 }}>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          interval={granularity === 'daily' && chartData.length > 30 ? Math.floor(chartData.length / 20) : 0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickFormatter={(v) => `$${v}`}
                          width={60}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="cost"
                          fill="#0d9488"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={barWidth ?? 40}
                        />
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
