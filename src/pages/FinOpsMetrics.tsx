import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Database, Sparkles, RefreshCw, AlertCircle, BarChart2, BrainCircuit, TrendingUp, Search } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import finopsService, { FinopsAnalysisRun } from '../services/finopsService';
import userService from '../services/userService';
import { CostDetailsModal } from '../components/CostDetailsModal';
import { AiRecommendationsModal } from '../components/AiRecommendationsModal';
import { HistoricalResultsModal } from '../components/HistoricalResultsModal';

function getCurrentUser(): { id: string; isAdmin?: boolean } | null {
  const stored = localStorage.getItem('userInfo');
  return stored ? JSON.parse(stored) : null;
}

/** Parse API run date and show in the user's locale and local timezone. */
function formatRunDateInUserTimezone(runDate: string): string {
  if (!runDate?.trim()) return '—';
  const trimmed = runDate.trim();
  // If API sends ISO without timezone, treat instant as UTC (common .NET / SQL pattern)
  const isoWithoutTz =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const d = isoWithoutTz ? new Date(`${trimmed}Z`) : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return runDate;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function FinOpsMetrics() {
  const [runs, setRuns] = useState<FinopsAnalysisRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  /** How many subscriptions this user is assigned (0 = none); admins still fetch but UI ignores for access. */
  const [assignedSubscriptionCount, setAssignedSubscriptionCount] = useState(0);
  const [selectedRun, setSelectedRun] = useState<FinopsAnalysisRun | null>(null);
  const [aiRun, setAiRun] = useState<FinopsAnalysisRun | null>(null);
  const [historyRun, setHistoryRun] = useState<FinopsAnalysisRun | null>(null);
  const [subscriptionFilter, setSubscriptionFilter] = useState('');

  const filteredRuns = useMemo(() => {
    const q = subscriptionFilter.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((run) => {
      const name = (run.subscriptionName ?? '').toLowerCase();
      const id = (run.subscriptionId ?? '').toLowerCase().replace(/\s/g, '');
      const qNorm = q.replace(/\s/g, '');
      return name.includes(q) || id.includes(qNorm);
    });
  }, [runs, subscriptionFilter]);

  const fetchLatestRuns = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const user = getCurrentUser();
      const [latestRuns, userSubs] = await Promise.all([
        finopsService.getLatestPerSubscription(),
        user?.id ? userService.getUserSubscriptions(user.id) : Promise.resolve([])
      ]);

      const allowedIds = new Set(userSubs.map(s => s.subscriptionId));
      const visible =
        user?.isAdmin === true
          ? latestRuns
          : latestRuns.filter(r => allowedIds.has(r.subscriptionId));

      setAssignedSubscriptionCount(user?.id ? userSubs.length : 0);
      setRuns(visible);
    } catch (err) {
      console.error('Failed to load FinOps metrics:', err);
      setError('Failed to load FinOps metrics. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setPermissionsLoaded(true);
    }
  };

  useEffect(() => {
    fetchLatestRuns();
  }, []);

  const user = getCurrentUser();
  const hasNoSubscriptionAccess =
    permissionsLoaded &&
    !error &&
    user?.isAdmin !== true &&
    assignedSubscriptionCount === 0;

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (hasNoSubscriptionAccess) {
    return (
      <div className="p-6 min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            No subscription access
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don&apos;t have permission to view any FinOps subscriptions. Ask an administrator to assign
            subscriptions to your account in User Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FinOps Metrics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Latest analysis run per subscription
          </p>
          {runs.length > 0 && (
            <div className="mt-4 max-w-md">
              <label htmlFor="finops-subscription-filter" className="sr-only">
                Filter by subscription name or ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  id="finops-subscription-filter"
                  type="search"
                  value={subscriptionFilter}
                  onChange={(e) => setSubscriptionFilter(e.target.value)}
                  placeholder="Filter by subscription name or ID…"
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              {subscriptionFilter.trim() && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Showing {filteredRuns.length} of {runs.length} subscription{runs.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => fetchLatestRuns(true)}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 shrink-0 self-start lg:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!error && runs.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-gray-600 dark:text-gray-400">
          {user?.isAdmin === true
            ? 'No FinOps analysis runs found.'
            : 'No FinOps analysis runs found for the subscriptions you have access to.'}
        </div>
      )}

      {!error && runs.length > 0 && filteredRuns.length === 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-6 text-center text-amber-900 dark:text-amber-200 text-sm">
          No subscriptions match &quot;{subscriptionFilter.trim()}&quot;. Try a different name or ID.
        </div>
      )}

      {filteredRuns.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRuns.map((run) => (
            <div
              key={run.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-white leading-snug">{run.subscriptionName}</h2>
                <span className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap">
                  {run.aiModel}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Monthly Cost (MTD): ${run.totalMonthlyCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Resources Analyzed: {run.totalResourcesAnalyzed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span title={run.runDate}>Run Date: {formatRunDateInUserTimezone(run.runDate)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 break-all">
                Subscription ID: {run.subscriptionId}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedRun(run)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800/50 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  Cost Details
                </button>
                <button
                  onClick={() => setAiRun(run)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800/50 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <BrainCircuit className="w-4 h-4" />
                  AI Recommendations
                </button>
                <button
                  onClick={() => setHistoryRun(run)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-teal-200 dark:border-teal-800/50 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Historical Results
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRun && (
        <CostDetailsModal
          isOpen={true}
          onClose={() => setSelectedRun(null)}
          analysisRunId={selectedRun.id}
          subscriptionName={selectedRun.subscriptionName}
        />
      )}

      {aiRun && (
        <AiRecommendationsModal
          isOpen={true}
          onClose={() => setAiRun(null)}
          analysisRunId={aiRun.id}
          subscriptionName={aiRun.subscriptionName}
        />
      )}

      {historyRun && (
        <HistoricalResultsModal
          isOpen={true}
          onClose={() => setHistoryRun(null)}
          analysisRunId={historyRun.id}
          subscriptionName={historyRun.subscriptionName}
        />
      )}
    </div>
  );
}
