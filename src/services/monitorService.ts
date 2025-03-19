import { monitoringHttp } from './httpClient';
import { MonitorGroup, MonitorAgent } from '../types';

export enum MonitorRegion {
  Europe = 1,
  Oceania = 2,
  NorthAmerica = 3,
  SourthAmerica = 4,
  Africa = 5,
  Asia = 6,
  Custom = 7,
  Custom2 = 8,
  Custom3 = 9,
  Custom4 = 10,
  Custom5 = 11
}

export interface CreateMonitorHttpPayload {
  name: string;
  monitorGroup: number;
  monitorRegion: number;
  monitorEnvironment: number;
  monitorHttpMethod: number;
  checkCertExpiry: boolean;
  ignoreTlsSsl: boolean;
  urlToCheck: string;
  maxRedirects: number;
  heartBeatInterval: number;
  body: string;
  timeout: number;
  retries: number;
  status: boolean;
  monitorTypeId: number;
}

export interface CreateMonitorTcpPayload {
  name: string;
  monitorGroup: number;
  monitorRegion: number;
  monitorEnvironment: number;
  heartBeatInterval: number;
  port: number;
  ip: string;
  timeout: number;
  status: boolean;
  retries: number;
  monitorTypeId: number;
}

export interface UpdateMonitorHttpPayload {
  monitorId: number;
  ignoreTlsSsl: boolean;
  maxRedirects: number;
  urlToCheck: string;
  responseStatusCode: number;
  timeout: number;
  lastStatus: boolean;
  responseTime: number;
  monitorHttpMethod: number;
  body: string;
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
}

export interface UpdateMonitorTcpPayload {
  monitorId: number;
  port: number;
  ip: string;
  timeout: number;
  lastStatus: boolean;
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
  ignoreTlsSsl: boolean;
  part: number;
}

export interface TcpMonitorDetails {
  monitorId: number;
  port: number;
  ip: string;
  timeout: number;
  lastStatus: boolean;
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
}

export interface MonitorK8sPayload {
  Id: number;
  MonitorId: number;
  MonitorTypeId: number;
  MonitorType: {
    Id: number;
    Name: string;
  };
  Name: string;
  HeartBeatInterval: number;
  Retries: number;
  Status: boolean;
  DaysToExpireCert: number;
  Paused: boolean;
  UrlToCheck: string;
  CheckCertExpiry: boolean;
  MonitorGroup: number;
  MonitorRegion: number;
  ClusterName: string;
  KubeConfig: string;
  LastStatus: boolean;
  MonitorEnvironment: number;
  Base64Content: string;
  monitorK8sNodes?: {
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
  }[];
}

interface HistoryRetention {
  historyDaysRetention: number;
}

interface MonitorHistoryPoint {
  status: boolean;
  timeStamp: string;
  statusCode: number;
  responseTime: number;
}

export class MonitorService {
  private static instance: MonitorService;

  public static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  async getMonitorGroupList(): Promise<MonitorGroup[]> {
    const response = await monitoringHttp.get('/api/MonitorGroup/monitorGroupList');
    return response.data;
  }

  async getMonitorGroupListByUser(): Promise<MonitorGroup[]> {
    const response = await monitoringHttp.get('/api/MonitorGroup/monitorGroupListByUser');
    return response.data;
  }

  async getDashboardGroups(environmentId: number): Promise<MonitorGroup[]> {
    const response = await monitoringHttp.get<MonitorGroup[]>(
      `/api/MonitorGroup/monitorDashboardGroupListByUser/${environmentId}`
    );
    return response.data;
  }

  async getMonitorAgents(): Promise<MonitorAgent[]> {
    const response = await monitoringHttp.get<MonitorAgent[]>(`/api/Monitor/allMonitorAgents`);
    return response.data;
  }

  async getMonitorJsonBackup() {
    const response = await monitoringHttp.get('/api/monitor/getMonitorJsonBackup');
    return response.data;
  }

  async getMonitorHistoryRetention(): Promise<number> {
    const response = await monitoringHttp.get<HistoryRetention>('/api/MonitorHistory/GetMonitorHistoryRetention');
    return response.data.historyDaysRetention;
  }

  async setMonitorHistoryRetention(days: number): Promise<void> {
    await monitoringHttp.post('/api/MonitorHistory/SetMonitorHistoryRetention', {
      historyDaysRetention: days
    });
  }

  async clearAllStatistics() {
    const response = await monitoringHttp.delete('/api/MonitorHistory');
    return response.data;
  }

  async uploadMonitorBackup(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await monitoringHttp.post('/api/monitor/uploadMonitorJsonBackup', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async getMonitorAlerts(monitorId: number, days: number = 7) {
    const response = await monitoringHttp.get(`/api/MonitorAlert/monitorAlerts/${monitorId}/${days}`);
    return response.data;
  }

  async addMonitorGroup(name: string) {
    const response = await monitoringHttp.post('/api/monitorGroup/addMonitorGroup', {
      name: name
    });
    return response.data;
  }

  async deleteMonitorGroup(groupId: number) {
    const response = await monitoringHttp.delete(`/api/monitorGroup/deleteMonitorGroup/${groupId}`);
    return response.data;
  }

  async updateMonitorGroup(data: { id: number; name: string }) {
    const response = await monitoringHttp.post('/api/monitorGroup/updateMonitorGroup', {
      id: data.id,
      name: data.name
    });
    return response.data;
  }

  async deleteMonitor(monitorId: number): Promise<boolean> {
    try {
      await monitoringHttp.delete(`/api/Monitor/deleteMonitor/${monitorId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete monitor:', error);
      return false;
    }
  }

  async toggleMonitorPause(monitorId: number, pause: boolean): Promise<boolean> {
    try {
      await monitoringHttp.put(`/api/Monitor/pauseMonitor/${monitorId}/${pause}`);
      return true;
    } catch (error) {
      console.error('Failed to toggle monitor pause:', error);
      return false;
    }
  }

  async createMonitor(monitor: CreateMonitorHttpPayload | CreateMonitorTcpPayload): Promise<boolean> {
    try {
      const endpoint = 'monitorTypeId' in monitor && monitor.monitorTypeId === 3 
        ? '/api/Monitor/CreateMonitorTcp'
        : '/api/Monitor/CreateMonitorHttp';

        console.log('monitor:', monitor);
        
      await monitoringHttp.post(endpoint, monitor);
      return true;
    } catch (error) {
      console.error('Failed to create monitor:', error);
      return false;
    }
  }

  async updateMonitorHttp(monitor: UpdateMonitorHttpPayload): Promise<boolean> {
    try {
      await monitoringHttp.post('/api/Monitor/updateMonitorHttp', monitor);
      return true;
    } catch (error) {
      console.error('Failed to update monitor:', error);
      return false;
    }
  }

  async updateMonitorTcp(monitor: UpdateMonitorTcpPayload): Promise<boolean> {
    try {
      await monitoringHttp.post('/api/Monitor/updateMonitorTcp', monitor);
      return true;
    } catch (error) {
      console.error('Failed to update TCP monitor:', error);
      return false;
    }
  }

  async getMonitorTcpDetails(monitorId: number): Promise<TcpMonitorDetails> {
    const response = await monitoringHttp.get<TcpMonitorDetails>(
      `/api/Monitor/getMonitorTcpByMonitorId/${monitorId}`
    );
    return response.data;
  }

  async getMonitorK8sDetails(monitorId: number): Promise<MonitorK8sPayload> {
    const response = await monitoringHttp.get<MonitorK8sPayload>(
      `/api/Monitor/getMonitorK8sByMonitorId/${monitorId}`
    );
    return response.data;
  }

  async cloneMonitor(monitorId: number): Promise<boolean> {
    try {
      await monitoringHttp.post(`/api/Monitor/Clone/${monitorId}`);
      return true;
    } catch (error) {
      console.error('Failed to clone monitor:', error);
      return false;
    }
  }

  async createMonitorK8s(payload: MonitorK8sPayload): Promise<void> {
    await monitoringHttp.post('/api/Monitor/createMonitorK8s', payload);
  }

  async updateMonitorK8s(payload: MonitorK8sPayload): Promise<void> {
    await monitoringHttp.post('/api/Monitor/updateMonitorK8s', payload);
  }

  async getMonitorHistory(monitorId: number, days: number): Promise<MonitorHistoryPoint[]> {
    const sampling = days > 0;
    let samplingPoints = days === 1 ? 10 : 50;
    if (days > 1) {
      samplingPoints = Math.floor(days * 10);
    }
    
    const response = await monitoringHttp.get<MonitorHistoryPoint[]>(
      `/api/MonitorHistory/MonitorHistoryByIdDays/${monitorId}/${days}/${sampling}/${samplingPoints}`
    );

    let data = response.data;
    
    // If more than 500 points, interpolate
    if (data.length > 500) {
      const step = Math.ceil(data.length / 150);
      data = data.filter((_, index) => index % step === 0);
    }

    return data;
  }

  async getMonitorHttpDetails(monitorId: number) {
    try {
      const response = await monitoringHttp.get(`/api/Monitor/getMonitorHttpByMonitorId/${monitorId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch HTTP monitor details:', error);
      throw error;
    }
  }

  // ... other existing methods ...
}

export default MonitorService.getInstance(); 