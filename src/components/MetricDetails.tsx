// @ts-expect-error - No type definitions for markdown-it
import MarkdownIt from 'markdown-it';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Monitor, MonitorGroup, MonitorHistoryData, MonitorK8sNode } from '../types';
import { 
  Clock, Activity, CheckCircle, Globe, Network, 
  Pause, Play, Edit, Bell, MessageSquare, Trash2, Copy, Loader2,
  Bot, RefreshCw, Server, Check, X, Shield
} from 'lucide-react';
import { LoadingSpinner } from './ui';
import { cn } from '../lib/utils';
import { getLocalDateFromUTC, formatCompactDate } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import monitorService from '../services/monitorService';
import { AddMonitorModal } from './AddMonitorModal';
import { 
  UpdateMonitorHttpPayload,
  UpdateMonitorTcpPayload 
} from '../services/monitorService';
import { NotificationListModal } from './NotificationListModal';
import { SecurityHeadersModal } from './SecurityHeadersModal';
import { aiService } from '../services/aiService';
import { monitoringHttp } from '../services/httpClient';

// Initialize markdown-it
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
});

interface MetricDetailsProps {
  metric: Monitor | null;
  group?: MonitorGroup;
  onMetricUpdate?: (updatedMetric: Monitor) => void;
}

interface TimePeriod {
  label: string;
  days: number;
}

const TIME_PERIODS: TimePeriod[] = [
  { label: '1 Hour', days: 0 },
  { label: '24 Hours', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 }
];

const panelClass =
  'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950';

const actionBtnClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ' +
  'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 ' +
  'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900';

function uptimeTone(value?: number | null) {
  if (value == null || value === -1) return 'text-gray-400 dark:text-gray-500';
  if (value >= 99.5) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 95) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function uptimeStatusLabel(value?: number | null) {
  if (value == null || value === -1) return 'N/A';
  if (value >= 99.5) return 'Excellent';
  if (value >= 95) return 'Good';
  if (value >= 90) return 'Fair';
  return 'Poor';
}

function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(panelClass, 'p-4 mb-4', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmTone = 'danger',
  loading,
  onCancel,
  onConfirm,
  icon,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone?: 'danger' | 'primary';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn(panelClass, 'w-full max-w-md p-5 shadow-xl')}>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={actionBtnClass} disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors disabled:opacity-50',
              confirmTone === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            )}
          >
            {loading ? <LoadingSpinner size="sm" /> : icon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add MonitorAlert interface
interface MonitorAlert {
  id: number;
  monitorId: number;
  timeStamp: string;
  status: boolean;
  message: string;
  monitorName: string;
  environment: number;
  urlToCheck: string;
  periodOffline: number;
}

const StatusTimeline = ({ historyData, uptimeFromTiles }: { 
  historyData: { status: boolean; timeStamp: string }[]; 
  /** Uptime % from dashboard tiles (e.g. monitorStatusDashboard.uptime1Hr) - preferred over timeline-derived value */
  uptimeFromTiles?: number | null;
}) => {
  const userTimeZone = localStorage.getItem('userTimezone') || 
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Sort chronologically (older to newer) but don't limit the points
  const timelineData = [...historyData]
    .filter(point => {
      try {
        if (!point.timeStamp) {
          console.warn('Found point without timestamp:', point);
          return false;
        }
        // Validate timestamp using our new utility
        return getLocalDateFromUTC(point.timeStamp) !== null;
      } catch (error) {
        console.error('Error validating point in StatusTimeline:', {
          error,
          point
        });
        return false;
      }
    })
    .sort((a, b) => {
      try {
        const dateA = getLocalDateFromUTC(a.timeStamp);
        const dateB = getLocalDateFromUTC(b.timeStamp);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      } catch (error) {
        console.error('Error sorting points in StatusTimeline:', {
          error,
          pointA: a,
          pointB: b
        });
        return 0;
      }
    });

  // Calculate statistics (online/offline counts still from timeline; uptime % from tiles when provided)
  const totalChecks = timelineData.length;
  const onlineChecks = timelineData.filter(p => p.status).length;
  const offlineChecks = totalChecks - onlineChecks;
  const uptimeFromHistory = totalChecks > 0 ? (onlineChecks / totalChecks) * 100 : 0;
  const uptimePercentage = uptimeFromTiles != null && uptimeFromTiles !== -1 ? uptimeFromTiles : uptimeFromHistory;

  return (
    <SectionCard
      title="Status timeline"
      subtitle={userTimeZone}
      actions={
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {onlineChecks} online
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {offlineChecks} offline
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium tabular-nums">
            {uptimePercentage.toFixed(1)}% uptime
          </span>
        </div>
      }
    >
      {timelineData.length === 0 ? (
        <div className="h-10 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          No history points for this period
        </div>
      ) : (
        <div className="h-5 bg-gray-100 dark:bg-gray-900 rounded-md flex gap-px p-px overflow-hidden">
          {timelineData.map((point, index) => {
            try {
              return (
                <div
                  key={index}
                  className="group relative flex-1 min-w-[2px]"
                >
                  <div
                    className={cn(
                      'w-full h-full transition-opacity hover:opacity-80',
                      point.status
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : 'bg-red-500 dark:bg-red-400'
                    )}
                  />
                  
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[9999] pointer-events-none">
                    <div className="bg-gray-950 text-white text-[11px] rounded-md py-2.5 px-3 whitespace-nowrap shadow-lg ring-1 ring-white/10 min-w-[180px]">
                      <div className="font-medium mb-1.5 text-center border-b border-white/10 pb-1.5">
                        {(() => {
                          try {
                            const date = getLocalDateFromUTC(point.timeStamp);
                            return formatCompactDate(date);
                          } catch {
                            return 'Invalid Date';
                          }
                        })()}
                      </div>
                      <div className="space-y-1">
                        <div className={cn(
                          'flex items-center justify-between',
                          point.status ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          <span>Status</span>
                          <span className="inline-flex items-center gap-1 font-medium">
                            {point.status ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {point.status ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Type</span>
                          <span className="text-gray-200">Heartbeat</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <span>When</span>
                          <span className="text-gray-200">
                            {(() => {
                              try {
                                const now = new Date();
                                const checkTime = getLocalDateFromUTC(point.timeStamp);
                                if (!checkTime) return 'Unknown';
                                const diffMs = now.getTime() - checkTime.getTime();
                                const diffMins = Math.floor(diffMs / (1000 * 60));
                                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                if (diffMins < 60) return `${diffMins}m ago`;
                                return `${diffHours}h ago`;
                              } catch {
                                return 'Unknown';
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-950" />
                  </div>
                </div>
              );
            } catch (error) {
              console.error('Error rendering timeline point:', { error, point, index });
              return null;
            }
          })}
        </div>
      )}
      
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2">
        <span>Older</span>
        <span>Now</span>
      </div>
    </SectionCard>
  );
};

// Add or update the getMonitorTypeInfo function
const getMonitorTypeInfo = (typeId: number, isOnline: boolean, isPaused: boolean) => {
  const statusColor = isPaused 
    ? 'text-gray-400 dark:text-gray-500'
    : isOnline 
      ? 'text-emerald-500 dark:text-emerald-400' 
      : 'text-red-500 dark:text-red-400';
  
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className={`w-4 h-4 ${statusColor}`} />,
        label: 'HTTP(S)'
      };
    case 3:
      return {
        icon: <Network className={`w-4 h-4 ${statusColor}`} />,
        label: 'TCP'
      };
    case 4:
      return {
        icon: <Server className={`w-4 h-4 ${statusColor}`} />,
        label: 'Kubernetes'
      };
    default:
      return {
        icon: <Globe className={`w-4 h-4 ${statusColor}`} />,
        label: 'Unknown'
      };
  }
};

// Add the AiResponse component
const AiResponse = ({ group, metric, selectedModel, availableModels, isLoadingModels, onModelChange }: { 
  group?: MonitorGroup; 
  metric?: Monitor | null; 
  selectedModel?: string;
  availableModels?: string[];
  isLoadingModels?: boolean;
  onModelChange?: (model: string) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);

  // Function to fetch alerts data
  const fetchAlerts = async (groupId: number) => {
    try {
      const response = await monitoringHttp.get(`/api/MonitorAlert/monitorAlertsByMonitorGroup/${groupId}/180?environment=6`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Failed to fetch alert history', { position: 'bottom-right' });
    }
  };

  // Fetch alerts when group changes
  useEffect(() => {
    if (group?.id) {
      fetchAlerts(group.id);
    }
  }, [group?.id]);

  const generateAnalysisPrompt = () => {
    if (group) {
      // Get alerts statistics - only consider failed alerts
      const failedAlerts = alerts.filter(a => !a.status);
      const totalFailedAlerts = failedAlerts.length;
      
      // Group failed alerts by monitor to see which monitors are problematic
      const failuresByMonitor = failedAlerts.reduce((acc, alert) => {
        acc[alert.monitorName] = (acc[alert.monitorName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get the top 3 most problematic monitors
      const topProblematicMonitors = Object.entries(failuresByMonitor)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      
      return `Please analyze and generate some bullet points for these monitoring metrics for the group "${group.name}":
- 1 Hour Uptime: ${group.avgUptime1Hr}%
- 24 Hours Uptime: ${group.avgUptime24Hrs}%
- 7 Days Uptime: ${group.avgUptime7Days}%
- 30 Days Uptime: ${group.avgUptime30Days}%
- 3 Months Uptime: ${group.avgUptime3Months}%
- 6 Months Uptime: ${group.avgUptime6Months}%
Total Monitors: ${group.monitors.length}
Online Monitors: ${group.monitors.filter(m => m.status).length}
Offline Monitors: ${group.monitors.filter(m => !m.status).length}

Alert Statistics (Last 180 days):
- Total Failed Alerts: ${totalFailedAlerts}
${topProblematicMonitors.map(([name, count]) => `- ${name}: ${count} failures`).join('\n')}

Please provide a concise analysis of the group's performance and alert history, focusing on:
1. Overall uptime trends
2. The monitors with the most failures
3. Any concerning patterns in the failures
4. Recommendations for improving reliability`;
    }
    
    if (metric) {
      // Filter alerts for this specific monitor - only consider failures
      const failedAlerts = alerts.filter(a => !a.status && a.monitorId === metric.id);
      const totalFailedAlerts = failedAlerts.length;
      
      // Group failures by error message to see patterns
      const failuresByMessage = failedAlerts.reduce((acc, alert) => {
        acc[alert.message] = (acc[alert.message] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get the top 3 most common error messages
      const topErrorMessages = Object.entries(failuresByMessage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      return `Please analyze these monitoring metrics for "${metric.name}" (${metric.monitorTypeId === 1 ? 'HTTP' : 'TCP'} monitor):
- 1 Hour Uptime: ${metric.monitorStatusDashboard.uptime1Hr}%
- 24 Hours Uptime: ${metric.monitorStatusDashboard.uptime24Hrs}%
- 7 Days Uptime: ${metric.monitorStatusDashboard.uptime7Days}%
- 30 Days Uptime: ${metric.monitorStatusDashboard.uptime30Days}%
- 3 Months Uptime: ${metric.monitorStatusDashboard.uptime3Months}%
- 6 Months Uptime: ${metric.monitorStatusDashboard.uptime6Months}%
Current Status: ${metric.status ? 'Online' : 'Offline'}
Current Response Time: ${metric.monitorStatusDashboard.responseTime}ms

Alert Statistics (Last 180 days):
- Total Failed Alerts: ${totalFailedAlerts}
${topErrorMessages.map(([message, count]) => `- ${message}: ${count} occurrences`).join('\n')}

Please provide a concise analysis of the monitor's performance and alert history, focusing on:
1. Overall uptime trends
2. The most common error messages and their frequency
3. Any concerning patterns in the failures
4. Recommendations for improving reliability`;
    }

    return '';
  };

  const startAnalysis = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setMessages('');
      
      if (group || metric) {
        setIsAnalyzing(true);
        const prompt = generateAnalysisPrompt();
        await aiService.chat(prompt, (message) => {
          // Handle both streaming and complete responses
          if (message.output?.content) {
            setMessages(prev => prev + message.output!.content);
          } else if (message.content) {
            // Fallback for different response structure
            setMessages(prev => prev + message.content);
          }
        }, selectedModel || 'o4-mini');
        setHasAnalyzed(true);
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
      setError('Failed to initialize AI conversation');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  // Reset state when group or metric changes
  useEffect(() => {
    setMessages('');
    setError(null);
    setHasAnalyzed(false);
    setIsAnalyzing(false);
    setIsLoading(false);
  }, [group, metric]);

  if (isLoading || isAnalyzing) {
    return (
      <SectionCard title="AI analysis" subtitle="Powered by Abby">
        <div className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 py-4">
          <LoadingSpinner size="sm" />
          {isAnalyzing ? 'Analyzing metrics…' : 'Initializing…'}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="AI analysis"
      subtitle="Powered by Abby"
      actions={
        group ? (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 dark:text-gray-400">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => onModelChange?.(e.target.value)}
              disabled={isLoadingModels}
              className="px-2 py-1 rounded-md text-xs
                       bg-gray-50 dark:bg-gray-900
                       border border-gray-200 dark:border-gray-800
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500/30
                       disabled:opacity-50"
            >
              {isLoadingModels ? (
                <option value="">Loading…</option>
              ) : (
                availableModels?.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : undefined
      }
    >
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : hasAnalyzed ? (
        <div>
          <div 
            className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-md
                       bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       ring-1 ring-inset ring-gray-200 dark:ring-gray-800
                       [&>ul]:mb-3 [&>ul]:mt-1 [&>ul>li]:mb-1 [&>p]:mb-3 [&>h3]:mb-2 [&>h4]:mb-2"
            dangerouslySetInnerHTML={{ __html: md.render(messages) }}
          />
          <button
            onClick={startAnalysis}
            className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                     bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Loader2 className="w-3.5 h-3.5" />
            Analyze again
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Run an AI analysis on uptime trends, failures, and reliability recommendations.
          </p>
          <button
            onClick={startAnalysis}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                     bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            Analyze with Abby
          </button>
        </div>
      )}
    </SectionCard>
  );
};

// Add the KubernetesNodeInfo component
const KubernetesNodeInfo = ({ node }: { node: MonitorK8sNode }) => {
  // Group node status items into categories
  const statusGroups = [
    {
      title: 'Node Status',
      items: [
        { label: 'Ready', status: node.ready, positive: true },
        { label: 'Memory Pressure', status: node.memoryPressure, positive: false },
        { label: 'Disk Pressure', status: node.diskPressure, positive: false },
        { label: 'PID Pressure', status: node.pidPressure, positive: false },
      ]
    },
    {
      title: 'Runtime Issues',
      items: [
        { label: 'Container Runtime', status: node.containerRuntimeProblem, positive: false },
        { label: 'Kernel Deadlock', status: node.kernelDeadlock, positive: false },
        { label: 'Kubelet Problem', status: node.kubeletProblem, positive: false },
      ]
    },
    {
      title: 'Filesystem Issues',
      items: [
        { label: 'Filesystem Corruption', status: node.filesystemCorruptionProblem, positive: false },
        { label: 'Readonly Filesystem', status: node.readonlyFilesystem, positive: false },
      ]
    },
    {
      title: 'Restart Issues',
      items: [
        { label: 'Frequent Kubelet Restart', status: node.frequentKubeletRestart, positive: false },
        { label: 'Frequent Docker Restart', status: node.frequentDockerRestart, positive: false },
        { label: 'Frequent Containerd Restart', status: node.frequentContainerdRestart, positive: false },
      ]
    }
  ];

  return (
    <div className={cn(panelClass, 'p-4 mb-3')}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 truncate">
        {node.nodeName}
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusGroups.map((statusGroup) => (
          <div key={statusGroup.title}>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              {statusGroup.title}
            </h4>
            <div className="space-y-1.5">
              {statusGroup.items.map((item) => {
                const isPositive = item.positive ? item.status : !item.status;
                return (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {item.label}
                    </span>
                    <span className={cn(
                      'shrink-0',
                      isPositive
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    )}>
                      {isPositive ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function MetricDetails({ metric, group, onMetricUpdate }: MetricDetailsProps) {
  // Local state to track the current metric (allows optimistic updates)
  const [currentMetric, setCurrentMetric] = useState<Monitor | null>(metric);
  
  // Sync local state with prop when metric changes
  useEffect(() => {
    setCurrentMetric(metric);
  }, [metric]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSecurityHeaders, setShowSecurityHeaders] = useState(false);
  const [showCloneConfirm, setShowCloneConfirm] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(TIME_PERIODS[1]);
  const [historyData, setHistoryData] = useState<MonitorHistoryData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [k8sDetails, setK8sDetails] = useState<{
    monitorId: number;
    clusterName: string;
    kubeConfig: string;
    lastStatus: boolean;
    monitorK8sNodes: MonitorK8sNode[];
    id: number;
    monitorTypeId: number;
    name: string;
    heartBeatInterval: number;
    retries: number;
    status: boolean;
    daysToExpireCert: number;
    paused: boolean;
    monitorRegion: number;
    monitorEnvironment: number;
    checkCertExpiry: boolean;
    monitorGroup: number;
  } | null>(null);
  const [isLoadingK8s, setIsLoadingK8s] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('o4-mini');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Fetch available models from API
  const fetchModels = async () => {
    if (import.meta.env.VITE_APP_ABBY_ENABLED !== 'true') {
      return;
    }

    try {
      setIsLoadingModels(true);
      const models = await aiService.getModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // Fallback to default models if API fails
      setAvailableModels(['o4-mini']);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load models when component mounts
  useEffect(() => {
    fetchModels();
  }, []);

  // Load history data when metric or period changes
  useEffect(() => {
    if (currentMetric) {
      loadHistoryData(selectedPeriod);
      
      // Load Kubernetes details if this is a Kubernetes monitor
      if (currentMetric.monitorTypeId === 4) {
        loadK8sDetails();
      }
    }
  }, [selectedPeriod, currentMetric?.id]);

  // Add function to load Kubernetes details
  const loadK8sDetails = async () => {
    if (!currentMetric || currentMetric.monitorTypeId !== 4) return;
    
    try {
      setIsLoadingK8s(true);
      const response = await monitoringHttp.get(`/api/Monitor/getMonitorK8sByMonitorId/${currentMetric.id}`);
            
      // Normalize the response data to ensure consistent property names
      const normalizedData = {
        ...response.data,
        monitorId: response.data.monitorId || response.data.MonitorId,
        clusterName: response.data.clusterName || response.data.ClusterName,
        kubeConfig: response.data.kubeConfig || response.data.KubeConfig,
        lastStatus: response.data.lastStatus || response.data.LastStatus,
        monitorK8sNodes: response.data.monitorK8sNodes || [],
        id: response.data.id || response.data.Id,
        monitorTypeId: response.data.monitorTypeId || response.data.MonitorTypeId,
        name: response.data.name || response.data.Name,
        heartBeatInterval: response.data.heartBeatInterval || response.data.HeartBeatInterval,
        retries: response.data.retries || response.data.Retries,
        status: response.data.status || response.data.Status,
        daysToExpireCert: response.data.daysToExpireCert || response.data.DaysToExpireCert,
        paused: response.data.paused || response.data.Paused,
        monitorRegion: response.data.monitorRegion || response.data.MonitorRegion,
        monitorEnvironment: response.data.monitorEnvironment || response.data.MonitorEnvironment,
        checkCertExpiry: response.data.checkCertExpiry || response.data.CheckCertExpiry,
        monitorGroup: response.data.monitorGroup || response.data.MonitorGroup
      };
      
      setK8sDetails(normalizedData);
    } catch (error) {
      console.error('Failed to load Kubernetes details:', error);
      toast.error('Failed to load Kubernetes details', { position: 'bottom-right' });
    } finally {
      setIsLoadingK8s(false);
    }
  };

  const loadHistoryData = async (period: TimePeriod) => {
    if (!currentMetric) return;
    
    try {
      setIsLoadingHistory(true);
      const data = await monitorService.getMonitorHistory(currentMetric.id, period.days);
      // Validate timestamps before setting state
      const validatedData = data.map(item => {
        try {
          // Try to create a Date object to validate the timestamp
          new Date(item.timeStamp);
          return item;
        } catch {
          console.error('Invalid timestamp found:', {
            timestamp: item.timeStamp,
            item
          });
          return null;
        }
      }).filter(Boolean) as MonitorHistoryData[];

      setHistoryData(validatedData);
    } catch (error) {
      console.error('Failed to load history data:', error);
      toast.error('Failed to load history data', { position: 'bottom-right' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Function to refresh all data
  const refreshData = async () => {
    if (!currentMetric) return;
    
    try {
      setIsRefreshing(true);
      // Refresh monitor history data
      await loadHistoryData(selectedPeriod);
      
      // Refresh Kubernetes details if applicable
      if (currentMetric.monitorTypeId === 4) {
        await loadK8sDetails();
      }
      
      // Refresh monitor details
      await monitorService.getDashboardGroups(currentMetric.monitorEnvironment);
      // Force a re-render by updating the URL without redirecting
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      toast.error('Failed to refresh data', { position: 'bottom-right' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    let intervalId: number;

    if (autoRefresh && currentMetric) {
      intervalId = window.setInterval(() => {
        refreshData();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [autoRefresh, currentMetric, selectedPeriod]);

  // Early return for group view
  if (!metric && group) {
    const online = group.monitors.filter(m => m.status && !m.paused).length;
    const offline = group.monitors.filter(m => !m.status && !m.paused).length;
    const paused = group.monitors.filter(m => m.paused).length;

    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
        <div className="sticky top-0 z-10 px-4 lg:px-5 py-3 border-b border-gray-200 dark:border-gray-800
                        bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Monitor group
          </div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
            {group.name}
          </h1>
        </div>

        <div className="p-4 lg:p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {[
              { label: '1 Hour', value: group.avgUptime1Hr },
              { label: '24 Hours', value: group.avgUptime24Hrs },
              { label: '7 Days', value: group.avgUptime7Days },
              { label: '30 Days', value: group.avgUptime30Days },
              { label: '3 Months', value: group.avgUptime3Months },
              { label: '6 Months', value: group.avgUptime6Months }
            ].map((period) => (
              <div key={period.label} className={cn(panelClass, 'p-3')}>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  {period.label}
                </div>
                <div className={cn('text-lg font-semibold tabular-nums', uptimeTone(period.value))}>
                  {!period.value || period.value === -1 ? 'N/A' : `${period.value.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>

          <SectionCard title="Group summary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: group.monitors.length, tone: 'text-gray-900 dark:text-white' },
                { label: 'Online', value: online, tone: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Offline', value: offline, tone: 'text-red-600 dark:text-red-400' },
                { label: 'Paused', value: paused, tone: 'text-gray-500 dark:text-gray-400' },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{stat.label}</div>
                  <div className={cn('text-xl font-semibold tabular-nums', stat.tone)}>{stat.value}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {import.meta.env.VITE_APP_ABBY_ENABLED === 'true' && (
            <AiResponse 
              group={group} 
              metric={null} 
              selectedModel={selectedModel} 
              availableModels={availableModels}
              isLoadingModels={isLoadingModels}
              onModelChange={setSelectedModel}
            />
          )}
        </div>
      </div>
    );
  }

  // Return early if no metric and no group
  if (!currentMetric) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full
                          bg-gray-100 dark:bg-gray-900
                          ring-1 ring-inset ring-gray-200 dark:ring-gray-800
                          flex items-center justify-center">
            <Activity className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Select a monitor
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Choose a group or monitor from the list to inspect uptime, history, and health.
          </p>
        </div>
      </div>
    );
  }

  // Add delete handler
  const handleDelete = async () => {
    if (!currentMetric) return;
    
    setIsDeleting(true);
    try {
      const success = await monitorService.deleteMonitor(currentMetric.id);
      if (success) {
        toast.success('Monitor deleted successfully', { position: 'bottom-right' });
        // Refresh dashboard data with current environment
        await monitorService.getDashboardGroups(currentMetric.monitorEnvironment);
        // Force a full page refresh to update all data
        window.location.href = '/dashboard';
      } else {
        toast.error('Failed to delete monitor', { position: 'bottom-right' });
      }
    } catch {
      toast.error('Failed to delete monitor', { position: 'bottom-right' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Add pause handler
  const handlePauseToggle = async () => {
    if (!currentMetric) return;
    
    setIsPauseLoading(true);
    const originalMetric = currentMetric; // Store original for rollback
    const newPausedState = !currentMetric.paused;
    
    // Optimistically update the UI
    const updatedMetric = { ...currentMetric, paused: newPausedState };
    setCurrentMetric(updatedMetric);
    onMetricUpdate?.(updatedMetric);
    
    try {
      const success = await monitorService.toggleMonitorPause(originalMetric.id, newPausedState);
      if (success) {
        toast.success(`Monitor ${originalMetric.paused ? 'resumed' : 'paused'} successfully`, { position: 'bottom-right' });
        // Optionally refresh monitor data to ensure consistency (without full page reload)
        // The optimistic update already shows the change, so this is just for data consistency
        try {
          const refreshedGroups = await monitorService.getDashboardGroups(originalMetric.monitorEnvironment);
          // Find the updated monitor in the refreshed data
          const refreshedGroup = refreshedGroups.find(g => 
            g.monitors.some(m => m.id === originalMetric.id)
          );
          if (refreshedGroup) {
            const refreshedMonitor = refreshedGroup.monitors.find(m => m.id === originalMetric.id);
            if (refreshedMonitor) {
              setCurrentMetric(refreshedMonitor);
              onMetricUpdate?.(refreshedMonitor);
            }
          }
        } catch (refreshError) {
          console.error('Failed to refresh monitor data:', refreshError);
          // Don't show error to user since the operation succeeded
        }
      } else {
        // Revert optimistic update on failure
        setCurrentMetric(originalMetric);
        onMetricUpdate?.(originalMetric);
        toast.error(`Failed to ${originalMetric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
      }
    } catch {
      // Revert optimistic update on error
      setCurrentMetric(originalMetric);
      onMetricUpdate?.(originalMetric);
      toast.error(`Failed to ${originalMetric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
    } finally {
      setIsPauseLoading(false);
    }
  };

  // Add handler for edit button
  const handleEditClick = async () => {
    if (!currentMetric) return;
    
    try {
      let monitorData: Monitor;
            
      if (currentMetric.monitorTypeId === 3) {
        const tcpDetails = await monitorService.getMonitorTcpDetails(currentMetric.id);
        monitorData = {
          ...tcpDetails,
          monitorTcp: {
            IP: tcpDetails.ip,
            port: tcpDetails.port
          },
          urlToCheck: '',  // Required by Monitor type but not used for TCP
          monitorStatusDashboard: currentMetric.monitorStatusDashboard
        };
      } else if (currentMetric.monitorTypeId === 4) {
        // Fetch Kubernetes monitor details
        const k8sDetails = await monitorService.getMonitorK8sDetails(currentMetric.id);
        monitorData = {
          ...currentMetric,
          monitorTypeId: 4,
          monitorK8s: {
            clusterName: k8sDetails.ClusterName,
            kubeConfig: k8sDetails.KubeConfig,
            monitorK8sNodes: k8sDetails.monitorK8sNodes
          }
        };
      } else {
        // Fetch HTTP monitor details
        const httpDetails = await monitorService.getMonitorHttpDetails(currentMetric.id);
        monitorData = {
          ...httpDetails,
          monitorHttp: {
            ignoreTlsSsl: httpDetails.ignoreTlsSsl,
            maxRedirects: httpDetails.maxRedirects,
            responseStatusCode: httpDetails.responseStatusCode,
            timeout: httpDetails.timeout,
            monitorHttpMethod: httpDetails.monitorHttpMethod,
            body: httpDetails.body
          },
          urlToCheck: httpDetails.urlToCheck,
          monitorStatusDashboard: currentMetric.monitorStatusDashboard,
          // Include HTTP response code fields for editing
          httpResponseCodeFrom: httpDetails.httpResponseCodeFrom,
          httpResponseCodeTo: httpDetails.httpResponseCodeTo
        };
      }
            
      setMonitorToEdit(monitorData);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to fetch monitor details:', error);
      toast.error('Failed to load monitor details', { position: 'bottom-right' });
    }
  };

  // Add clone handler
  const handleClone = async () => {
    if (!currentMetric) return;
    
    setIsCloning(true);
    try {
      await monitorService.cloneMonitor(currentMetric.id);
      toast.success('Monitor cloned successfully', { position: 'bottom-right' });
      window.location.reload();
    } catch (error) {
      console.error('Failed to clone monitor:', error);
      toast.error('Failed to clone monitor', { position: 'bottom-right' });
    } finally {
      setIsCloning(false);
      setShowCloneConfirm(false);
    }
  };

  // Add this function before the return statement
  const getOfflinePeriods = (data: MonitorHistoryData[]) => {
    const periods: { start: string; end: string; }[] = [];
    let currentPeriod: { start: string; end: string; } | null = null;

    data.forEach((point, index) => {
      try {
        if (point.responseTime === 0 && !currentPeriod) {
          currentPeriod = { start: point.timeStamp, end: point.timeStamp };
        } else if (point.responseTime === 0 && currentPeriod) {
          currentPeriod.end = point.timeStamp;
        } else if (point.responseTime !== 0 && currentPeriod) {
          periods.push(currentPeriod);
          currentPeriod = null;
        }
      } catch (error) {
        console.error('Error processing point in getOfflinePeriods:', {
          error,
          point,
          index,
          currentPeriod
        });
      }
    });

    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    return periods;
  };

  // Add this before the return statement, after the getOfflinePeriods function
  const renderK8sNodes = () => {
    if (!k8sDetails || !k8sDetails.monitorK8sNodes || k8sDetails.monitorK8sNodes.length === 0) {
      return (
        <SectionCard title="Kubernetes nodes">
          <p className="text-xs text-gray-500 dark:text-gray-400 py-2">No Kubernetes nodes found</p>
        </SectionCard>
      );
    }

    return (
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2 mb-2 px-0.5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Kubernetes nodes
          </h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {k8sDetails.clusterName}
          </span>
        </div>
        {k8sDetails.monitorK8sNodes.map((node: MonitorK8sNode, index: number) => (
          <KubernetesNodeInfo key={index} node={node} />
        ))}
      </div>
    );
  };

  const typeInfo = getMonitorTypeInfo(
    currentMetric.monitorTypeId,
    currentMetric.status,
    currentMetric.paused
  );

  const statusLabel = currentMetric.paused
    ? 'Paused'
    : currentMetric.status
      ? 'Online'
      : 'Offline';

  const statusTone = currentMetric.paused
    ? 'text-gray-500 dark:text-gray-400'
    : currentMetric.status
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  const statusDot = currentMetric.paused
    ? 'bg-gray-400'
    : currentMetric.status
      ? 'bg-emerald-500'
      : 'bg-red-500';

  const targetLabel =
    currentMetric.monitorTypeId === 3
      ? `${currentMetric.monitorTcp?.IP}:${currentMetric.monitorTcp?.port}`
      : currentMetric.monitorTypeId === 4
        ? (k8sDetails?.clusterName || currentMetric.monitorK8s?.clusterName || 'No cluster specified')
        : (currentMetric.urlToCheck || 'No URL specified');

  const TargetIcon =
    currentMetric.monitorTypeId === 3
      ? Network
      : currentMetric.monitorTypeId === 4
        ? Server
        : Globe;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800
                      bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-5 pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-medium',
                  statusTone
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', statusDot, currentMetric.status && !currentMetric.paused && 'animate-pulse')} />
                  {statusLabel}
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {typeInfo.label}
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  every {currentMetric.heartBeatInterval}m
                </span>
              </div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight truncate">
                {currentMetric.name}
              </h1>
              <div className="mt-1 flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400">
                <TargetIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{targetLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-5 pb-3 flex flex-wrap gap-1.5">
          <button onClick={handlePauseToggle} disabled={isPauseLoading} className={actionBtnClass}>
            {isPauseLoading ? (
              <LoadingSpinner size="sm" />
            ) : currentMetric.paused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            {isPauseLoading ? 'Working…' : currentMetric.paused ? 'Resume' : 'Pause'}
          </button>

          <button onClick={handleEditClick} className={actionBtnClass}>
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>

          <Link
            to={`/monitor/${currentMetric.id}/alerts`}
            className={cn(
              actionBtnClass,
              'border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400',
              'hover:bg-amber-50 dark:hover:bg-amber-950/30'
            )}
          >
            <Bell className="w-3.5 h-3.5" />
            Alerts
          </Link>

          <button onClick={() => setShowNotifications(true)} className={actionBtnClass}>
            <MessageSquare className="w-3.5 h-3.5" />
            Notifications
          </button>

          {currentMetric.monitorTypeId === 1 && (
            <button onClick={() => setShowSecurityHeaders(true)} className={cn(actionBtnClass, 'relative')}>
              <Shield className="w-3.5 h-3.5" />
              Headers
              <span className="ml-0.5 px-1 py-px text-[9px] font-semibold uppercase tracking-wide
                              bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 rounded">
                Beta
              </span>
            </button>
          )}

          <button onClick={() => setShowCloneConfirm(true)} className={actionBtnClass}>
            <Copy className="w-3.5 h-3.5" />
            Clone
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={cn(
              actionBtnClass,
              'border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400',
              'hover:bg-red-50 dark:hover:bg-red-950/30'
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-0.5 self-center hidden sm:block" />

          <button onClick={refreshData} disabled={isRefreshing} className={actionBtnClass}>
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              actionBtnClass,
              autoRefresh &&
                'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-500 hover:border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600 dark:text-white dark:hover:bg-emerald-500'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Auto {autoRefresh ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="p-4 lg:p-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Status</div>
            <div className={cn('text-lg font-semibold', statusTone)}>{statusLabel}</div>
          </div>
          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Type</div>
            <div className="flex items-center gap-1.5 text-lg font-semibold text-gray-900 dark:text-white">
              {typeInfo.icon}
              <span>{typeInfo.label}</span>
            </div>
          </div>
          <div className={cn(panelClass, 'p-3')}>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Response time</div>
            <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
              {currentMetric.monitorStatusDashboard.responseTime.toFixed(0)}
              <span className="text-sm font-medium text-gray-400 ml-0.5">ms</span>
            </div>
          </div>
          {currentMetric.checkCertExpiry ? (
            <div className={cn(panelClass, 'p-3')}>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">SSL certificate</div>
              <div className={cn(
                'text-lg font-semibold tabular-nums',
                currentMetric.daysToExpireCert <= 0
                  ? 'text-red-600 dark:text-red-400'
                  : currentMetric.daysToExpireCert <= 30
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              )}>
                {currentMetric.daysToExpireCert}
                <span className="text-sm font-medium text-gray-400 ml-0.5">days</span>
              </div>
            </div>
          ) : (
            <div className={cn(panelClass, 'p-3')}>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Retries</div>
              <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                {currentMetric.retries}
              </div>
            </div>
          )}
        </div>

        {/* Uptime period selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {TIME_PERIODS.map((period) => {
            const uptimeValue =
              period.label === '1 Hour'
                ? currentMetric.monitorStatusDashboard.uptime1Hr
                : period.label === '24 Hours'
                  ? currentMetric.monitorStatusDashboard.uptime24Hrs
                  : period.label === '7 Days'
                    ? currentMetric.monitorStatusDashboard.uptime7Days
                    : period.label === '30 Days'
                      ? currentMetric.monitorStatusDashboard.uptime30Days
                      : period.label === '3 Months'
                        ? currentMetric.monitorStatusDashboard.uptime3Months
                        : currentMetric.monitorStatusDashboard.uptime6Months;

            const isSelected = selectedPeriod === period;
            const hasNoData = !uptimeValue || uptimeValue === -1;

            return (
              <button
                key={period.label}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'text-left p-2.5 rounded-lg border transition-colors',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700'
                )}
              >
                <div className={cn(
                  'text-[11px] font-medium mb-0.5',
                  isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {period.label}
                </div>
                <div className={cn('text-base font-semibold tabular-nums', uptimeTone(uptimeValue))}>
                  {hasNoData ? 'N/A' : `${uptimeValue.toFixed(2)}%`}
                </div>
                <div className={cn('text-[10px] mt-0.5', uptimeTone(uptimeValue))}>
                  {uptimeStatusLabel(uptimeValue)}
                </div>
              </button>
            );
          })}
        </div>

        <StatusTimeline
          historyData={historyData}
          uptimeFromTiles={
            selectedPeriod.label === '1 Hour' ? currentMetric.monitorStatusDashboard.uptime1Hr
            : selectedPeriod.label === '24 Hours' ? currentMetric.monitorStatusDashboard.uptime24Hrs
            : selectedPeriod.label === '7 Days' ? currentMetric.monitorStatusDashboard.uptime7Days
            : selectedPeriod.label === '30 Days' ? currentMetric.monitorStatusDashboard.uptime30Days
            : selectedPeriod.label === '3 Months' ? currentMetric.monitorStatusDashboard.uptime3Months
            : currentMetric.monitorStatusDashboard.uptime6Months
          }
        />

        {currentMetric.monitorTypeId === 1 && (
          <SectionCard
            title="Response time"
            subtitle={`${selectedPeriod.label} history`}
            actions={
              isLoadingHistory ? (
                <span className="text-[11px] text-gray-400">Loading…</span>
              ) : undefined
            }
          >
            <div className="h-56 relative">
              {isLoadingHistory && (
                <div className="absolute inset-0 bg-white/50 dark:bg-gray-950/50 flex items-center justify-center z-10 rounded-md">
                  <LoadingSpinner size="lg" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...historyData].sort((a, b) => {
                    try {
                      return new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime();
                    } catch {
                      return 0;
                    }
                  })}
                >
                  {getOfflinePeriods(historyData).map((period, index) => (
                    <ReferenceArea
                      key={index}
                      x1={period.start}
                      x2={period.end}
                      fill="#EF444440"
                    />
                  ))}
                  <XAxis
                    dataKey="timeStamp"
                    tickFormatter={(time) => {
                      try {
                        const date = getLocalDateFromUTC(time);
                        return formatCompactDate(date);
                      } catch {
                        return 'Invalid';
                      }
                    }}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    labelFormatter={(label) => {
                      try {
                        const date = getLocalDateFromUTC(label as string);
                        return formatCompactDate(date);
                      } catch {
                        return 'Invalid Date';
                      }
                    }}
                    formatter={(value) => {
                      if (value === 0) {
                        return [<span style={{ color: '#EF4444' }}>Offline</span>, 'Status'];
                      }
                      return [`${value}ms`, 'Response'];
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #111827)',
                      border: '1px solid var(--tooltip-border, #374151)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--tooltip-text, #F9FAFB)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="responseTime"
                    stroke="#3B82F6"
                    strokeWidth={1.75}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {currentMetric.monitorTypeId === 4 && (
          <div className="relative">
            {isLoadingK8s ? (
              <SectionCard title="Kubernetes nodes">
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" text="Loading Kubernetes data..." />
                </div>
              </SectionCard>
            ) : (
              renderK8sNodes()
            )}
          </div>
        )}

        {group && !metric && import.meta.env.VITE_APP_ABBY_ENABLED === 'true' && (
          <AiResponse
            group={group}
            metric={null}
            selectedModel={selectedModel}
            availableModels={availableModels}
            isLoadingModels={isLoadingModels}
            onModelChange={setSelectedModel}
          />
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete monitor"
          message={`Are you sure you want to delete "${currentMetric.name}"? This action cannot be undone.`}
          confirmLabel={isDeleting ? 'Deleting…' : 'Delete monitor'}
          confirmTone="danger"
          loading={isDeleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          icon={<Trash2 className="w-3.5 h-3.5" />}
        />
      )}

      {showEditModal && (
        <AddMonitorModal
          onClose={() => setShowEditModal(false)}
          onAdd={async () => {}}
          onUpdate={async (updatedMonitor) => {
            if (!currentMetric) return;
            
            try {
              updatedMonitor.id = currentMetric.id;
              updatedMonitor.monitorId = currentMetric.id;
              const success = currentMetric.monitorTypeId === 3
                ? await monitorService.updateMonitorTcp(updatedMonitor as UpdateMonitorTcpPayload)
                : await monitorService.updateMonitorHttp(updatedMonitor as UpdateMonitorHttpPayload);
              
              if (success) {
                toast.success('Monitor updated successfully', { position: 'bottom-right' });
                setShowEditModal(false);
                
                try {
                  const refreshedGroups = await monitorService.getDashboardGroups(currentMetric.monitorEnvironment);
                  const refreshedGroup = refreshedGroups.find(g => 
                    g.monitors.some(m => m.id === currentMetric.id)
                  );
                  if (refreshedGroup) {
                    let refreshedMonitor = refreshedGroup.monitors.find(m => m.id === currentMetric.id);
                    if (refreshedMonitor) {
                      if (refreshedMonitor.monitorTypeId === 3) {
                        const tcpDetails = await monitorService.getMonitorTcpDetails(refreshedMonitor.id);
                        refreshedMonitor = {
                          ...refreshedMonitor,
                          monitorTcp: {
                            IP: tcpDetails.ip,
                            port: tcpDetails.port
                          }
                        };
                      } else if (refreshedMonitor.monitorTypeId === 4) {
                        const k8sDetailsRefresh = await monitorService.getMonitorK8sDetails(refreshedMonitor.id);
                        refreshedMonitor = {
                          ...refreshedMonitor,
                          monitorK8s: {
                            clusterName: k8sDetailsRefresh.ClusterName,
                            kubeConfig: k8sDetailsRefresh.KubeConfig,
                            monitorK8sNodes: k8sDetailsRefresh.monitorK8sNodes
                          }
                        };
                      } else {
                        const httpDetails = await monitorService.getMonitorHttpDetails(refreshedMonitor.id);
                        refreshedMonitor = {
                          ...refreshedMonitor,
                          monitorHttp: {
                            ignoreTlsSsl: httpDetails.ignoreTlsSsl,
                            maxRedirects: httpDetails.maxRedirects,
                            responseStatusCode: httpDetails.responseStatusCode,
                            timeout: httpDetails.timeout,
                            monitorHttpMethod: httpDetails.monitorHttpMethod,
                            body: httpDetails.body
                          },
                          urlToCheck: httpDetails.urlToCheck,
                          httpResponseCodeFrom: httpDetails.httpResponseCodeFrom,
                          httpResponseCodeTo: httpDetails.httpResponseCodeTo
                        };
                      }
                      
                      setCurrentMetric(refreshedMonitor);
                      onMetricUpdate?.(refreshedMonitor);
                    }
                  }
                } catch (refreshError) {
                  console.error('Failed to refresh monitor data:', refreshError);
                  const updatedMetric = {
                    ...currentMetric,
                    ...updatedMonitor,
                    id: currentMetric.id,
                    monitorId: currentMetric.id
                  };
                  setCurrentMetric(updatedMetric as Monitor);
                  onMetricUpdate?.(updatedMetric as Monitor);
                }
              }
            } catch (error) {
              console.error('Failed to update monitor:', error);
              toast.error('Failed to update monitor', { position: 'bottom-right' });
            }
          }}
          existingMonitor={monitorToEdit || currentMetric}
          isEditing={true}
        />
      )}

      {showNotifications && (
        <NotificationListModal
          monitorId={currentMetric.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showSecurityHeaders && currentMetric && (
        <SecurityHeadersModal
          monitorId={currentMetric.id}
          monitorName={currentMetric.name}
          onClose={() => setShowSecurityHeaders(false)}
          onEditMonitor={() => {
            setShowSecurityHeaders(false);
            setShowEditModal(true);
            setMonitorToEdit(currentMetric);
          }}
        />
      )}

      {showCloneConfirm && (
        <ConfirmDialog
          title="Clone monitor"
          message={`Clone "${currentMetric.name}" as "${currentMetric.name}_Clone"?`}
          confirmLabel={isCloning ? 'Cloning…' : 'Clone monitor'}
          confirmTone="primary"
          loading={isCloning}
          onCancel={() => setShowCloneConfirm(false)}
          onConfirm={handleClone}
          icon={<Copy className="w-3.5 h-3.5" />}
        />
      )}
    </div>
  );
}