import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { LoadingSpinner } from './ui';
import monitorService from '../services/monitorService';
import {
  BULK_MONITOR_LIMIT,
  bulkMonitorExample,
  parseBulkMonitors,
  type AllowedGroup,
  type ExistingMonitorName,
  type BulkPreviewRow,
  type MonitorKind,
} from '../lib/bulkMonitors';

interface BulkMonitorImportProps {
  groups: AllowedGroup[];
  expanded?: boolean;
  onBack: () => void;
  onApplied: (failed: number) => Promise<void> | void;
}

function failureMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.Message;
      if (typeof message === 'string' && message.trim()) return message;
    }
    if (error.response?.status === 403) return 'Not allowed for this group';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

async function saveRow(row: BulkPreviewRow): Promise<void> {
  if (!row.payload || !row.kind) throw new Error('This row is not ready');
  await monitorService.saveBulkMonitor(row.action, row.kind as MonitorKind, row.payload);
}

export function BulkMonitorImport({ groups, expanded = false, onBack, onApplied }: BulkMonitorImportProps) {
  const [source, setSource] = useState(() => bulkMonitorExample(groups));
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<Record<number, string>>({});
  const [existingNames, setExistingNames] = useState<ExistingMonitorName[] | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
  const dark = document.documentElement.classList.contains('dark')
    || document.documentElement.classList.contains('darcula')
    || document.documentElement.classList.contains('monokai')
    || document.documentElement.classList.contains('github-dark');

  useEffect(() => {
    let cancelled = false;
    monitorService.getMonitorNames()
      .then((names) => {
        if (!cancelled) setExistingNames(names);
      })
      .catch(() => {
        if (!cancelled) setNamesError('Could not check existing monitor names');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = useMemo(
    () => parseBulkMonitors(source, groups, existingNames ?? []),
    [source, groups, existingNames]
  );
  const namesReady = existingNames !== null && !namesError;
  const readyRows = parsed.rows.filter((row) => row.allowed && row.payload);
  const blocked = parsed.rows.length - readyRows.length;
  const extensions = useMemo(
    () => [parsed.format === 'json' ? json() : yaml()],
    [parsed.format]
  );

  const showTemplate = (format: 'yaml' | 'json') => {
    setSource(bulkMonitorExample(groups, format));
    setResults({});
  };

  const formatButtons = (
    <div className="flex shrink-0 border border-gray-300 dark:border-gray-600">
      {(['yaml', 'json'] as const).map((format) => {
        const active = parsed.format === format;
        return (
          <button
            key={format}
            type="button"
            onClick={() => showTemplate(format)}
            className={`hud-label px-3 py-1 ${
              active
                ? 'bg-[#101014] text-[#f2f1ee] dark:bg-[#f2f1ee] dark:text-[#101014]'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {format.toUpperCase()}
          </button>
        );
      })}
    </div>
  );

  const apply = async () => {
    if (!namesReady || readyRows.length === 0 || blocked > 0 || readyRows.length > BULK_MONITOR_LIMIT) return;
    setApplying(true);
    const next: Record<number, string> = {};
    let failed = 0;

    for (const row of readyRows) {
      try {
        await saveRow(row);
        next[row.index] = row.action === 'update' ? 'Updated' : 'Created';
      } catch (error) {
        failed += 1;
        next[row.index] = failureMessage(error);
      }
    }

    setResults(next);
    setApplying(false);

    const saved = readyRows.length - failed;
    if (saved > 0) {
      await onApplied(failed);
      toast.success(`${saved} monitor${saved === 1 ? '' : 's'} saved`, { position: 'bottom-right' });
    }
    if (failed > 0) {
      toast.error(`${failed} monitor${failed === 1 ? '' : 's'} failed`, { position: 'bottom-right' });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Paste JSON or YAML, up to {BULK_MONITOR_LIMIT} monitors. Each name must be unique. <span className="font-mono text-xs">group</span> can be the group name; it is converted to the group id before save. An <span className="font-mono text-xs">id</span> updates that monitor.
          </p>
          {formatButtons}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 overflow-hidden">
          <CodeMirror
            value={source}
            height={expanded ? 'calc(100vh - 22rem)' : '360px'}
            theme={dark ? oneDark : 'light'}
            extensions={extensions}
            onChange={(value) => {
              setSource(value);
              setResults({});
            }}
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </div>

        {namesError && (
          <p className="text-sm text-red-600 dark:text-red-400">{namesError}</p>
        )}

        {parsed.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{parsed.error}</p>
        )}

        {parsed.rows.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Group</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row) => (
                  <tr key={row.index} className="border-t border-gray-200 dark:border-gray-800 align-top">
                    <td className="px-3 py-2 capitalize">{row.action}</td>
                    <td className="px-3 py-2 uppercase">{row.kind ?? '—'}</td>
                    <td className={`px-3 py-2 ${row.issues.some((issue) => issue.toLowerCase().includes('name')) ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {row.name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={row.issues.some((issue) => issue.toLowerCase().includes('group') || issue.includes('access'))
                        ? 'text-red-600 dark:text-red-400'
                        : ''}>
                        {row.groupLabel || '—'}
                        {row.groupId != null && row.allowed ? (
                          <span className="ml-1 text-gray-500">#{row.groupId}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 break-all">{row.target || '—'}</td>
                    <td className="px-3 py-2">
                      {results[row.index] ? (
                        <span className={results[row.index] === 'Created' || results[row.index] === 'Updated'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'}>
                          {results[row.index]}
                        </span>
                      ) : row.issues.length > 0 ? (
                        <span className="text-red-600 dark:text-red-400">{row.issues.join(' · ')}</span>
                      ) : (
                        <span className="text-gray-500">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex-none border-t dark:border-gray-700 p-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Back
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={applying || !namesReady || readyRows.length === 0 || blocked > 0 || Boolean(parsed.error)}
          className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {applying ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : (
            <span>
              {namesError
                ? 'Names unavailable'
                : !namesReady
                  ? 'Checking names'
                  : blocked > 0
                  ? `${blocked} need attention`
                  : `Save ${readyRows.length} monitor${readyRows.length === 1 ? '' : 's'}`}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
