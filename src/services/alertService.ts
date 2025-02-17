import { monitoringHttp } from './httpClient';
import { AlertIncident } from '../types';

export class AlertService {
  private static instance: AlertService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/MonitorAlert';
  }

  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  async getAlerts(environmentId: number, period: number): Promise<AlertIncident[]> {
    const response = await monitoringHttp.get<AlertIncident[]>(
      `${this.baseUrl}/monitorAlerts/${environmentId}/${period}`
    );
    return response.data;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await monitoringHttp.post(`${this.baseUrl}/acknowledge/${alertId}`);
  }
}

export default AlertService.getInstance(); 