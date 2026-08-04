import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { MetricDetails } from '../components/MetricDetails';
import { LoadingSpinner } from '../components/ui';
import monitorService from '../services/monitorService';
import { Monitor } from '../types';

const getStoredEnvironment = (): number => {
  try {
    const stored = localStorage.getItem('selectedEnvironment');
    return stored ? parseInt(stored, 10) : 6;
  } catch {
    return 6;
  }
};

async function findMonitorById(monitorId: number): Promise<Monitor | null> {
  const primaryEnv = getStoredEnvironment();
  const environments = Array.from(new Set([primaryEnv, 6, 1, 2, 3, 4, 5]));

  for (const env of environments) {
    try {
      const groups = await monitorService.getDashboardGroups(env);
      for (const group of groups) {
        const match = group.monitors.find((m) => m.id === monitorId);
        if (match) return match;
      }
    } catch {
      // try next environment
    }
  }

  return null;
}

export function MonitorDetails() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const [monitor, setMonitor] = React.useState<Monitor | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!monitorId) {
        setError('Missing monitor id');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await findMonitorById(parseInt(monitorId, 10));
        if (!cancelled) {
          if (data) {
            setMonitor(data);
          } else {
            setError('Monitor not found');
            setMonitor(null);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Failed to load monitor details');
          setMonitor(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
        <DetailsChrome monitorId={monitorId} title="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading monitor details..." />
        </div>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
        <DetailsChrome monitorId={monitorId} title="Monitor unavailable" />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/40
                            flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {error || 'Monitor not found'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
              This monitor may have been removed or you may not have access.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                       bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <DetailsChrome monitorId={monitorId} title={monitor.name} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <MetricDetails
          metric={monitor}
          onMetricUpdate={(updatedMonitor) => {
            setMonitor(updatedMonitor);
          }}
        />
      </div>
    </div>
  );
}

function DetailsChrome({
  monitorId,
  title,
}: {
  monitorId?: string;
  title: string;
}) {
  return (
    <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-gray-200 dark:border-gray-800
                    bg-white dark:bg-gray-950 flex items-center gap-3">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                 text-gray-600 dark:text-gray-300
                 hover:bg-gray-100 dark:hover:bg-gray-900
                 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Dashboard
      </Link>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-800" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Monitor {monitorId ? `#${monitorId}` : ''}
        </div>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {title}
        </h1>
      </div>
    </div>
  );
}
