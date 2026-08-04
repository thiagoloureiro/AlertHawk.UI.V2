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
} from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import finopsService, { FinopsAnalysisRun } from '../services/finopsService';
import userService from '../services/userService';
import { CostDetailsModal } from '../components/CostDetailsModal';
import { AiRecommendationsModal } from '../components/AiRecommendationsModal';
import { HistoricalResultsModal } from '../components/HistoricalResultsModal';
import { formatApiDateTimeInUserLocale } from '../utils/dateUtils';

type AnalysisMonthSelection = 'current' | 'previous';

function getCurrentUser(): { id: string; isAdmin?: boolean } | null {
  const stored = localStorage.getItem('userInfo');
  return stored ? JSON.parse(stored) : null;
}

const ANALYSIS_POLL_MS = 2000;
const ANALYSIS_MAX_WAIT_MS = 20 * 60 * 1000;

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
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  /** Per-subscription async analysis (POST start-async + poll jobs/{id}). */
  const [analysisJobUi, setAnalysisJobUi] = useState<Record<string, SubscriptionAnalysisJobUi>>({});
  const [descriptionEditing, setDescriptionEditing] = useState<Record<string, DescriptionEditState>>({});
  /** Master-detail: which subscription row is selected in the side list. */
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const filteredRuns = useMemo(() => {
    const q = subscriptionFilter.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((run) => {
      const name = (run.subscriptionName ?? '').toLowerCase();
      const description = (run.description ?? '').toLowerCase();
      const id = (run.subscriptionId ?? '').toLowerCase().replace(/\s/g, '');
      const qNorm = q.replace(/\s/g, '');
      return name.includes(q) || description.includes(q) || id.includes(qNorm);
    });
  }, [runs, subscriptionFilter]);

  const portfolioStats = useMemo(() => {
    let totalCost = 0;
    let totalResources = 0;
    let latestRunDate: string | null = null;
    for (const r of filteredRuns) {
      totalCost += r.totalMonthlyCost;
      totalResources += r.totalResourcesAnalyzed;
      if (!latestRunDate || r.runDate > latestRunDate) {
        latestRunDate = r.runDate;
      }
    }
    return {
      totalCost,
      totalResources,
      subscriptionCount: filteredRuns.length,
      latestRunDate,
    };
  }, [filteredRuns]);

  useEffect(() => {
    if (filteredRuns.length === 0) {
      setActiveSubscriptionId(null);
      return;
    }
    setActiveSubscriptionId((current) => {
      if (current && filteredRuns.some((r) => r.subscriptionId === current)) {
        return current;
      }
      return filteredRuns[0].subscriptionId;
    });
  }, [filteredRuns]);

  const activeRun = useMemo(() => {
    if (!activeSubscriptionId) return null;
    return filteredRuns.find((r) => r.subscriptionId === activeSubscriptionId) ?? null;
  }, [filteredRuns, activeSubscriptionId]);

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
                  {subscriptionFilter.trim()
                    ? `${filteredRuns.length} / ${runs.length} shown`
                    : `${runs.length} subscription${runs.length === 1 ? '' : 's'}`}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {runs.length > 0 && (
              <div className="relative w-full sm:w-64">
                <label htmlFor="finops-subscription-filter" className="sr-only">
                  Filter by subscription name or ID
                </label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  id="finops-subscription-filter"
                  type="search"
                  value={subscriptionFilter}
                  onChange={(e) => setSubscriptionFilter(e.target.value)}
                  placeholder="Search name, description, or ID…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => fetchLatestRuns(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
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

        {!error && runs.length > 0 && filteredRuns.length === 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-6 text-center text-sm text-amber-900 dark:text-amber-200">
            No subscriptions match &quot;{subscriptionFilter.trim()}&quot;. Try a different name or ID.
          </div>
        )}

        {!error && runs.length > 0 && filteredRuns.length > 0 && (
          <section aria-label="Portfolio summary" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Subscriptions</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {portfolioStats.subscriptionCount}
                </span>
                <Database className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                Month to date cost (sum)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  $
                  {portfolioStats.totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                Resources analyzed
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {portfolioStats.totalResources.toLocaleString()}
                </span>
                <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Newest run in view</div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white truncate"
                  title={portfolioStats.latestRunDate ?? undefined}
                >
                  {portfolioStats.latestRunDate
                    ? formatApiDateTimeInUserLocale(portfolioStats.latestRunDate)
                    : '—'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </div>
            </div>
          </section>
        )}

        {filteredRuns.length > 0 && (
          <div className="flex min-h-[min(70vh,900px)] flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 lg:max-h-[calc(100vh-13rem)] lg:flex-row">
            <aside className="flex max-h-[min(40vh,360px)] shrink-0 flex-col border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/80 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r xl:w-96">
              <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5">
                <h2 className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Subscriptions
                </h2>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-500">
                  Select one to view details
                </p>
              </div>
              <nav
                className="min-h-0 flex-1 overflow-y-auto p-1.5"
                aria-label="FinOps subscriptions"
              >
                <ul className="space-y-0.5">
                  {filteredRuns.map((run) => {
                    const job = analysisJobUi[run.subscriptionId];
                    const isActive = run.subscriptionId === activeSubscriptionId;
                    return (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => setActiveSubscriptionId(run.subscriptionId)}
                          aria-current={isActive ? 'true' : undefined}
                          className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                            isActive
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                              : 'border-transparent hover:bg-white dark:hover:bg-gray-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-white">
                              {run.subscriptionName}
                            </span>
                            <p
                              className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${
                                run.description?.trim()
                                  ? 'text-gray-500 dark:text-gray-400'
                                  : 'italic text-gray-400 dark:text-gray-500'
                              }`}
                              title={run.description?.trim() ? run.description : undefined}
                            >
                              {run.description?.trim() ? run.description : 'No description'}
                            </p>
                            <div className="mt-1.5 flex flex-col gap-0.5 border-t border-gray-100 dark:border-gray-800/80 pt-1.5">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  Month to date
                                </span>
                                <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  $
                                  {run.totalMonthlyCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  Resources
                                </span>
                                <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">
                                  {run.totalResourcesAnalyzed.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {job?.phase === 'running' && (
                              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                <span className="truncate">{job.label}</span>
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
              {activeRun ? (
                <div className="p-4 sm:p-5 lg:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Subscription
                      </p>
                      <h2 className="mt-0.5 text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                        {activeRun.subscriptionName}
                      </h2>
                      <p
                        className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400"
                        title={activeRun.subscriptionId}
                      >
                        {activeRun.subscriptionId}
                      </p>
                    </div>
                    <span
                      className="w-fit shrink-0 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                      title={activeRun.aiModel}
                    >
                      {activeRun.aiModel}
                    </span>
                  </div>

                  <div className="mb-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[11px]">Monthly cost (month to date)</span>
                      </div>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                        $
                        {activeRun.totalMonthlyCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
                        className={`mt-1.5 line-clamp-2 text-xs leading-snug ${
                          activeRun.description?.trim()
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'italic text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {activeRun.description?.trim() ? activeRun.description : 'No description yet'}
                      </p>
                    )}
                    {descriptionEditing[activeRun.subscriptionId] && (
                      <div className="mt-2 space-y-1.5">
                        <input
                          type="text"
                          value={descriptionEditing[activeRun.subscriptionId].draft}
                          onChange={(e) => setDescriptionDraft(activeRun.subscriptionId, e.target.value)}
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

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => void startBackgroundAnalysis(activeRun.subscriptionId, 'current')}
                      disabled={detailAnalysisJob?.phase === 'running'}
                      className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        detailAnalysisJob?.phase === 'running'
                          ? 'cursor-wait border-emerald-300 bg-emerald-50 text-emerald-900 pointer-events-none dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {detailAnalysisJob?.phase === 'running' && (
                        <span
                          className="pointer-events-none absolute inset-0 z-0 bg-emerald-400/10 motion-safe:animate-pulse"
                          aria-hidden
                        />
                      )}
                      <span className="relative z-10 inline-flex w-full items-center justify-center gap-2">
                        {detailAnalysisJob?.phase === 'running' ? (
                          <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Play className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">
                          {detailAnalysisJob?.phase === 'running'
                            ? detailAnalysisJob.label
                            : 'Run new analysis'}
                        </span>
                      </span>
                    </button>
                    {detailAnalysisJob?.phase === 'error' && (
                      <p className="text-xs text-red-600 dark:text-red-400">{detailAnalysisJob.message}</p>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setCostModalRun(activeRun)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      >
                        <BarChart2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        Cost details
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiRun(activeRun)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      >
                        <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        AI recommendations
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryRun(activeRun)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      >
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        Historical results
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-gray-500 dark:text-gray-400">
                  <Database className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Select a subscription from the list to see details.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

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
    </div>
  );
}
