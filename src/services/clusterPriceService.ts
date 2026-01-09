import { metricsHttp } from './httpClient';
import { ClusterPrice } from '../types';

class ClusterPriceService {
  /**
   * Fetch cluster prices from the API
   * @param clusterName - Name of the cluster
   * @param minutes - Number of minutes of data to fetch (default: 1440 = 24 hours)
   */
  async getClusterPrices(clusterName: string, minutes: number = 1440): Promise<ClusterPrice[]> {
    try {
      const response = await metricsHttp.get<ClusterPrice[]>('/api/cluster-prices', {
        params: {
          clusterName,
          minutes
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch cluster prices:', error);
      throw error;
    }
  }
}

const clusterPriceService = new ClusterPriceService();
export default clusterPriceService;
