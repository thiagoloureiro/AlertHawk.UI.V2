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
    <div className="min-h-full bg-slate-50/90 dark:bg-slate-950">
      <div className="mx-auto max-w-[1920px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6 space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-end gap-3 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                FinOps Metrics
              </h1>
              {runs.length > 0 && (
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {subscriptionFilter.trim()
                    ? `${filteredRuns.length} / ${runs.length} shown`
                    : `${runs.length} subscription${runs.length === 1 ? '' : 's'}`}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Latest analysis run per subscription — portfolio view
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto xl:min-w-[320px] xl:max-w-xl xl:flex-1 xl:justify-end">
            {runs.length > 0 && (
              <div className="min-w-0 flex-1 sm:max-w-md xl:max-w-none">
                <label htmlFor="finops-subscription-filter" className="sr-only">
                  Filter by subscription name or ID
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="finops-subscription-filter"
                    type="search"
                    value={subscriptionFilter}
                    onChange={(e) => setSubscriptionFilter(e.target.value)}
                    placeholder="Search name, description, or ID…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => fetchLatestRuns(true)}
              disabled={isRefreshing}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!error && runs.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {user?.isAdmin === true
              ? 'No FinOps analysis runs found.'
              : 'No FinOps analysis runs found for the subscriptions you have access to.'}
          </div>
        )}

        {!error && runs.length > 0 && filteredRuns.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            No subscriptions match &quot;{subscriptionFilter.trim()}&quot;. Try a different name or ID.
          </div>
        )}

        {!error && runs.length > 0 && filteredRuns.length > 0 && (
          <section aria-label="Portfolio summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Subscriptions
                </p>
                <p className="truncate text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {portfolioStats.subscriptionCount}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  MTD cost (sum)
                </p>
                <p className="truncate text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  ${portfolioStats.totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                <BarChart2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Resources analyzed
                </p>
                <p className="truncate text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {portfolioStats.totalResources.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-2 lg:col-span-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Newest run in view
                </p>
                <p
                  className="truncate text-sm font-semibold text-slate-900 dark:text-white"
                  title={portfolioStats.latestRunDate ?? undefined}
                >
                  {portfolioStats.latestRunDate
                    ? formatApiDateTimeInUserLocale(portfolioStats.latestRunDate)
                    : '—'}
                </p>
              </div>
            </div>
          </section>
        )}

        {filteredRuns.length > 0 && (
          <div className="flex min-h-[min(70vh,900px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:max-h-[calc(100vh-13rem)] lg:flex-row">
            <aside className="flex max-h-[min(40vh,360px)] shrink-0 flex-col border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r xl:w-96">
              <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Subscriptions
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
                  Select one to view details
                </p>
              </div>
              <nav
                className="min-h-0 flex-1 overflow-y-auto p-2"
                aria-label="FinOps subscriptions"
              >
                <ul className="space-y-1">
                  {filteredRuns.map((run) => {
                    const job = analysisJobUi[run.subscriptionId];
                    const isActive = run.subscriptionId === activeSubscriptionId;
                    return (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => setActiveSubscriptionId(run.subscriptionId)}
                          aria-current={isActive ? 'true' : undefined}
                          className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'border-blue-300 bg-blue-50/90 shadow-sm dark:border-blue-700 dark:bg-blue-950/50'
                              : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
                              {run.subscriptionName}
                            </span>
                            <div className="mt-1 flex flex-col gap-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                              <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                                $
                                {run.totalMonthlyCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                <span className="font-normal text-slate-500 dark:text-slate-500">MTD</span>
                              </span>
                              <span className="tabular-nums text-slate-600 dark:text-slate-400">
                                {run.totalResourcesAnalyzed.toLocaleString()} resources
                              </span>
                            </div>
                            {job?.phase === 'running' && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                <span className="truncate">{job.label}</span>
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
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
                <div className="p-5 sm:p-6 lg:p-8">
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Subscription
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                        {activeRun.subscriptionName}
                      </h2>
                      <p
                        className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400"
                        title={activeRun.subscriptionId}
                      >
                        {activeRun.subscriptionId}
                      </p>
                    </div>
                    <span
                      className="w-fit shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      title={activeRun.aiModel}
                    >
                      {activeRun.aiModel}
                    </span>
                  </div>

                  <div className="mb-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-medium uppercase tracking-wide">Monthly cost (MTD)</span>
                      </div>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        $
                        {activeRun.totalMonthlyCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-medium uppercase tracking-wide">Resources analyzed</span>
                      </div>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        {activeRun.totalResourcesAnalyzed.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-medium uppercase tracking-wide">Run date</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white" title={activeRun.runDate}>
                        {formatApiDateTimeInUserLocale(activeRun.runDate)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Description
                      </h3>
                      {!descriptionEditing[activeRun.subscriptionId] && (
                        <button
                          type="button"
                          onClick={() => beginEditDescription(activeRun)}
                          aria-label="Edit description"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'italic text-slate-400 dark:text-slate-500'
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
                          className="w-full max-w-md rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void saveDescription(activeRun.subscriptionId)}
                            disabled={descriptionEditing[activeRun.subscriptionId].saving}
                            className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
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
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
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

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => void startBackgroundAnalysis(activeRun.subscriptionId, 'current')}
                      disabled={detailAnalysisJob?.phase === 'running'}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        detailAnalysisJob?.phase === 'running'
                          ? 'cursor-wait border-emerald-400/60 bg-emerald-50 text-emerald-900 pointer-events-none dark:border-emerald-500/45 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      {detailAnalysisJob?.phase === 'running' && (
                        <span
                          className="pointer-events-none absolute inset-0 z-0 bg-emerald-400/15 motion-safe:animate-pulse dark:bg-emerald-400/10"
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
                          {detailAnalysisJob?.phase === 'running' ? detailAnalysisJob.label : 'Run new analysis'}
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 shadow-sm hover:bg-blue-50 dark:border-blue-800/50 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                      >
                        <BarChart2 className="h-4 w-4 shrink-0" />
                        Cost details
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiRun(activeRun)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-purple-800 shadow-sm hover:bg-purple-50 dark:border-purple-800/50 dark:bg-slate-900 dark:text-purple-300 dark:hover:bg-purple-950/40"
                      >
                        <BrainCircuit className="h-4 w-4 shrink-0" />
                        AI recommendations
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryRun(activeRun)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-800 shadow-sm hover:bg-teal-50 dark:border-teal-800/50 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-teal-950/40"
                      >
                        <TrendingUp className="h-4 w-4 shrink-0" />
                        Historical results
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-500 dark:text-slate-400">
                  <Database className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Select a subscription from the list to see details.</p>
                </div>
              )}
            </section>
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
      </div>
    </div>
  );
}
