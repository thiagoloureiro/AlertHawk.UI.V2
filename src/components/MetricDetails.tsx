// @ts-expect-error - No type definitions for markdown-it
import MarkdownIt from 'markdown-it';

import { useState, useEffect } from 'react';
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
import { useSignalRContext } from '../contexts/SignalRContext';
import monitorService from '../services/monitorService';
import { AddMonitorModal } from './AddMonitorModal';
import { 
  UpdateMonitorHttpPayload,
  UpdateMonitorTcpPayload 
} from '../services/monitorService';
import { NotificationListModal } from './NotificationListModal';
import { SecurityHeadersModal } from './SecurityHeadersModal';
import { aiService, msalInstance } from '../services/aiService';
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

const StatusTimeline = ({ historyData }: { historyData: { status: boolean; timeStamp: string }[] }) => {
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

  // Calculate statistics
  const totalChecks = timelineData.length;
  const onlineChecks = timelineData.filter(p => p.status).length;
  const offlineChecks = totalChecks - onlineChecks;
  const uptimePercentage = totalChecks > 0 ? (onlineChecks / totalChecks) * 100 : 0;

  return (
    <div className="dark:bg-gray-800 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold dark:text-white text-gray-900">Status Timeline</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{userTimeZone}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">{onlineChecks} online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">{offlineChecks} offline</span>
          </div>
          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {uptimePercentage.toFixed(1)}% uptime
            </span>
          </div>
        </div>
      </div>
      
      <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex gap-px p-px">
        {timelineData.map((point, index) => {
          try {
            return (
              <div
                key={index}
                className="group relative flex-1 min-w-[2px]"
              >
                <div
                  className={cn(
                    "w-full h-full rounded-sm transition-all duration-200 hover:scale-y-110",
                    point.status
                      ? "bg-green-500 dark:bg-green-400 hover:bg-green-600 dark:hover:bg-green-300"
                      : "bg-red-500 dark:bg-red-400 hover:bg-red-600 dark:hover:bg-red-300"
                  )}
                />
                
                {/* Enhanced Tooltip with Details */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[9999] pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-3 px-4 whitespace-nowrap shadow-lg border border-gray-700 min-w-[200px]">
                    <div className="font-medium mb-2 text-center border-b border-gray-700 pb-2">
                      {(() => {
                        try {
                          const date = getLocalDateFromUTC(point.timeStamp);
                          return formatCompactDate(date);
                        } catch (error) {
                          console.error('Error formatting date:', error);
                          return 'Invalid Date';
                        }
                      })()}
                    </div>
                    
                    <div className="space-y-2">
                      {/* Status */}
                      <div className={`flex items-center justify-between ${
                        point.status ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <span className="font-medium">Status:</span>
                        <div className="flex items-center gap-2">
                          {point.status ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          <span>{point.status ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                      
                      {/* Response Time */}
                      <div className="flex items-center justify-between text-gray-300">
                        <span>Response Time:</span>
                        <span className="font-medium">
                          {point.status ? 'Available' : 'N/A'}
                        </span>
                      </div>
                      
                      {/* Check Type */}
                      <div className="flex items-center justify-between text-gray-300">
                        <span>Check Type:</span>
                        <span className="font-medium">Heartbeat</span>
                      </div>
                      
                      {/* Time Ago */}
                      <div className="flex items-center justify-between text-gray-300">
                        <span>Time Ago:</span>
                        <span className="font-medium">
                          {(() => {
                            try {
                              const now = new Date();
                              const checkTime = getLocalDateFromUTC(point.timeStamp);
                              if (!checkTime) return 'Unknown';
                              
                              const diffMs = now.getTime() - checkTime.getTime();
                              const diffMins = Math.floor(diffMs / (1000 * 60));
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              
                              if (diffMins < 60) {
                                return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
                              } else {
                                return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                              }
                            } catch (error) {
                              return 'Unknown';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            );
          } catch (error) {
            console.error('Error rendering timeline point:', {
              error,
              point,
              index
            });
            return null;
          }
        })}
      </div>
      
      {/* Timeline labels */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-3">
        <span>1 hour ago</span>
        <span>Now</span>
      </div>
    </div>
  );
};

// Add or update the getMonitorTypeInfo function
const getMonitorTypeInfo = (typeId: number, isOnline: boolean, isPaused: boolean) => {
  const statusColor = isPaused 
    ? 'text-gray-400 dark:text-gray-500'
    : isOnline 
      ? 'text-green-500 dark:text-green-400' 
      : 'text-red-500 dark:text-red-400';
  
  switch (typeId) {
    case 1:
      return {
        icon: <Globe className={`w-5 h-5 ${statusColor}`} />,
        label: 'HTTP(S)'
      };
    case 3:
      return {
        icon: <Network className={`w-5 h-5 ${statusColor}`} />,
        label: 'TCP'
      };
    case 4:
      return {
        icon: <Server className={`w-5 h-5 ${statusColor}`} />,
        label: 'Kubernetes'
      };
    default:
      return {
        icon: <Globe className={`w-5 h-5 ${statusColor}`} />,
        label: 'Unknown'
      };
  }
};

// Add the AiResponse component
const AiResponse = ({ group, metric }: { group?: MonitorGroup; metric?: Monitor | null }) => {
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
      
      const response = await aiService.getNewConversationId();
      if (!response?.conversation_id) {
        throw new Error('Failed to get conversation ID');
      }
      
      if (group || metric) {
        setIsAnalyzing(true);
        const prompt = generateAnalysisPrompt();
        await aiService.chat(response.conversation_id, prompt, (message) => {
          if (message.output.type === 'text') {
            setMessages(prev => prev + message.output.content);
          }
        });
        setHasAnalyzed(true);

        // Delete the conversation after receiving the response
        try {
          await aiService.deleteConversation(response.conversation_id);
        } catch (deleteError) {
          console.error('Failed to delete conversation:', deleteError);
        }
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
      if (error instanceof Error && error.message.includes('Please sign in first')) {
        setError('Please sign in to use AI features');
        try {
          await msalInstance.loginRedirect();
        } catch (loginError) {
          console.error('Failed to initiate login:', loginError);
        }
      } else {
        setError('Failed to initialize AI conversation');
      }
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
      <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6">
        <h2 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">
          AI Analysis - Powered by Abby
        </h2>
        <div className="flex items-center gap-3 text-sm dark:text-gray-400 text-gray-600">
          <LoadingSpinner size="sm" />
          {isAnalyzing ? 'Analyzing metrics...' : 'Initializing...'}
        </div>
      </div>
    );
  }

  return (
    <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6">
      <h2 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">
        AI Analysis - Powered by Abby
      </h2>
      {error ? (
        <div className="text-center dark:text-gray-400 text-gray-600">
          {error}
        </div>
      ) : hasAnalyzed ? (
        <div>
          <div 
            className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg dark:bg-gray-700 bg-gray-100 dark:text-white text-gray-900 [&>ul]:mb-4 [&>ul]:mt-2 [&>ul>li]:mb-1 [&>p]:mb-4 [&>h3]:mb-2 [&>h4]:mb-2"
            dangerouslySetInnerHTML={{ __html: md.render(messages) }}
          />
          <button
            onClick={startAnalysis}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4" />
            Analyze Again
          </button>
        </div>
      ) : (
        <div className="text-center">
          <button
            onClick={startAnalysis}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-2 mx-auto"
          >
            <Bot className="w-4 h-4" />
            Analyze with Abby
          </button>
        </div>
      )}
    </div>
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
    <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
      <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">
        Node: {node.nodeName}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statusGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <h4 className="text-md font-medium dark:text-gray-300 text-gray-700">
              {group.title}
            </h4>
            <div className="space-y-2">
              {group.items.map((item) => {
                const isPositive = item.positive ? item.status : !item.status;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm dark:text-gray-400 text-gray-600">
                      {item.label}
                    </span>
                    <div className={`flex items-center ${
                      isPositive 
                        ? 'text-green-500 dark:text-green-400' 
                        : 'text-red-500 dark:text-red-400'
                    }`}>
                      {isPositive ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </div>
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

export function MetricDetails({ metric, group }: MetricDetailsProps) {
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
  const { joinMonitorGroup, leaveMonitorGroup, isConnected } = useSignalRContext();
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

  // Load history data when metric or period changes
  useEffect(() => {
    if (metric) {
      loadHistoryData(selectedPeriod);
      
      // Load Kubernetes details if this is a Kubernetes monitor
      if (metric.monitorTypeId === 4) {
        loadK8sDetails();
      }
    }
  }, [selectedPeriod, metric?.id]);

  // Join/leave monitor group for real-time notifications
  useEffect(() => {
    if (isConnected && metric) {
      joinMonitorGroup(metric.id);
      
      return () => {
        leaveMonitorGroup(metric.id);
      };
    }
  }, [isConnected, metric, joinMonitorGroup, leaveMonitorGroup]);

  // Add function to load Kubernetes details
  const loadK8sDetails = async () => {
    if (!metric || metric.monitorTypeId !== 4) return;
    
    try {
      setIsLoadingK8s(true);
      const response = await monitoringHttp.get(`/api/Monitor/getMonitorK8sByMonitorId/${metric.id}`);
      console.log('Kubernetes details:', response.data);
      console.log('Cluster name from API:', response.data.clusterName || response.data.ClusterName);
      
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
    if (!metric) return;
    
    try {
      setIsLoadingHistory(true);
      const data = await monitorService.getMonitorHistory(metric.id, period.days);
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
    if (!metric) return;
    
    try {
      setIsRefreshing(true);
      // Refresh monitor history data
      await loadHistoryData(selectedPeriod);
      
      // Refresh Kubernetes details if applicable
      if (metric.monitorTypeId === 4) {
        await loadK8sDetails();
      }
      
      // Refresh monitor details
      await monitorService.getDashboardGroups(metric.monitorEnvironment);
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

    if (autoRefresh && metric) {
      intervalId = window.setInterval(() => {
        refreshData();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [autoRefresh, metric, selectedPeriod]);

  // Early return for group view
  if (!metric && group) {
    return (
      <div className="h-full p-6 overflow-y-auto dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
        {/* Group Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">{group.name}</h1>
          </div>
        </div>

        {/* Group Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: '1 Hour', value: group.avgUptime1Hr },
            { label: '24 Hours', value: group.avgUptime24Hrs },
            { label: '7 Days', value: group.avgUptime7Days },
            { label: '30 Days', value: group.avgUptime30Days },
            { label: '3 Months', value: group.avgUptime3Months },
            { label: '6 Months', value: group.avgUptime6Months }
          ].map((period) => (
            <div
              key={period.label}
              className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-4"
            >
              <div className="text-sm font-medium mb-1 dark:text-gray-300 text-gray-700">
                {period.label}
              </div>
              <div className={`text-2xl font-bold ${
                !period.value || period.value === -1 
                  ? 'dark:text-gray-500 text-gray-400' 
                  : period.value >= 99
                    ? 'dark:text-green-400 text-green-500'
                    : period.value >= 95
                      ? 'dark:text-yellow-400 text-yellow-500'
                      : 'dark:text-red-400 text-red-500'
              }`}>
                {!period.value || period.value === -1 ? 'N/A' : `${period.value.toFixed(2)}%`}
              </div>
            </div>
          ))}
        </div>

        {/* Group Status Summary */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
          <h2 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">
            Group Status Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Monitors', value: group.monitors.length },
              { label: 'Online Monitors', value: group.monitors.filter(m => m.status).length },
              { label: 'Offline Monitors', value: group.monitors.filter(m => !m.status).length }
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-sm dark:text-gray-400 text-gray-600">{stat.label}</span>
                <span className="text-2xl font-bold dark:text-white text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Response Component */}
        <AiResponse group={group} metric={null} />
      </div>
    );
  }

  // Return early if no metric and no group
  if (!metric) {
    return (
      <div className="h-full flex items-center justify-center dark:bg-gray-900 bg-gray-50">
        <div className="text-center dark:text-gray-400 text-gray-600">
          Select a monitor or group to view details
        </div>
      </div>
    );
  }

  // Add delete handler
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await monitorService.deleteMonitor(metric.id);
      if (success) {
        toast.success('Monitor deleted successfully', { position: 'bottom-right' });
        // Refresh dashboard data with current environment
        await monitorService.getDashboardGroups(metric.monitorEnvironment);
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
    setIsPauseLoading(true);
    try {
      const success = await monitorService.toggleMonitorPause(metric.id, !metric.paused);
      if (success) {
        toast.success(`Monitor ${metric.paused ? 'resumed' : 'paused'} successfully`, { position: 'bottom-right' });
        // Refresh the page to show updated status
        window.location.reload();
      } else {
        toast.error(`Failed to ${metric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
      }
    } catch {
      toast.error(`Failed to ${metric.paused ? 'resume' : 'pause'} monitor`, { position: 'bottom-right' });
    } finally {
      setIsPauseLoading(false);
    }
  };

  // Add handler for edit button
  const handleEditClick = async () => {
    try {
      let monitorData: Monitor;
      
      console.log('Monitor Type ID:', metric.monitorTypeId);
      
      if (metric.monitorTypeId === 3) {
        const tcpDetails = await monitorService.getMonitorTcpDetails(metric.id);
        monitorData = {
          ...tcpDetails,
          monitorTcp: {
            IP: tcpDetails.ip,
            port: tcpDetails.port
          },
          urlToCheck: '',  // Required by Monitor type but not used for TCP
          monitorStatusDashboard: metric.monitorStatusDashboard
        };
      } else if (metric.monitorTypeId === 4) {
        // Fetch Kubernetes monitor details
        const k8sDetails = await monitorService.getMonitorK8sDetails(metric.id);
        monitorData = {
          ...metric,
          monitorTypeId: 4,
          monitorK8s: {
            clusterName: k8sDetails.ClusterName,
            kubeConfig: k8sDetails.KubeConfig,
            monitorK8sNodes: k8sDetails.monitorK8sNodes
          }
        };
      } else {
        // Fetch HTTP monitor details
        const httpDetails = await monitorService.getMonitorHttpDetails(metric.id);
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
          monitorStatusDashboard: metric.monitorStatusDashboard,
          // Include HTTP response code fields for editing
          httpResponseCodeFrom: httpDetails.httpResponseCodeFrom,
          httpResponseCodeTo: httpDetails.httpResponseCodeTo
        };
      }
      
      console.log('Monitor Data being sent to modal:', monitorData);
      
      setMonitorToEdit(monitorData);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to fetch monitor details:', error);
      toast.error('Failed to load monitor details', { position: 'bottom-right' });
    }
  };

  // Add clone handler
  const handleClone = async () => {
    setIsCloning(true);
    try {
      await monitorService.cloneMonitor(metric.id);
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
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 mb-6">
          <div className="flex items-center justify-center p-4">
            <span className="text-gray-500 dark:text-gray-400">No Kubernetes nodes found</span>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
          Kubernetes Nodes for {k8sDetails.clusterName}
        </h2>
        {k8sDetails.monitorK8sNodes.map((node: MonitorK8sNode, index: number) => (
          <KubernetesNodeInfo key={index} node={node} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full p-6 overflow-y-auto dark:bg-gray-900 bg-gray-50 transition-colors duration-200">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">{metric?.name || group?.name}</h1>
          {metric?.monitorTypeId === 3 ? (
            <div className="flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Network className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span className="text-sm dark:text-gray-400 text-gray-600 truncate">
                {`${metric.monitorTcp?.IP}:${metric.monitorTcp?.port}`}
              </span>
            </div>
          ) : metric?.monitorTypeId === 4 ? (
            <div className="flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Server className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span className="text-sm dark:text-gray-400 text-gray-600 truncate">
                {k8sDetails?.clusterName || metric.monitorK8s?.clusterName || 'No cluster specified'}
              </span>
            </div>
          ) : metric && (
            <div className="flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span className="text-sm dark:text-gray-400 text-gray-600 truncate">
                {metric.urlToCheck || 'No URL specified'}
              </span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePauseToggle}
            disabled={isPauseLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            {isPauseLoading ? (
              <LoadingSpinner size="sm" />
            ) : metric.paused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            {isPauseLoading ? 'Processing...' : (metric.paused ? 'Resume' : 'Pause')}
          </button>

          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          <Link 
            to={`/monitor/${metric.id}/alerts`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800
                     text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40
                     transition-colors duration-200"
          >
            <Bell className="w-4 h-4" />
            Alerts
          </Link>

          <button
            onClick={() => setShowNotifications(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            Notifications
          </button>

          {metric?.monitorTypeId === 1 && (
            <button
              onClick={() => setShowSecurityHeaders(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                       dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors duration-200 relative"
            >
              <Shield className="w-4 h-4" />
              Security Headers
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 
                            text-yellow-800 dark:text-yellow-500 text-xs rounded-full border border-yellow-300 
                            dark:border-yellow-700/50">
                Beta
              </span>
            </button>
          )}

          <button
            onClick={() => setShowCloneConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <Copy className="w-4 h-4" />
            Clone
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                     text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40
                     transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          {/* Add Refresh button */}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200
                     dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700
                     transition-colors duration-200"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Add Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     border transition-colors duration-200 ${
                       autoRefresh
                         ? 'bg-green-500 text-white hover:bg-green-600 border-green-600'
                         : 'dark:bg-gray-800 bg-white border-gray-200 dark:border-gray-700 dark:text-gray-300 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                     }`}
          >
            <Clock className="w-4 h-4" />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Activity className={`w-5 h-5 ${
                metric.paused 
                  ? 'dark:text-gray-400 text-gray-500'
                  : metric.status 
                    ? 'dark:text-green-400 text-green-500' 
                    : 'dark:text-red-400 text-red-500'
              }`} />
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Current Status</p>
              <p className={`text-xl font-bold ${
                metric.paused 
                  ? 'dark:text-gray-400 text-gray-500'
                  : metric.status 
                    ? 'dark:text-green-400 text-green-500' 
                    : 'dark:text-red-400 text-red-500'
              }`}>
                {metric.paused ? 'Paused' : (metric.status ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>

        {/* Type Card */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              {getMonitorTypeInfo(metric.monitorTypeId, metric.status, metric.paused).icon}
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Monitor Type</p>
              <p className="text-xl font-bold dark:text-white text-gray-900">
                {getMonitorTypeInfo(metric.monitorTypeId, metric.status, metric.paused).label}
              </p>
            </div>
          </div>
        </div>

        {/* Response Time Card */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 dark:text-yellow-400 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs dark:text-gray-400 text-gray-600">Response Time</p>
              <p className="text-xl font-bold dark:text-white text-gray-900">
                {metric.monitorStatusDashboard.responseTime.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        {/* SSL Certificate Card */}
        {metric.checkCertExpiry && (
          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 dark:bg-gray-700 bg-gray-100 rounded-lg">
                <CheckCircle className="w-5 h-5 dark:text-purple-400 text-purple-500" />
              </div>
              <div>
                <p className="text-xs dark:text-gray-400 text-gray-600">SSL Certificate</p>
                <p className="text-xl font-bold dark:text-white text-gray-900">
                  {metric.daysToExpireCert} days
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Uptime Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {TIME_PERIODS.map((period) => {
          const uptimeValue = period.label === '1 Hour'
            ? metric.monitorStatusDashboard.uptime1Hr
            : period.label === '24 Hours'
            ? metric.monitorStatusDashboard.uptime24Hrs
            : period.label === '7 Days'
            ? metric.monitorStatusDashboard.uptime7Days
            : period.label === '30 Days'
            ? metric.monitorStatusDashboard.uptime30Days
            : period.label === '3 Months'
            ? metric.monitorStatusDashboard.uptime3Months
            : metric.monitorStatusDashboard.uptime6Months;
          
          const isSelected = selectedPeriod === period;
          const getUptimeColor = (value: number) => {
            if (value >= 99.5) return 'text-green-600 dark:text-green-400';
            if (value >= 95) return 'text-yellow-600 dark:text-yellow-400';
            return 'text-red-600 dark:text-red-400';
          };
          
          const getUptimeStatus = (value: number) => {
            if (value >= 99.5) return 'Excellent';
            if (value >= 95) return 'Good';
            if (value >= 90) return 'Fair';
            return 'Poor';
          };

          return (
            <button
              key={period.label}
              onClick={() => setSelectedPeriod(period)}
              className={`group p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`p-1 rounded-lg ${
                  isSelected 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Clock className={`w-3.5 h-3.5 ${
                    isSelected 
                      ? 'text-blue-600 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300'
                  }`} />
                </div>
                <span className={`text-xs font-medium ${
                  isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {period.label}
                </span>
              </div>
              
              <div className={`text-xl font-bold mb-0.5 ${getUptimeColor(uptimeValue)}`}>
                {uptimeValue.toFixed(2)}%
              </div>
              
              <div className={`text-xs font-medium ${getUptimeColor(uptimeValue)}`}>
                {getUptimeStatus(uptimeValue)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Timeline */}
      <StatusTimeline historyData={historyData} />

      {/* Response Time Chart - Only show for HTTP monitors */}
      {metric.monitorTypeId === 1 && (
        <div className="h-64 mt-6 relative">
          {isLoadingHistory && (
            <div className="absolute inset-0 bg-gray-900/20 dark:bg-gray-900/40 flex items-center justify-center z-10 rounded-lg">
              <LoadingSpinner size="lg" />
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={[...historyData].sort((a, b) => {
                try {
                  return new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime();
                } catch (error) {
                  console.error('Error sorting timestamps:', error);
                  return 0;
                }
              })}
            >
              {getOfflinePeriods(historyData).map((period, index) => (
                <ReferenceArea
                  key={index}
                  x1={period.start}
                  x2={period.end}
                  fill="#EF444460"
                />
              ))}
              <XAxis 
                dataKey="timeStamp" 
                tickFormatter={(time) => {
                  try {
                    // Use our new utility functions
                    const date = getLocalDateFromUTC(time);
                    // Use the compact date formatter
                    return formatCompactDate(date);
                  } catch (error) {
                    console.error('Error formatting tick:', error);
                    return 'Invalid Date';
                  }
                }}
                angle={-45}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                padding={{ left: 20, right: 20 }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => {
                  try {
                    // Use our new utility functions
                    const date = getLocalDateFromUTC(label as string);
                    // Use the compact date formatter
                    return formatCompactDate(date);
                  } catch (error) {
                    console.error('Error formatting tooltip:', error);
                    return 'Invalid Date';
                  }
                }}
                formatter={(value) => {
                  if (value === 0) {
                    return [<span style={{ color: '#EF4444' }}>Offline</span>, 'Status'];
                  }
                  return [`${value}ms`, 'Response Time'];
                }}
                contentStyle={{ 
                  backgroundColor: '#1F2937',
                  color: '#fff'
                }}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#5CD4E2"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kubernetes Nodes - Only show for Kubernetes monitors */}
      {metric.monitorTypeId === 4 && (
        <div className="mt-6 relative">
          {isLoadingK8s ? (
            <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs p-6 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Loading Kubernetes data..." />
            </div>
          ) : (
            renderK8sNodes()
          )}
        </div>
      )}

      {/* AI Response Component - Only show for groups, not for individual monitors */}
      {group && !metric && <AiResponse group={group} metric={null} />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Delete Monitor
            </h3>
            
            <p className="dark:text-gray-300 text-gray-700 mb-6">
              Are you sure you want to delete monitor "{metric.name}"? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Monitor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Edit Modal */}
      {showEditModal && (
        <AddMonitorModal
          onClose={() => setShowEditModal(false)}
          onAdd={async () => {}}
          onUpdate={async (updatedMonitor) => {
            try {
              updatedMonitor.id = metric.id;
              updatedMonitor.monitorId = metric.id;
              const success = metric.monitorTypeId === 3
                ? await monitorService.updateMonitorTcp(updatedMonitor as UpdateMonitorTcpPayload)
                : await monitorService.updateMonitorHttp(updatedMonitor as UpdateMonitorHttpPayload);
              
              if (success) {
                toast.success('Monitor updated successfully', { position: 'bottom-right' });
                setShowEditModal(false);
                window.location.reload();
              }
            } catch (error) {
              console.error('Failed to update monitor:', error);
              toast.error('Failed to update monitor', { position: 'bottom-right' });
            }
          }}
          existingMonitor={monitorToEdit || metric}
          isEditing={true}
        />
      )}

      {showNotifications && (
        <NotificationListModal
          monitorId={metric.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showSecurityHeaders && metric && (
        <SecurityHeadersModal
          monitorId={metric.id}
          monitorName={metric.name}
          onClose={() => setShowSecurityHeaders(false)}
          onEditMonitor={() => {
            setShowSecurityHeaders(false);
            setShowEditModal(true);
            setMonitorToEdit(metric);
          }}
        />
      )}

      {/* Add clone confirmation modal */}
      {showCloneConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Clone Monitor
            </h3>
            
            <p className="dark:text-gray-300 text-gray-700 mb-6">
              Are you sure you want to clone monitor "{metric.name}"? A new monitor will be created with name "{metric.name}_Clone".
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCloneConfirm(false)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={isCloning}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isCloning ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Clone Monitor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}