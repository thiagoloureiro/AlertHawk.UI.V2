import { metricsHttp } from './httpClient';
import { NodeMetric, NamespaceMetric } from '../types';

class MetricsService {
  /**
   * Fetch node metrics from the API
   * @param hours - Number of hours of data to fetch (default: 24)
   * @param limit - Maximum number of records to return (default: 100)
   */
  async getNodeMetrics(hours: number = 24, limit: number = 100): Promise<NodeMetric[]> {
    try {
      const response = await metricsHttp.get<NodeMetric[]>('/api/Metrics/node', {
        params: {
          hours,
          limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch node metrics:', error);
      throw error;
    }
  }

  /**
   * Fetch namespace/pod metrics from the API
   * @param hours - Number of hours of data to fetch (default: 24)
   * @param limit - Maximum number of records to return (default: 100)
   */
  async getNamespaceMetrics(hours: number = 24, limit: number = 100): Promise<NamespaceMetric[]> {
    try {
      const response = await metricsHttp.get<NamespaceMetric[]>('/api/Metrics/namespace', {
        params: {
          hours,
          limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch namespace metrics:', error);
      throw error;
    }
  }
}

const metricsService = new MetricsService();
export default metricsService;

