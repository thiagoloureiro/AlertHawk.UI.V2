import { metricsHttp } from './httpClient';
import { NodeMetric, NamespaceMetric, PodLog } from '../types';

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
   * @param clusterName - Name of the cluster to filter by (optional)
   */
  async getNamespaces(clusterName?: string): Promise<string[]> {
    try {
      const params: { clusterName?: string } = {};
      if (clusterName) {
        params.clusterName = clusterName;
      }
      const response = await metricsHttp.get<string[]>('/api/metrics/namespaces', {
        params
      });
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
      const response = await metricsHttp.get<NamespaceMetric[]>('/api/metrics/namespace', {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch namespace metrics:', error);
      throw error;
    }
  }

  /**
   * Fetch pod logs from the API
   * @param namespace - Name of the namespace
   * @param container - Name of the container
   * @param hours - Number of hours of logs to fetch (default: 24)
   * @param limit - Maximum number of log entries to return (default: 1)
   * @param clusterName - Name of the cluster (optional)
   */
  async getPodLogs(namespace: string, container: string, hours: number = 24, limit: number = 1, clusterName?: string): Promise<PodLog[]> {
    try {
      const params: { hours: number; limit: number; clusterName?: string } = {
        hours,
        limit
      };
      if (clusterName) {
        params.clusterName = clusterName;
      }
      const response = await metricsHttp.get<PodLog[]>(`/api/metrics/pod/log/namespace/${namespace}`, {
        params: {
          container,
          ...params
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch pod logs:', error);
      throw error;
    }
  }
}

const metricsService = new MetricsService();
export default metricsService;

