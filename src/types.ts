export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  path: string;
}

export interface MetricItem {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  responseTime: number;
  icon: string;
  metrics: {
    lastHour: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    last3Months: number;
    last6Months: number;
  };
}

export interface AlertIncident {
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

export interface User {
  id: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  groups: string[];
  initials: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
}

export interface MonitorGroup {
  id: number;
  name: string;
  description: string;
  monitorCount: number;
  createdAt: string;
  isActive: boolean;
}

export interface MonitorAgent {
  id: string;
  hostname: string;
  monitorCount: number;
  isMaster: boolean;
  location: string;
  version: string;
  status: 'running' | 'stopped' | 'error';
  monitorRegion: number;
}

export type NotificationType = 'ms-teams' | 'slack' | 'telegram' | 'push' | 'email' | 'webhook';

export interface Notification {
  id: string;
  name: string;
  type: NotificationType;
  createdAt: string;
  isActive: boolean;
}

export type Environment = 'production' | 'staging' | 'development' | 'testing';
export type TimePeriod = '1d' | '7d' | '30d' | '60d' | '90d' | '120d' | '180d';

export interface AlertFilters {
  environment: Environment | 'all';
  timePeriod: TimePeriod;
  search: string;
}

export interface MonitorHistoryData {
  status: boolean;
  timeStamp: string;
  statusCode: number;
  responseTime: number;
}

export interface MonitorStatusDashboard {
  monitorId: number;
  uptime1Hr: number;
  uptime24Hrs: number;
  uptime7Days: number;
  uptime30Days: number;
  uptime3Months: number;
  uptime6Months: number;
  certExpDays: number;
  responseTime: number;
  historyData: MonitorHistoryData[];
}

export interface MonitorTcp {
  IP: string;
  port: number;
}

export interface MonitorK8s {
  clusterName: string;
  kubeConfig: string;
  monitorK8sNodes?: MonitorK8sNode[];
}

export interface MonitorK8sNode {
  nodeName: string;
  containerRuntimeProblem: boolean;
  kernelDeadlock: boolean;
  kubeletProblem: boolean;
  frequentUnregisterNetDevice: boolean;
  filesystemCorruptionProblem: boolean;
  readonlyFilesystem: boolean;
  frequentKubeletRestart: boolean;
  frequentDockerRestart: boolean;
  frequentContainerdRestart: boolean;
  memoryPressure: boolean;
  diskPressure: boolean;
  pidPressure: boolean;
  ready: boolean;
}

export interface MonitorHttpHeaders {
  monitorId: number;
  cacheControl?: string;
  strictTransportSecurity?: string;
  permissionsPolicy?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  referrerPolicy?: string;
  contentSecurityPolicy?: string;
}

export interface Monitor {
  id: number;
  monitorTypeId: number;
  name: string;
  heartBeatInterval: number;
  retries: number;
  status: boolean;
  daysToExpireCert: number;
  paused: boolean;
  urlToCheck: string;
  monitorRegion: number;
  monitorEnvironment: number;
  monitorGroup: number;
  monitorStatusDashboard: MonitorStatusDashboard;
  checkCertExpiry: boolean;
  monitorTcp?: MonitorTcp;
  monitorK8s?: MonitorK8s;
}

export interface MonitorGroup {
  id: number;
  name: string;
  monitors: Monitor[];
  avgUptime1Hr: number;
  avgUptime24Hrs: number;
  avgUptime7Days: number;
  avgUptime30Days: number;
  avgUptime3Months: number;
  avgUptime6Months: number;
}

// Helper function to convert environment number to name
export const getEnvironmentName = (envId: number): string => {
  switch (envId) {
    case 1: return 'Development';
    case 2: return 'Staging';
    case 3: return 'QA';
    case 4: return 'Testing';
    case 5: return 'PreProd';
    case 6: return 'Production';
    default: return 'Unknown';
  }
};

export interface NodeMetric {
  timestamp: string;
  nodeName: string;
  clusterName: string;
  clusterEnvironment?: string;
  cpuUsageCores: number;
  cpuCapacityCores: number;
  memoryUsageBytes: number;
  memoryCapacityBytes: number;
  diskReadBytes?: number;
  diskWriteBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
  networkUsageBytes?: number;
  kubernetesVersion?: string;
  cloudProvider?: string;
  isReady?: boolean;
  hasMemoryPressure?: boolean;
  hasDiskPressure?: boolean;
  hasPidPressure?: boolean;
  architecture?: string;
  operatingSystem?: string;
  region?: string;
  instanceType?: string;
}

export interface NamespaceMetric {
  timestamp: string;
  namespace: string;
  pod: string;
  container: string;
  clusterName: string;
  cpuUsageCores: number;
  cpuLimitCores: number | null;
  memoryUsageBytes: number;
  diskReadBytes?: number;
  diskWriteBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
  networkUsageBytes?: number;
  nodeName: string;
  podState?: string;
  restartCount?: number;
  podAge?: number;
}

export interface PodLog {
  timestamp: string;
  clusterName: string;
  namespace: string;
  pod: string;
  container: string;
  logContent: string;
}

export interface MetricsAlert {
  id: number;
  clusterName: string;
  nodeName?: string;
  timeStamp: string;
  status: boolean;
  message: string;
  alertType?: string;
  severity?: string;
  metricName?: string;
  threshold?: number;
  currentValue?: number;
}

export interface KubernetesEventDto {
  timestamp: string;
  clusterName: string;
  namespace: string;
  eventName: string;
  eventUid: string;
  involvedObjectKind: string;
  involvedObjectName: string;
  involvedObjectNamespace: string;
  eventType: string;
  reason: string;
  message: string;
  sourceComponent: string;
  count: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
}

export interface ClusterPrice {
  timestamp: string;
  clusterName: string;
  nodeName: string;
  region: string;
  instanceType: string;
  operatingSystem: string;
  cloudProvider: string;
  currencyCode: string;
  unitPrice: number;
  retailPrice: number;
  meterName: string;
  productName: string;
  skuName: string;
  serviceName: string;
  armRegionName: string;
  effectiveStartDate: string;
}

export interface MaintenanceWindowRequest {
  startUtc: string | null;
  endUtc: string | null;
}

export interface MaintenanceWindow {
  startUtc: string | null;
  endUtc: string | null;
  isInMaintenanceWindow: boolean;
  message: string;
}

export interface MonitorExecutionStatus {
  isDisabled: boolean;
  isInMaintenanceWindow: boolean;
  maintenanceWindow: {
    startUtc: string | null;
    endUtc: string | null;
  };
  message: string;
}

export interface PVCMetric {
  timestamp: string;
  clusterName: string;
  namespace: string;
  pod: string;
  pvcNamespace: string;
  pvcName: string;
  volumeName: string;
  usedBytes: number;
  availableBytes: number;
  capacityBytes: number;
}