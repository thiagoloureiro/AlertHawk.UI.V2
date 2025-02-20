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

  async setMonitorHistoryRetention(days: number) {
    const response = await monitoringHttp.post('/api/MonitorHistory/SetMonitorHistoryRetention', {
      historyDaysRetention: days
    });
    return response.data;
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

  async getMonitorAlerts(monitorId: number) {
    const response = await monitoringHttp.get(`/api/MonitorAlert/monitorAlerts/${monitorId}/7`);
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

  async cloneMonitor(monitorId: number): Promise<boolean> {
    try {
      await monitoringHttp.post(`/api/Monitor/Clone/${monitorId}`);
      return true;
    } catch (error) {
      console.error('Failed to clone monitor:', error);
      return false;
    }
  }

  // ... other existing methods ...
}

export default MonitorService.getInstance(); 