/** Maps Azure resource provider namespaces to product-style labels. */
export const AZURE_NAMESPACE_LABELS: Record<string, string> = {
  'Microsoft.OperationalInsights': 'Log Analytics',
  'Microsoft.Compute': 'Virtual Machines',
  'Microsoft.Storage': 'Storage',
  'Microsoft.Network': 'Networking',
  'Microsoft.Sql': 'SQL Database',
  'Microsoft.DocumentDB': 'Cosmos DB',
  'Microsoft.Web': 'App Service',
  'Microsoft.KeyVault': 'Key Vault',
  'Microsoft.Insights': 'Azure Monitor',
  'microsoft.insights': 'Azure Monitor',
  'Microsoft.DBforPostgreSQL': 'PostgreSQL',
  'Microsoft.DBforMySQL': 'MySQL',
  'Microsoft.Cache': 'Redis Cache',
  'Microsoft.ContainerService': 'Kubernetes Service (AKS)',
  'Microsoft.ContainerRegistry': 'Container Registry',
  'Microsoft.ServiceBus': 'Service Bus',
  'Microsoft.EventHub': 'Event Hubs',
  'Microsoft.Logic': 'Logic Apps',
  'Microsoft.StreamAnalytics': 'Stream Analytics',
  'Microsoft.DataFactory': 'Data Factory',
  'Microsoft.Search': 'Azure AI Search',
  'Microsoft.AnalysisServices': 'Analysis Services',
  'Microsoft.MachineLearningServices': 'Machine Learning',
  'Microsoft.CognitiveServices': 'Cognitive Services',
  'Microsoft.Media': 'Media Services',
  'Microsoft.BotService': 'Bot Service',
  'Microsoft.SignalRService': 'SignalR',
  'Microsoft.Automation': 'Automation',
  'Microsoft.RecoveryServices': 'Backup',
  'Microsoft.Databricks': 'Databricks',
  'Microsoft.Synapse': 'Synapse Analytics',
  'Microsoft.PowerBIDedicated': 'Power BI',
  'Microsoft.ApiManagement': 'API Management',
  'Microsoft.EventGrid': 'Event Grid',
  'Microsoft.NotificationHubs': 'Notification Hubs',
  'Microsoft.Relay': 'Relay',
  'Microsoft.TimeSeriesInsights': 'Time Series Insights',
  'Microsoft.DigitalTwins': 'Digital Twins',
  'Microsoft.IoTCentral': 'IoT Central',
  'Microsoft.Devices': 'IoT Hub',
  'Microsoft.Maps': 'Azure Maps',
  'Microsoft.Cdn': 'CDN',
  'Microsoft.FrontDoor': 'Front Door',
};

function formatNamespaceFallback(ns: string): string {
  return ns.replace(/^Microsoft\./, '').replace(/\./g, ' ');
}

/**
 * Groups individual service/meter rows into a product-style label (e.g. Log Analytics)
 * from ARM-style names or Microsoft.* provider strings.
 */
export function deriveServiceTypeLabel(rawName: string | null | undefined): string {
  const trimmed = rawName?.trim();
  if (!trimmed) return 'Other';

  const armMatch = trimmed.match(/\/providers\/([^/]+)\//i);
  if (armMatch) {
    const ns = armMatch[1];
    return AZURE_NAMESPACE_LABELS[ns] ?? formatNamespaceFallback(ns);
  }

  const slashIdx = trimmed.indexOf('/');
  if (slashIdx > 0 && trimmed.startsWith('Microsoft.')) {
    const ns = trimmed.slice(0, slashIdx);
    return AZURE_NAMESPACE_LABELS[ns] ?? formatNamespaceFallback(ns);
  }

  if (trimmed.startsWith('Microsoft.')) {
    return AZURE_NAMESPACE_LABELS[trimmed] ?? formatNamespaceFallback(trimmed);
  }

  return trimmed;
}

/** Application ID from Azure-style tags.GAR_ID. */
export function garIdFromTags(
  tags?: Record<string, string | null | undefined> | null,
): string {
  if (!tags) return '';
  const raw = tags.GAR_ID ?? tags.gar_id;
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim();
}
