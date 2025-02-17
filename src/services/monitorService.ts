import { monitoringHttp } from './httpClient';
import { MonitorGroup, MonitorAgent, Monitor } from '../types';

export class MonitorService {
  private static instance: MonitorService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/Monitor';
  }

  public static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  async getDashboardGroups(environmentId: number): Promise<MonitorGroup[]> {
    const response = await monitoringHttp.get<MonitorGroup[]>(
      `/api/MonitorGroup/monitorDashboardGroupListByUser/${environmentId}`
    );
    return response.data;
  }

  // ... other existing methods ...
}

export default MonitorService.getInstance(); 