import { finopsHttp } from './httpClient';

export interface FinopsAnalysisRun {
  id: number;
  subscriptionId: string;
  subscriptionName: string;
  description: string;
  runDate: string;
  totalMonthlyCost: number;
  totalResourcesAnalyzed: number;
  aiModel: string;
  conversationId: string;
  reportFilePath: string;
  createdAt: string;
  costDetails: unknown[];
  resources: unknown[];
  aiRecommendations: unknown[];
}

export interface CostDetail {
  id: number;
  analysisRunId: number;
  costType: string;
  name: string;
  resourceGroup: string | null;
  cost: number;
  recordedAt: string;
  analysisRun: unknown;
}

export interface AiRecommendation {
  id: number;
  analysisRunId: number;
  recommendationText: string;
  summary: string;
  messageId: string;
  conversationId: string;
  model: string;
  timestamp: number;
  recordedAt: string;
  analysisRun: unknown;
}

/** Distinct subscriptions from analysis runs (FinOps SubscriptionController). */
export interface SubscriptionSummary {
  subscriptionId: string;
  subscriptionName: string;
  description?: string | null;
}

export interface CreateSubscriptionDto {
  subscriptionId: string;
  description?: string | null;
}

export interface HistoricalCostDetail {
  id: number;
  analysisRunId: number;
  subscriptionId: string;
  costDate: string;
  costType: string;
  resourceGroup: string | null;
  name: string | null;
  cost: number;
  currency: string;
  recordedAt: string;
  analysisRun: unknown;
}

/** AnalysisController: POST …/api/Analysis/start-async, GET …/api/Analysis/jobs/{jobId} */
const ANALYSIS_ASYNC_BASE = '/api/Analysis';

/** Response from start-async (camelCase from ASP.NET default JSON). */
export interface StartAnalysisAsyncResponse {
  jobId: string;
  subscriptionId: string;
  status: string;
}

/** GET jobs/{jobId} — status is pending | running | completed | failed. */
export interface AnalysisJobStatus {
  jobId: string;
  subscriptionId: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  success?: boolean | null;
  subscriptionName?: string | null;
  analysisRunId?: number | null;
  totalMonthlyCost?: number | null;
  resourcesAnalyzed?: number | null;
  message?: string | null;
  errorDetails?: string | null;
}

class FinopsService {
  async getSubscriptions(): Promise<SubscriptionSummary[]> {
    try {
      const response = await finopsHttp.get<SubscriptionSummary[]>('/api/Subscription');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch FinOps subscriptions:', error);
      throw error;
    }
  }

  async createOrUpdateSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionSummary> {
    try {
      const response = await finopsHttp.post<SubscriptionSummary>('/api/Subscriptions', dto);
      return response.data;
    } catch (error) {
      console.error('Failed to create or update FinOps subscription:', error);
      throw error;
    }
  }

  async getLatestPerSubscription(): Promise<FinopsAnalysisRun[]> {
    try {
      const response = await finopsHttp.get<FinopsAnalysisRun[]>('/api/AnalysisRuns/latest-per-subscription');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch FinOps analysis runs:', error);
      throw error;
    }
  }

  async getCostDetails(analysisRunId: number): Promise<CostDetail[]> {
    try {
      const response = await finopsHttp.get<CostDetail[]>(`/api/CostDetails/analysis/${analysisRunId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch cost details:', error);
      throw error;
    }
  }

  async getAiRecommendations(analysisRunId: number): Promise<AiRecommendation[]> {
    try {
      const response = await finopsHttp.get<AiRecommendation[]>(`/api/Recommendations/analysis/${analysisRunId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
      throw error;
    }
  }

  async getHistoricalCostDetails(analysisRunId: number): Promise<HistoricalCostDetail[]> {
    try {
      const response = await finopsHttp.get<HistoricalCostDetail[]>(`/api/HistoricalCosts/analysis/${analysisRunId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch historical cost details:', error);
      throw error;
    }
  }

  /**
   * Queues background analysis for a subscription. Body must be a JSON string per [FromBody] string.
   */
  async startAnalysisAsync(subscriptionId: string): Promise<StartAnalysisAsyncResponse> {
    const response = await finopsHttp.post<StartAnalysisAsyncResponse>(
      `${ANALYSIS_ASYNC_BASE}/start-async`,
      JSON.stringify(subscriptionId),
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  async getAnalysisJobStatus(jobId: string): Promise<AnalysisJobStatus> {
    const response = await finopsHttp.get<AnalysisJobStatus>(`${ANALYSIS_ASYNC_BASE}/jobs/${jobId}`);
    return response.data;
  }
}

export default new FinopsService();
