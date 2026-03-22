// @ts-expect-error - No type definitions for markdown-it
import MarkdownIt from 'markdown-it';
import { useEffect, useState } from 'react';
import { X, Sparkles, AlertCircle, Bot } from 'lucide-react';
import { LoadingSpinner } from './ui';
import finopsService, { AiRecommendation } from '../services/finopsService';

const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

interface AiRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisRunId: number;
  subscriptionName: string;
}

function RecommendationCard({ rec }: { rec: AiRecommendation }) {
  const html = md.render(rec.recommendationText);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 overflow-x-auto">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
        <Bot className="w-5 h-5 text-purple-500 flex-none" />
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
          {rec.model}
        </span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {new Date(rec.recordedAt).toLocaleString()}
        </span>
      </div>

      {/* Full markdown body — descendant selectors: markdown-it nests <p> inside <li>, so [&>p] misses dark mode */}
      <div
        className="markdown-body px-5 py-5 prose prose-sm max-w-none text-gray-700 dark:text-gray-300
          dark:prose-invert
          [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:dark:text-white [&_h1]:mt-5 [&_h1]:mb-2
          [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:dark:text-white [&_h2]:mt-5 [&_h2]:mb-2
          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:dark:text-gray-100 [&_h3]:mt-4 [&_h3]:mb-1.5
          [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-gray-700 [&_h4]:dark:text-gray-200 [&_h4]:mt-3 [&_h4]:mb-1
          [&_p]:text-sm [&_p]:text-gray-700 [&_p]:dark:text-gray-300 [&_p]:mb-3 [&_p]:leading-relaxed
          [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3
          [&_li]:text-sm [&_li]:text-gray-700 [&_li]:dark:text-gray-300 [&_li]:mb-1 [&_li]:marker:text-gray-500 [&_li]:dark:marker:text-gray-400
          [&_li_p]:mb-1 [&_li_p]:text-inherit [&_li_p]:dark:text-inherit
          [&_span]:text-inherit [&_span]:dark:text-inherit
          [&_div]:text-inherit [&_div]:dark:text-inherit
          [&_em]:text-gray-700 [&_em]:dark:text-gray-300
          [&_a]:text-purple-600 [&_a]:dark:text-purple-300 [&_a]:underline
          [&_blockquote]:border-l-4 [&_blockquote]:border-purple-300 [&_blockquote]:dark:border-purple-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400
          [&_hr]:border-gray-200 [&_hr]:dark:border-gray-700 [&_hr]:my-4
          [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:mb-4
          [&_th]:bg-gray-100 [&_th]:dark:bg-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-700 [&_th]:dark:text-gray-300 [&_th]:border [&_th]:border-gray-200 [&_th]:dark:border-gray-600
          [&_td]:px-3 [&_td]:py-2 [&_td]:text-gray-700 [&_td]:dark:text-gray-300 [&_td]:border [&_td]:border-gray-200 [&_td]:dark:border-gray-600
          [&_tr:nth-child(even)_td]:bg-gray-50 [&_tr:nth-child(even)_td]:dark:bg-gray-800/30
          [&_strong]:font-semibold [&_strong]:text-gray-900 [&_strong]:dark:text-white
          [&_b]:font-semibold [&_b]:text-gray-900 [&_b]:dark:text-white
          [&_code]:bg-gray-100 [&_code]:dark:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-purple-700 [&_code]:dark:text-purple-300"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function AiRecommendationsModal({
  isOpen,
  onClose,
  analysisRunId,
  subscriptionName,
}: AiRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setRecommendations([]);
      try {
        const data = await finopsService.getAiRecommendations(analysisRunId);
        setRecommendations(data);
      } catch {
        setError('Failed to load AI recommendations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, analysisRunId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-none">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Recommendations</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subscriptionName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-6 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 flex items-center gap-3 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && recommendations.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              No AI recommendations found for this analysis run.
            </div>
          )}

          {!isLoading && !error && recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      </div>
    </div>
  );
}
