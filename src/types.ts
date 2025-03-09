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
  monitorStatusDashboard: MonitorStatusDashboard;
  checkCertExpiry: boolean;
  monitorTcp?: MonitorTcp;
  monitorK8s?: {
    clusterName: string;
    kubeConfig: string;
  };
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