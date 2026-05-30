import { monitoringHttp } from './httpClient';
import { AlertIncident } from '../types';

export interface AzureAppSecret {
  id: number;
  applicationObjectId: string;
  applicationDisplayName: string;
  appId: string;
  keyId: string;
  secretDisplayName?: string;
  endDateTime: string;
  daysUntilExpiry: number;
  isExpiring: boolean;
  lastChecked: string;
}

export interface AzureSecretsConfig {
  enabled: boolean;
  daysBeforeExpiryToAlert: number;
  monitorId: number;
  cron: string;
  hasCredentials: boolean;
}

export interface AzureSecretsConfigUpdate {
  enabled?: boolean;
  daysBeforeExpiryToAlert?: number;
  monitorId?: number;
  cron?: string;
}

export interface AzureSecretsStatus {
  enabled: boolean;
  totalSecrets: number;
  expiringCount: number;
  lastChecked?: string;
  monitorStatus?: boolean;
  monitorId: number;
  monitorName?: string;
  daysBeforeExpiryToAlert: number;
}

export interface AzureAppSecretMonitorRequest {
  name: string;
  monitorGroup: number;
  monitorRegion: number;
  monitorEnvironment: number;
  heartBeatInterval: number;
}

export interface AzureAppSecretMonitorUpdateRequest {
  name: string;
  monitorGroup: number;
  monitorRegion: number;
  monitorEnvironment: number;
  heartBeatInterval: number;
}

export interface MonitorHistoryEntry {
  monitorId: number;
  status: boolean;
  timeStamp: string;
  responseMessage?: string;
}

export interface AnchorMonitor {
  id: number;
  name: string;
  monitorTypeId: number;
  heartBeatInterval: number;
  status: boolean;
  paused: boolean;
  monitorRegion: number;
  monitorEnvironment: number;
}

class AzureAppSecretService {
  private static instance: AzureAppSecretService;
  private readonly baseUrl = '/api/AzureAppSecret';

  public static getInstance(): AzureAppSecretService {
    if (!AzureAppSecretService.instance) {
      AzureAppSecretService.instance = new AzureAppSecretService();
    }
    return AzureAppSecretService.instance;
  }

  async getSecrets(expiringOnly = false): Promise<AzureAppSecret[]> {
    const response = await monitoringHttp.get<AzureAppSecret[]>(this.baseUrl, {
      params: { expiringOnly },
    });
    return response.data;
  }

  async getStatus(): Promise<AzureSecretsStatus> {
    const response = await monitoringHttp.get<AzureSecretsStatus>(`${this.baseUrl}/status`);
    return response.data;
  }

  async getConfig(): Promise<AzureSecretsConfig> {
    const response = await monitoringHttp.get<AzureSecretsConfig>(`${this.baseUrl}/config`);
    return response.data;
  }

  async updateConfig(update: AzureSecretsConfigUpdate): Promise<AzureSecretsConfig> {
    const response = await monitoringHttp.put<AzureSecretsConfig>(`${this.baseUrl}/config`, update);
    return response.data;
  }

  async sync(): Promise<void> {
    await monitoringHttp.post(`${this.baseUrl}/sync`);
  }

  async getHistory(days: number): Promise<MonitorHistoryEntry[]> {
    const response = await monitoringHttp.get<MonitorHistoryEntry[]>(`${this.baseUrl}/history/${days}`);
    return response.data;
  }

  async getAlerts(days: number): Promise<AlertIncident[]> {
    const response = await monitoringHttp.get<AlertIncident[]>(`${this.baseUrl}/alerts/${days}`);
    return response.data;
  }

  async getAnchorMonitor(): Promise<AnchorMonitor | null> {
    try {
      const response = await monitoringHttp.get<AnchorMonitor>(`${this.baseUrl}/monitor`);
      return response.data;
    } catch {
      return null;
    }
  }

  async createAnchorMonitor(request: AzureAppSecretMonitorRequest): Promise<number> {
    const response = await monitoringHttp.post<number>(`${this.baseUrl}/monitor`, request);
    return response.data;
  }

  async updateAnchorMonitor(request: AzureAppSecretMonitorUpdateRequest): Promise<void> {
    await monitoringHttp.put(`${this.baseUrl}/monitor`, request);
  }
}

export default AzureAppSecretService.getInstance();
