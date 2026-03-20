import { useEffect, useState } from 'react';
import { X, Layers, Server, AlertCircle } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { LoadingSpinner } from './ui';
import finopsService, { CostDetail } from '../services/finopsService';

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

function CostPieChart({
  data,
  title,
  icon,
}: {
  data: { name: string; value: number }[];
  title: string;
  icon: React.ReactNode;
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
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, 'Cost']}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            formatter={(value: string) => (
              <span className="text-gray-700 dark:text-gray-300">{value}</span>
            )}
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
  const [details, setDetails] = useState<CostDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableView, setTableView] = useState<'ResourceGroup' | 'Service'>('ResourceGroup');

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setDetails([]);
      try {
        const data = await finopsService.getCostDetails(analysisRunId);
        setDetails(data);
      } catch {
        setError('Failed to load cost details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, analysisRunId]);

  if (!isOpen) return null;

  const rgData = details
    .filter((d) => d.costType === 'ResourceGroup')
    .sort((a, b) => b.cost - a.cost)
    .map((d) => ({ name: d.name, value: d.cost }));

  const svcData = details
    .filter((d) => d.costType === 'Service')
    .sort((a, b) => b.cost - a.cost)
    .map((d) => ({ name: d.name, value: d.cost }));

  const sortedDetails = details
    .filter((d) => d.costType === tableView)
    .slice()
    .sort((a, b) => b.cost - a.cost);

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
              {/* Pie charts */}
              <div className="grid md:grid-cols-2 gap-4">
                <CostPieChart
                  data={rgData}
                  title="Cost by Resource Group"
                  icon={<Layers className="w-4 h-4 text-indigo-500" />}
                />
                <CostPieChart
                  data={svcData}
                  title="Cost by Service"
                  icon={<Server className="w-4 h-4 text-blue-500" />}
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

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                      {tableView === 'Service' && (
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Resource Group</th>
                      )}
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Cost</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Recorded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sortedDetails.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={tableView === 'Service' ? 5 : 4}>
                          No {tableView === 'ResourceGroup' ? 'resource group' : 'service'} records found.
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
