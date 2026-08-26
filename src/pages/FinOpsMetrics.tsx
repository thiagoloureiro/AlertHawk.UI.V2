import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  Database,
  Sparkles,
  RefreshCw,
  AlertCircle,
  BarChart2,
  BrainCircuit,
  TrendingUp,
  Search,
  Play,
  Loader2,
  Pencil,
  Check,
  X,
  ChevronRight,
  LineChart,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import finopsService, { FinopsAnalysisRun } from '../services/finopsService';
import userService from '../services/userService';
import { CostDetailsModal } from '../components/CostDetailsModal';
import { AiRecommendationsModal } from '../components/AiRecommendationsModal';
import { HistoricalResultsModal } from '../components/HistoricalResultsModal';
import { CostForecastModal } from '../components/CostForecastModal';
import { formatApiDateTimeInUserLocale } from '../utils/dateUtils';
import { cn } from '../lib/utils';

type AnalysisMonthSelection = 'current' | 'previous';
type SubscriptionStatus = 'ready' | 'analyzing' | 'error';
type SortKey = 'name' | 'cost' | 'status';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | SubscriptionStatus;

function getCurrentUser(): { id: string; isAdmin?: boolean } | null {
  const stored = localStorage.getItem('userInfo');
  return stored ? JSON.parse(stored) : null;
}

const ANALYSIS_POLL_MS = 2000;
const ANALYSIS_MAX_WAIT_MS = 20 * 60 * 1000;

const STATUS_RANK: Record<SubscriptionStatus, number> = {
  analyzing: 0,
  error: 1,
  ready: 2,
};

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'error', label: 'Error' },
];

function finopsAsyncErrorMessage(err: unknown): string {
  const ax = err as {
    response?: { data?: { message?: string; Message?: string } };
    message?: string;
  };
  const d = ax.response?.data;
  return d?.message ?? d?.Message ?? ax.message ?? 'Request failed';
}

type SubscriptionAnalysisJobUi =
  | { phase: 'running'; label: string }
  | { phase: 'error'; message: string };

type DescriptionEditState = {
  draft: string;
  saving: boolean;
  error: string | null;
};

function getSubscriptionStatus(
  subscriptionId: string,
  analysisJobUi: Record<string, SubscriptionAnalysisJobUi>,
): SubscriptionStatus {
  const job = analysisJobUi[subscriptionId];
  if (job?.phase === 'running') return 'analyzing';
  if (job?.phase === 'error') return 'error';
  return 'ready';
}

function statusLabel(status: SubscriptionStatus): string {
  if (status === 'analyzing') return 'Analyzing';
  if (status === 'error') return 'Error';
  return 'Ready';
}

function statusBadgeClass(status: SubscriptionStatus): string {
  if (status === 'analyzing') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  }
  if (status === 'error') {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
}

function formatCost(value: number, fractionDigits = 2): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function FinOpsMetrics() {
  const [runs, setRuns] = useState<FinopsAnalysisRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  /** How many subscriptions this user is assigned (0 = none); admins still fetch but UI ignores for access. */
  const [assignedSubscriptionCount, setAssignedSubscriptionCount] = useState(0);
  const [costModalRun, setCostModalRun] = useState<FinopsAnalysisRun | null>(null);
  const [aiRun, setAiRun] = useState<FinopsAnalysisRun | null>(null);
  const [historyRun, setHistoryRun] = useState<FinopsAnalysisRun | null>(null);
  const [forecastRun, setForecastRun] = useState<FinopsAnalysisRun | null>(null);
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  /** Per-subscription async analysis (POST start-async + poll jobs/{id}). */
  const [analysisJobUi, setAnalysisJobUi] = useState<Record<string, SubscriptionAnalysisJobUi>>({});
  const [descriptionEditing, setDescriptionEditing] = useState<Record<string, DescriptionEditState>>({});
  /** Which subscription is selected for the detail panel. */
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: runs.length,
      ready: 0,
      analyzing: 0,
      error: 0,
    };
    for (const run of runs) {
      counts[getSubscriptionStatus(run.subscriptionId, analysisJobUi)] += 1;
    }
    return counts;
  }, [runs, analysisJobUi]);

  const filteredRuns = useMemo(() => {
    const q = subscriptionFilter.trim().toLowerCase();
    const qNorm = q.replace(/\s/g, '');

    let next = runs.filter((run) => {
      if (statusFilter !== 'all') {
        const status = getSubscriptionStatus(run.subscriptionId, analysisJobUi);
        if (status !== statusFilter) return false;
      }
      if (!q) return true;
      const name = (run.subscriptionName ?? '').toLowerCase();
      const description = (run.description ?? '').toLowerCase();
      const id = (run.subscriptionId ?? '').toLowerCase().replace(/\s/g, '');
      return name.includes(q) || description.includes(q) || id.includes(qNorm);
    });

    const mul = sortDir === 'asc' ? 1 : -1;
    next = [...next].sort((a, b) => {
      if (sortKey === 'cost') {
        return mul * (a.totalMonthlyCost - b.totalMonthlyCost);
      }
      if (sortKey === 'status') {
        const sa = getSubscriptionStatus(a.subscriptionId, analysisJobUi);
        const sb = getSubscriptionStatus(b.subscriptionId, analysisJobUi);
        const byStatus = STATUS_RANK[sa] - STATUS_RANK[sb];
        if (byStatus !== 0) return mul * byStatus;
        return a.subscriptionName.localeCompare(b.subscriptionName, undefined, {
          sensitivity: 'base',
        });
      }
      return (
        mul *
        a.subscriptionName.localeCompare(b.subscriptionName, undefined, {
          sensitivity: 'base',
        })
      );
    });

    return next;
  }, [runs, subscriptionFilter, statusFilter, sortKey, sortDir, analysisJobUi]);

  const portfolioStats = useMemo(() => {
    let totalCost = 0;
    let totalResources = 0;
    let latestRunDate: string | null = null;
    let highestCostSub: FinopsAnalysisRun | null = null;
    for (const r of filteredRuns) {
      totalCost += r.totalMonthlyCost;
      totalResources += r.totalResourcesAnalyzed;
      if (!latestRunDate || r.runDate > latestRunDate) {
        latestRunDate = r.runDate;
      }
      if (!highestCostSub || r.totalMonthlyCost > highestCostSub.totalMonthlyCost) {
        highestCostSub = r;
      }
    }
    return {
      totalCost,
      totalResources,
      subscriptionCount: filteredRuns.length,
      latestRunDate,
      highestCostSub,
    };
  }, [filteredRuns]);

  const hasActiveFilters =
    Boolean(subscriptionFilter.trim()) || statusFilter !== 'all';

  const clearFilters = () => {
    setSubscriptionFilter('');
    setStatusFilter('all');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  };

  useEffect(() => {
    if (!activeSubscriptionId) return;
    if (!runs.some((r) => r.subscriptionId === activeSubscriptionId)) {
      setActiveSubscriptionId(null);
    }
  }, [runs, activeSubscriptionId]);

  useEffect(() => {
    if (!activeSubscriptionId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (costModalRun || aiRun || historyRun || forecastRun) return;
      setActiveSubscriptionId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSubscriptionId, costModalRun, aiRun, historyRun, forecastRun]);

  const activeRun = useMemo(() => {
    if (!activeSubscriptionId) return null;
    return runs.find((r) => r.subscriptionId === activeSubscriptionId) ?? null;
  }, [runs, activeSubscriptionId]);

  const closeSubscriptionDialog = () => {
    if (activeSubscriptionId) {
      cancelEditDescription(activeSubscriptionId);
    }
    setActiveSubscriptionId(null);
  };

  const detailAnalysisJob = activeRun ? analysisJobUi[activeRun.subscriptionId] : undefined;

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

  const startBackgroundAnalysis = async (
    subscriptionId: string,
    monthSelection: AnalysisMonthSelection,
  ) => {
    setAnalysisJobUi((prev) => ({
      ...prev,
      [subscriptionId]: {
        phase: 'running',
        label: monthSelection === 'previous' ? 'Starting previous month…' : 'Starting current month…',
      },
    }));
    const started = Date.now();
    try {
      const { jobId } = await finopsService.startAnalysisAsync(subscriptionId, monthSelection);
      if (!mountedRef.current) return;

      while (Date.now() - started < ANALYSIS_MAX_WAIT_MS) {
        const job = await finopsService.getAnalysisJobStatus(jobId);
        if (!mountedRef.current) return;

        const st = (job.status ?? '').toLowerCase();
        if (st === 'failed') {
          setAnalysisJobUi((prev) => ({
            ...prev,
            [subscriptionId]: {
              phase: 'error',
              message: job.message ?? job.errorDetails ?? 'Analysis failed.',
            },
          }));
          return;
        }
        if (st === 'completed') {
          if (job.success === false) {
            setAnalysisJobUi((prev) => ({
              ...prev,
              [subscriptionId]: {
                phase: 'error',
                message: job.message ?? job.errorDetails ?? 'Analysis completed with errors.',
              },
            }));
            return;
          }
          setAnalysisJobUi((prev) => {
            const next = { ...prev };
            delete next[subscriptionId];
            return next;
          });
          await fetchLatestRuns(true);
          return;
        }

        const label =
          st === 'pending' ? 'Queued…' : st === 'running' ? 'Analyzing…' : job.status || 'Working…';
        setAnalysisJobUi((prev) => ({
          ...prev,
          [subscriptionId]: { phase: 'running', label },
        }));

        await new Promise((r) => setTimeout(r, ANALYSIS_POLL_MS));
      }

      if (!mountedRef.current) return;
      setAnalysisJobUi((prev) => ({
        ...prev,
        [subscriptionId]: {
          phase: 'error',
          message: 'Analysis is still running. Refresh this page in a few minutes.',
        },
      }));
    } catch (err) {
      console.error('Start analysis failed:', err);
      if (!mountedRef.current) return;
      setAnalysisJobUi((prev) => ({
        ...prev,
        [subscriptionId]: { phase: 'error', message: finopsAsyncErrorMessage(err) },
      }));
    }
  };

  const beginEditDescription = (run: FinopsAnalysisRun) => {
    setDescriptionEditing((prev) => ({
      ...prev,
      [run.subscriptionId]: {
        draft: run.description ?? '',
        saving: false,
        error: null,
      },
    }));
  };

  const cancelEditDescription = (subscriptionId: string) => {
    setDescriptionEditing((prev) => {
      const next = { ...prev };
      delete next[subscriptionId];
      return next;
    });
  };

  const setDescriptionDraft = (subscriptionId: string, value: string) => {
    setDescriptionEditing((prev) => {
      const current = prev[subscriptionId];
      if (!current) return prev;
      return {
        ...prev,
        [subscriptionId]: {
          ...current,
          draft: value.slice(0, 50),
          error: null,
        },
      };
    });
  };

  const saveDescription = async (subscriptionId: string) => {
    const editState = descriptionEditing[subscriptionId];
    if (!editState || editState.saving) return;

    setDescriptionEditing((prev) => ({
      ...prev,
      [subscriptionId]: {
        ...prev[subscriptionId],
        saving: true,
        error: null,
      },
    }));

    try {
      const trimmedDraft = editState.draft.trim().slice(0, 50);
      const payloadDescription = trimmedDraft ? trimmedDraft : null;
      await finopsService.createOrUpdateSubscription({
        subscriptionId,
        description: payloadDescription,
      });

      setRuns((prev) =>
        prev.map((run) =>
          run.subscriptionId === subscriptionId
            ? { ...run, description: payloadDescription ?? '' }
            : run
        )
      );
      cancelEditDescription(subscriptionId);
    } catch (err) {
      setDescriptionEditing((prev) => ({
        ...prev,
        [subscriptionId]: {
          ...prev[subscriptionId],
          saving: false,
          error: finopsAsyncErrorMessage(err),
        },
      }));
    }
  };

  const user = getCurrentUser();
  const hasNoSubscriptionAccess =
    permissionsLoaded &&
    !error &&
    user?.isAdmin !== true &&
    assignedSubscriptionCount === 0;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" text="Loading FinOps metrics..." />
      </div>
    );
  }

  if (hasNoSubscriptionAccess) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            No subscription access
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You don&apos;t have permission to view any FinOps subscriptions. Ask an administrator to
            assign subscriptions to your account in User Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Metrics
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              FinOps metrics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Latest analysis run per subscription
              {runs.length > 0 && (
                <span className="text-gray-400 dark:text-gray-500">
                  {' · '}
                  {hasActiveFilters
                    ? `${filteredRuns.length} / ${runs.length} shown`
                    : `${runs.length} subscription${runs.length === 1 ? '' : 's'}`}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchLatestRuns(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!error && runs.length === 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {user?.isAdmin === true
              ? 'No FinOps analysis runs found.'
              : 'No FinOps analysis runs found for the subscriptions you have access to.'}
          </div>
        )}

        {!error && runs.length > 0 && (
          <>
            <section aria-label="Portfolio summary" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Subscriptions</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                    {portfolioStats.subscriptionCount}
                  </span>
                  {hasActiveFilters && (
                    <span className="text-xs text-gray-400">/ {runs.length}</span>
                  )}
                  <Database className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  Total month-to-date cost
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatCost(portfolioStats.totalCost)}
                  </span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Highest cost</div>
                {portfolioStats.highestCostSub ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSubscriptionId(portfolioStats.highestCostSub!.subscriptionId)
                    }
                    className="w-full text-left group"
                    title={portfolioStats.highestCostSub.subscriptionName}
                  >
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatCost(portfolioStats.highestCostSub.totalMonthlyCost)}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {portfolioStats.highestCostSub.subscriptionName}
                    </div>
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Resources analyzed</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                    {portfolioStats.totalResources.toLocaleString()}
                  </span>
                  <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
            </section>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <label htmlFor="finops-subscription-filter" className="sr-only">
                    Search subscriptions
                  </label>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="finops-subscription-filter"
                    type="search"
                    value={subscriptionFilter}
                    onChange={(e) => setSubscriptionFilter(e.target.value)}
                    placeholder="Search by name, description, or ID…"
                    className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={`${sortKey}:${sortDir}`}
                      onChange={(e) => {
                        const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                        setSortKey(key);
                        setSortDir(dir);
                      }}
                      className="px-2.5 py-1.5 rounded-md text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      aria-label="Sort subscriptions"
                    >
                      <option value="cost:desc">Cost · high to low</option>
                      <option value="cost:asc">Cost · low to high</option>
                      <option value="name:asc">Name · A–Z</option>
                      <option value="name:desc">Name · Z–A</option>
                      <option value="status:asc">Status · analyzing first</option>
                      <option value="status:desc">Status · ready first</option>
                    </select>
                  </div>

                  <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-900">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                      )}
                      aria-pressed={viewMode === 'grid'}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                        viewMode === 'table'
                          ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                      )}
                      aria-pressed={viewMode === 'table'}
                    >
                      <List className="w-3.5 h-3.5" />
                      Table
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((chip) => {
                  const count = statusCounts[chip.id];
                  const active = statusFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setStatusFilter(chip.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900',
                      )}
                    >
                      {chip.label}
                      <span
                        className={cn(
                          'tabular-nums rounded px-1 py-px text-[10px]',
                          active
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-6 text-center text-sm text-amber-900 dark:text-amber-200">
                No subscriptions match the current filters.
                {subscriptionFilter.trim() ? (
                  <> Search: &quot;{subscriptionFilter.trim()}&quot;.</>
                ) : null}{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="underline underline-offset-2 font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                    {filteredRuns.map((run) => {
                      const status = getSubscriptionStatus(run.subscriptionId, analysisJobUi);
                      const job = analysisJobUi[run.subscriptionId];
                      const isActive = run.subscriptionId === activeSubscriptionId;
                      return (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setActiveSubscriptionId(run.subscriptionId)}
                          aria-current={isActive ? 'true' : undefined}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            isActive
                              ? 'border-blue-300 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-950/30'
                              : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                {run.subscriptionName}
                              </div>
                              <p
                                className={cn(
                                  'mt-0.5 text-[11px] line-clamp-1',
                                  run.description?.trim()
                                    ? 'text-gray-500 dark:text-gray-400'
                                    : 'italic text-gray-400 dark:text-gray-500',
                                )}
                              >
                                {run.description?.trim() || 'No description'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                statusBadgeClass(status),
                              )}
                            >
                              {statusLabel(status)}
                            </span>
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                Month to date
                              </div>
                              <div className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatCost(run.totalMonthlyCost, 0)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                Resources
                              </div>
                              <div className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">
                                {run.totalResourcesAnalyzed.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {job?.phase === 'running' && (
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                              <span className="truncate">{job.label}</span>
                            </p>
                          )}
                          {job?.phase === 'error' && (
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{job.message}</span>
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                            <th className="px-3 py-2 text-left">
                              <button
                                type="button"
                                onClick={() => toggleSort('name')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                Subscription
                                {sortKey === 'name' && (
                                  <span className="normal-case tracking-normal text-[10px]">
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th className="px-3 py-2 text-left">
                              <button
                                type="button"
                                onClick={() => toggleSort('status')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                Status
                                {sortKey === 'status' && (
                                  <span className="normal-case tracking-normal text-[10px]">
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => toggleSort('cost')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                Cost (MTD)
                                {sortKey === 'cost' && (
                                  <span className="normal-case tracking-normal text-[10px]">
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Resources
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Last run
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                          {filteredRuns.map((run) => {
                            const status = getSubscriptionStatus(
                              run.subscriptionId,
                              analysisJobUi,
                            );
                            const isActive = run.subscriptionId === activeSubscriptionId;
                            return (
                              <tr
                                key={run.id}
                                onClick={() => setActiveSubscriptionId(run.subscriptionId)}
                                className={cn(
                                  'cursor-pointer transition-colors',
                                  isActive
                                    ? 'bg-blue-50/80 dark:bg-blue-950/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-900/60',
                                )}
                              >
                                <td className="px-3 py-2.5">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {run.subscriptionName}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate max-w-[18rem]">
                                    {run.subscriptionId}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={cn(
                                      'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                      statusBadgeClass(status),
                                    )}
                                  >
                                    {statusLabel(status)}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {formatCost(run.totalMonthlyCost)}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {run.totalResourcesAnalyzed.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {formatApiDateTimeInUserLocale(run.runDate)}
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
            )}
          </>
        )}
      </div>

      {activeRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeSubscriptionDialog}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="finops-subscription-dialog-title"
            className="w-full max-w-2xl max-h-[min(90vh,880px)] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 sm:p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Subscription
                </p>
                <h2
                  id="finops-subscription-dialog-title"
                  className="mt-0.5 text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {activeRun.subscriptionName}
                </h2>
                <p
                  className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400"
                  title={activeRun.subscriptionId}
                >
                  {activeRun.subscriptionId}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'w-fit shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                    statusBadgeClass(
                      getSubscriptionStatus(activeRun.subscriptionId, analysisJobUi),
                    ),
                  )}
                >
                  {statusLabel(getSubscriptionStatus(activeRun.subscriptionId, analysisJobUi))}
                </span>
                <span
                  className="w-fit shrink-0 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                  title={activeRun.aiModel}
                >
                  {activeRun.aiModel}
                </span>
                <button
                  type="button"
                  onClick={closeSubscriptionDialog}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px]">Monthly cost (month to date)</span>
                </div>
                <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {formatCost(activeRun.totalMonthlyCost)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Database className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[11px]">Resources analyzed</span>
                </div>
                <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {activeRun.totalResourcesAnalyzed.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px]">Run date</span>
                </div>
                <p
                  className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white"
                  title={activeRun.runDate}
                >
                  {formatApiDateTimeInUserLocale(activeRun.runDate)}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Description
                </h3>
                {!descriptionEditing[activeRun.subscriptionId] && (
                  <button
                    type="button"
                    onClick={() => beginEditDescription(activeRun)}
                    aria-label="Edit description"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {!descriptionEditing[activeRun.subscriptionId] && (
                <p
                  className={cn(
                    'mt-1.5 line-clamp-2 text-xs leading-snug',
                    activeRun.description?.trim()
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'italic text-gray-400 dark:text-gray-500',
                  )}
                >
                  {activeRun.description?.trim()
                    ? activeRun.description
                    : 'No description yet'}
                </p>
              )}
              {descriptionEditing[activeRun.subscriptionId] && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="text"
                    value={descriptionEditing[activeRun.subscriptionId].draft}
                    onChange={(e) =>
                      setDescriptionDraft(activeRun.subscriptionId, e.target.value)
                    }
                    placeholder="Max 50 characters"
                    maxLength={50}
                    className="w-full max-w-md rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-1.5 text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void saveDescription(activeRun.subscriptionId)}
                      disabled={descriptionEditing[activeRun.subscriptionId].saving}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-950 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-60 transition-colors"
                    >
                      {descriptionEditing[activeRun.subscriptionId].saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelEditDescription(activeRun.subscriptionId)}
                      disabled={descriptionEditing[activeRun.subscriptionId].saving}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {descriptionEditing[activeRun.subscriptionId].draft.length}/50
                    </span>
                  </div>
                  {descriptionEditing[activeRun.subscriptionId].error && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      {descriptionEditing[activeRun.subscriptionId].error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <section aria-labelledby="finops-analysis-heading" className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    id="finops-analysis-heading"
                    className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                  >
                    Analysis
                  </h3>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Refresh month-to-date costs for this subscription
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void startBackgroundAnalysis(activeRun.subscriptionId, 'current')
                  }
                  disabled={detailAnalysisJob?.phase === 'running'}
                  className={cn(
                    'relative w-full overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
                    detailAnalysisJob?.phase === 'running'
                      ? 'cursor-wait bg-emerald-600/90 text-white pointer-events-none'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
                  )}
                >
                  {detailAnalysisJob?.phase === 'running' && (
                    <span
                      className="pointer-events-none absolute inset-0 z-0 bg-white/10 motion-safe:animate-pulse"
                      aria-hidden
                    />
                  )}
                  <span className="relative z-10 inline-flex w-full items-center justify-center gap-2">
                    {detailAnalysisJob?.phase === 'running' ? (
                      <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 shrink-0 fill-current" />
                    )}
                    <span className="truncate">
                      {detailAnalysisJob?.phase === 'running'
                        ? detailAnalysisJob.label
                        : 'Run new analysis'}
                    </span>
                  </span>
                </button>
                {detailAnalysisJob?.phase === 'error' && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{detailAnalysisJob.message}</span>
                  </div>
                )}
              </section>

              <section aria-labelledby="finops-explore-heading" className="space-y-2">
                <h3
                  id="finops-explore-heading"
                  className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                >
                  Explore
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCostModalRun(activeRun)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3.5 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <BarChart2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Cost details
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        Breakdown by resource group, service, and App ID
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiRun(activeRun)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3.5 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <BrainCircuit className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          AI recommendations
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        Optimization ideas from the latest analysis run
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryRun(activeRun)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3.5 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Historical results
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        Daily and monthly trends with App ID and RG filters
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForecastRun(activeRun)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3.5 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <LineChart className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Forecast
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        Project upcoming spend from complete daily history
                      </span>
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {costModalRun && (
        <CostDetailsModal
          isOpen={true}
          onClose={() => setCostModalRun(null)}
          analysisRunId={costModalRun.id}
          subscriptionName={costModalRun.subscriptionName}
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

      {forecastRun && (
        <CostForecastModal
          isOpen={true}
          onClose={() => setForecastRun(null)}
          analysisRunId={forecastRun.id}
          subscriptionName={forecastRun.subscriptionName}
        />
      )}
    </div>
  );
}
