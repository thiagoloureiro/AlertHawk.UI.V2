import { useState, useEffect, useMemo } from 'react';
import {
  Server, Globe, AlertCircle, Activity, Zap, HelpCircle, X, Search,
} from 'lucide-react';
import axios from 'axios';
import { LoadingSpinner } from '../components/ui';
import { cn } from '../lib/utils';

interface MonitorAgent {
  id: number;
  hostname: string;
  timeStamp: string;
  isMaster: boolean;
  listTasks: number;
  version: string;
  monitorRegion: number;
}

const panelClass =
  'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950';

const REGION_NAMES: Record<number, string> = {
  1: 'Europe',
  2: 'Oceania',
  3: 'North America',
  4: 'South America',
  5: 'Africa',
  6: 'Asia',
  7: 'Custom',
  8: 'Custom2',
  9: 'Custom3',
  10: 'Custom4',
  11: 'Custom5',
};

const REGION_COLORS: Record<number, string> = {
  1: 'text-blue-500',
  2: 'text-emerald-500',
  3: 'text-violet-500',
  4: 'text-orange-500',
  5: 'text-red-500',
  6: 'text-indigo-500',
};

function getRegionName(region: number): string {
  return REGION_NAMES[region] || 'Unknown';
}

function getRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const checkTime = new Date(timestamp);
    const diffMs = now.getTime() - checkTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return 'Unknown';
  }
}

function isStale(timestamp: string): boolean {
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    return diffMs > 5 * 60 * 1000;
  } catch {
    return true;
  }
}

export function MonitorAgents() {
  const [agents, setAgents] = useState<MonitorAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMasterInfo, setShowMasterInfo] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await axios.get<MonitorAgent[]>(
          `${import.meta.env.VITE_APP_MONITORING_API_URL}api/Monitor/allMonitorAgents`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setAgents(response.data);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setError('Failed to load monitor agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const totalAgents = agents.length;
  const totalMonitors = agents.reduce((sum, agent) => sum + agent.listTasks, 0);
  const masterAgent = agents.find((agent) => agent.isMaster);
  const activeAgents = agents.filter((agent) => agent.listTasks > 0).length;

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.hostname.toLowerCase().includes(q) ||
        getRegionName(a.monitorRegion).toLowerCase().includes(q) ||
        a.version.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
      return a.hostname.localeCompare(b.hostname);
    });
  }, [filteredAgents]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" text="Loading monitor agents..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Failed to load agents
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800
                      bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Infrastructure
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Monitor agents
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Distributed check runners across regions
            </p>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm
                       bg-gray-50 dark:bg-gray-900
                       border border-gray-200 dark:border-gray-800
                       text-gray-900 dark:text-white
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Total agents</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {totalAgents}
              </span>
              <Server className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>

          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Active monitors</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {totalMonitors}
              </span>
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>

          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Busy agents</div>
            <div className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {activeAgents}
              <span className="text-sm font-medium text-gray-400 ml-1">/ {totalAgents}</span>
            </div>
          </div>

          <div className={cn(panelClass, 'p-3')}>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-1">
              Master agent
              <button
                type="button"
                onClick={() => setShowMasterInfo(true)}
                className="p-0.5 rounded text-amber-600 dark:text-amber-400
                         hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                title="About monitor manager"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            {masterAgent ? (
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {masterAgent.hostname}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {getRegionName(masterAgent.monitorRegion)} · v{masterAgent.version}
                </div>
              </div>
            ) : (
              <div className="text-sm font-medium text-gray-400">None</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={cn(panelClass, 'overflow-hidden')}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Agent list</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {sortedAgents.length} of {totalAgents} shown
              </p>
            </div>
          </div>

          {sortedAgents.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-3">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No agents found</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-900">
                    {['Agent', 'Region', 'Tasks', 'Last seen', 'Version', 'Status'].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide
                                   text-gray-400 dark:text-gray-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => {
                    const busy = agent.listTasks > 0;
                    const stale = isStale(agent.timeStamp);
                    const regionColor = REGION_COLORS[agent.monitorRegion] || 'text-gray-400';

                    return (
                      <tr
                        key={agent.id}
                        className="border-b border-gray-100 dark:border-gray-900 last:border-b-0
                                   hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                                agent.isMaster
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                  : 'bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400'
                              )}
                            >
                              {agent.isMaster ? (
                                <Zap className="w-3.5 h-3.5" />
                              ) : (
                                <Server className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-gray-900 dark:text-white truncate">
                                  {agent.hostname}
                                </span>
                                {agent.isMaster && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                                                  bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400
                                                  ring-1 ring-inset ring-amber-200/60 dark:ring-amber-800/50">
                                    Master
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                                #{agent.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                            <Globe className={cn('w-3.5 h-3.5', regionColor)} />
                            {getRegionName(agent.monitorRegion)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex tabular-nums font-medium',
                              busy
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {agent.listTasks}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs tabular-nums',
                              stale
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                            title={agent.timeStamp}
                          >
                            {getRelativeTime(agent.timeStamp)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                            v{agent.version}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-[11px] font-medium',
                              busy
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : stale
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                busy
                                  ? 'bg-emerald-500'
                                  : stale
                                    ? 'bg-amber-500'
                                    : 'bg-gray-400'
                              )}
                            />
                            {busy ? 'Active' : stale ? 'Stale' : 'Idle'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showMasterInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={cn(panelClass, 'w-full max-w-lg shadow-xl')}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Monitor manager
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterInfo(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-xs">
                Tasks are distributed across agents so monitoring stays reliable when runners scale or fail.
              </p>

              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
                  Example · 600 monitors
                </h4>
                <div className="rounded-md bg-gray-50 dark:bg-gray-900 ring-1 ring-inset ring-gray-200 dark:ring-gray-800 p-3 space-y-1.5">
                  {[
                    { role: 'Master', tasks: 100 },
                    { role: 'Child 1', tasks: 100 },
                    { role: 'Child 2', tasks: 100 },
                    { role: 'Child 3', tasks: 100 },
                    { role: 'Child 4', tasks: 100 },
                    { role: 'Child 5', tasks: 100 },
                  ].map((row) => (
                    <div key={row.role} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{row.role}</span>
                      <span className="tabular-nums font-medium text-gray-900 dark:text-white">
                        {row.tasks} tasks
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    <strong className="text-gray-900 dark:text-white font-medium">Failover —</strong>{' '}
                    if the master goes offline, a child promotes automatically.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  <span>
                    <strong className="text-gray-900 dark:text-white font-medium">Rebalance —</strong>{' '}
                    when a child leaves, remaining agents pick up its checks.
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowMasterInfo(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
