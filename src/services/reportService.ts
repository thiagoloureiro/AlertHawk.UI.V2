import axios from 'axios';

const API_URL = import.meta.env.VITE_APP_MONITORING_API_URL;
const API_KEY = 'apikey';

const reportHttp = axios.create({
  baseURL: API_URL,
  headers: {
    'ApiKey': API_KEY,
    'Content-Type': 'application/json'
  }
});

interface UptimeReport {
  monitorName: string;
  totalOnlineMinutes: number;
  totalOfflineMinutes: number;
  uptimePercentage: number;
}

const reportService = {
  getUptimeReport: async (groupId: number, hours: number): Promise<UptimeReport[]> => {
    try {
      const response = await reportHttp.get(`/api/MonitorReport/Uptime/${groupId}/${hours}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch uptime report:', error);
      throw error;
    }
  }
};

export default reportService; 