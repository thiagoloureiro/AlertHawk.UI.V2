import { metricsHttp } from './httpClient';
import { NodeMetric, NamespaceMetric } from '../types';

class MetricsService {
  /**
   * Fetch available cluster names from the API
   */
  async getClusters(): Promise<string[]> {
    try {
      const response = await metricsHttp.get<string[]>('/api/metrics/clusters');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch clusters:', error);
      throw error;
    }
  }

  /**
   * Fetch available namespace names from the API
   */
  async getNamespaces(): Promise<string[]> {
    try {
      const response = await metricsHttp.get<string[]>('/api/metrics/namespaces');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch namespaces:', error);
      throw error;
    }
  }

  /**
   * Fetch node metrics from the API
   * @param hours - Number of hours of data to fetch (default: 24)
   * @param limit - Maximum number of records to return (default: 100)
   * @param clusterName - Name of the cluster to filter by (optional)
   */
  async getNodeMetrics(hours: number = 24, limit: number = 100, clusterName?: string): Promise<NodeMetric[]> {
    try {
      const params: { hours: number; limit: number; clusterName?: string } = {
        hours,
        limit
      };
      if (clusterName) {
        params.clusterName = clusterName;
      }
      const response = await metricsHttp.get<NodeMetric[]>('/api/Metrics/node', {
        params
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
   * @param clusterName - Name of the cluster to filter by (optional)
   * @param namespace - Name of the namespace to filter by (optional)
   */
  async getNamespaceMetrics(hours: number = 24, limit: number = 100, clusterName?: string, namespace?: string): Promise<NamespaceMetric[]> {
    try {
      const params: { hours: number; limit: number; clusterName?: string; namespace?: string } = {
        hours,
        limit
      };
      if (clusterName) {
        params.clusterName = clusterName;
      }
      if (namespace) {
        params.namespace = namespace;
      }
      const response = await metricsHttp.get<NamespaceMetric[]>('/api/Metrics/namespace', {
        params
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

