import { finopsHttp } from './httpClient';

export interface FinopsAnalysisRun {
  id: number;
  subscriptionId: string;
  subscriptionName: string;
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

class FinopsService {
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
}

export default new FinopsService();
