import { monitoringHttp } from './httpClient';
import { MonitorGroup, MonitorAgent, Monitor } from '../types';

interface MonitorGroupListItem {
  id: number;
  name: string;
}

interface MonitorAgent {
  id: number;
  hostname: string;
  timeStamp: string;
  isMaster: boolean;
  listTasks: number;
  version: string;
  monitorRegion: number;
}

export enum MonitorRegion {
  USEast = 1,
  USWest = 2,
  Europe = 3,
  Asia = 4,
  SouthAmerica = 5,
  Oceania = 6
}

export class MonitorService {
  private static instance: MonitorService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/MonitorGroup';
  }

  public static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  async getMonitorGroupList(): Promise<MonitorGroupListItem[]> {
    const response = await monitoringHttp.get<MonitorGroupListItem[]>(
      `${this.baseUrl}/monitorGroupList`
    );
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

  // ... other existing methods ...
}

export default MonitorService.getInstance(); 