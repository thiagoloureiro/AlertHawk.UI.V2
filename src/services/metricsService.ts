import { metricsHttp } from './httpClient';
import { NodeMetric, NamespaceMetric, PodLog, MetricsAlert, KubernetesEventDto } from '../types';

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
   * @param minutes - Number of minutes of data to fetch (default: 30)
   * @param clusterName - Name of the cluster to filter by (optional)
   */
  async getNodeMetrics(minutes: number = 30, clusterName?: string): Promise<NodeMetric[]> {
    try {
      const params: { minutes: number; clusterName?: string } = {
        minutes
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
   * @param minutes - Number of minutes of data to fetch (default: 30)
   * @param clusterName - Name of the cluster to filter by (optional)
   * @param namespace - Name of the namespace to filter by (optional)
   */
  async getNamespaceMetrics(minutes: number = 30, clusterName?: string, namespace?: string): Promise<NamespaceMetric[]> {
    try {
      const params: { minutes: number; clusterName?: string; namespace?: string } = {
        minutes
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
   * @param minutes - Number of minutes of logs to fetch (default: 30)
   * @param clusterName - Name of the cluster (optional)
   */
  async getPodLogs(namespace: string, container: string, minutes: number = 30, clusterName?: string): Promise<PodLog[]> {
    try {
      const params: { minutes: number; clusterName?: string } = {
        minutes
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

  /**
   * Fetch metrics alerts from the API
   * @param days - Number of days to look back (default: 30)
   * @param clusterName - Optional cluster name filter
   * @param nodeName - Optional node name filter
   */
  async getMetricsAlerts(days: number = 30, clusterName?: string, nodeName?: string): Promise<MetricsAlert[]> {
    try {
      const params: { days: number; clusterName?: string; nodeName?: string } = {
        days
      };
      if (clusterName) {
        params.clusterName = clusterName;
      }
      if (nodeName) {
        params.nodeName = nodeName;
      }
      const response = await metricsHttp.get<MetricsAlert[]>('/api/MetricsAlert/metricsAlerts', {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics alerts:', error);
      throw error;
    }
  }

  /**
   * Fetch metrics alerts by cluster
   * @param clusterName - Cluster name
   * @param days - Number of days to look back (default: 30)
   */
  async getMetricsAlertsByCluster(clusterName: string, days: number = 30): Promise<MetricsAlert[]> {
    try {
      const response = await metricsHttp.get<MetricsAlert[]>(`/api/MetricsAlert/metricsAlerts/cluster/${clusterName}`, {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics alerts by cluster:', error);
      throw error;
    }
  }

  /**
   * Fetch metrics alerts by node
   * @param clusterName - Cluster name
   * @param nodeName - Node name
   * @param days - Number of days to look back (default: 30)
   */
  async getMetricsAlertsByNode(clusterName: string, nodeName: string, days: number = 30): Promise<MetricsAlert[]> {
    try {
      const response = await metricsHttp.get<MetricsAlert[]>(`/api/MetricsAlert/metricsAlerts/cluster/${clusterName}/node/${nodeName}`, {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics alerts by node:', error);
      throw error;
    }
  }

  /**
   * Fetch Kubernetes events
   * @param namespace - Optional namespace filter
   * @param involvedObjectKind - Optional involved object kind filter (e.g., Pod, Node)
   * @param involvedObjectName - Optional involved object name filter
   * @param eventType - Optional event type filter (Normal, Warning)
   * @param minutes - Number of minutes to look back (default: 1440 = 24 hours)
   * @param limit - Maximum number of results (default: 1000)
   * @param clusterName - Optional cluster name filter
   */
  async getKubernetesEvents(
    namespace?: string,
    involvedObjectKind?: string,
    involvedObjectName?: string,
    eventType?: string,
    minutes: number = 1440,
    limit: number = 1000,
    clusterName?: string
  ): Promise<KubernetesEventDto[]> {
    try {
      const params: {
        namespace?: string;
        involvedObjectKind?: string;
        involvedObjectName?: string;
        eventType?: string;
        minutes?: number;
        limit?: number;
        clusterName?: string;
      } = {
        minutes,
        limit
      };
      
      if (namespace) params.namespace = namespace;
      if (involvedObjectKind) params.involvedObjectKind = involvedObjectKind;
      if (involvedObjectName) params.involvedObjectName = involvedObjectName;
      if (eventType) params.eventType = eventType;
      if (clusterName) params.clusterName = clusterName;

      const response = await metricsHttp.get<KubernetesEventDto[]>('/api/events', {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Kubernetes events:', error);
      throw error;
    }
  }

  /**
   * Fetch Kubernetes events for a specific namespace
   * @param namespace - Namespace name
   * @param involvedObjectKind - Optional involved object kind filter
   * @param involvedObjectName - Optional involved object name filter
   * @param eventType - Optional event type filter
   * @param minutes - Number of minutes to look back (default: 1440 = 24 hours)
   * @param limit - Maximum number of results (default: 1000)
   * @param clusterName - Optional cluster name filter
   */
  async getKubernetesEventsByNamespace(
    namespace: string,
    involvedObjectKind?: string,
    involvedObjectName?: string,
    eventType?: string,
    minutes: number = 1440,
    limit: number = 1000,
    clusterName?: string
  ): Promise<KubernetesEventDto[]> {
    try {
      const params: {
        involvedObjectKind?: string;
        involvedObjectName?: string;
        eventType?: string;
        minutes?: number;
        limit?: number;
        clusterName?: string;
      } = {
        minutes,
        limit
      };
      
      if (involvedObjectKind) params.involvedObjectKind = involvedObjectKind;
      if (involvedObjectName) params.involvedObjectName = involvedObjectName;
      if (eventType) params.eventType = eventType;
      if (clusterName) params.clusterName = clusterName;

      const response = await metricsHttp.get<KubernetesEventDto[]>(`/api/events/namespace/${namespace}`, {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Kubernetes events by namespace:', error);
      throw error;
    }
  }
}

const metricsService = new MetricsService();
export default metricsService;

