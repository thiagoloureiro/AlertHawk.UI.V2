import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, RefreshCw, Search, Download } from 'lucide-react';
import { PodLog } from '../types';
import metricsService from '../services/metricsService';
import { LoadingSpinner } from './ui';
import { toast } from 'react-hot-toast';

interface PodLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  namespace: string;
  pod: string;
  container: string;
  clusterName?: string;
  hours?: number; // Keep for backward compatibility, but will be converted to minutes
}

export function PodLogModal({ 
  isOpen, 
  onClose, 
  namespace, 
  pod, 
  container, 
  clusterName,
  hours = 30 // This is now minutes, keeping prop name for backward compatibility
}: PodLogModalProps) {
  const [logs, setLogs] = useState<PodLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [matches, setMatches] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    } else {
      setLogs([]);
      setSearchQuery('');
      setHighlightIndex(-1);
      setMatches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, namespace, pod, container, clusterName, hours]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const logData = await metricsService.getPodLogs(namespace, container, hours, clusterName);
      setLogs(logData);
    } catch (error) {
      console.error('Failed to fetch pod logs:', error);
      toast.error('Failed to load pod logs', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
    }
  };

  const logContent = logs.length > 0 ? logs[0].logContent : '';

  const handleCopy = async () => {
    if (!logContent) return;
    
    try {
      await navigator.clipboard.writeText(logContent);
      setCopied(true);
      toast.success('Logs copied to clipboard', { position: 'bottom-right' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
      toast.error('Failed to copy logs', { position: 'bottom-right' });
    }
  };

  const handleDownload = () => {
    if (!logContent) return;

    try {
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pod}-${container}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Logs downloaded successfully', { position: 'bottom-right' });
    } catch (error) {
      console.error('Failed to download logs:', error);
      toast.error('Failed to download logs', { position: 'bottom-right' });
    }
  };

  // Filter and highlight search results
  const filteredLogContent = useMemo(() => {
    if (!logContent) return '';
    if (!searchQuery.trim()) return logContent;

    const lines = logContent.split('\n');
    const query = searchQuery.toLowerCase();
    const matchIndices: number[] = [];
    const filteredLines = lines.map((line, index) => {
      if (line.toLowerCase().includes(query)) {
        matchIndices.push(index);
        return line;
      }
      return line;
    });

    setMatches(matchIndices);
    if (matchIndices.length > 0 && highlightIndex === -1) {
      setHighlightIndex(0);
    }

    return filteredLines.join('\n');
  }, [logContent, searchQuery]);

  // Highlight search matches in the log content
  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim() || !filteredLogContent) {
      return filteredLogContent;
    }

    const query = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = filteredLogContent.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        return <mark key={index} className="bg-yellow-500 dark:bg-yellow-600 text-gray-900">{part}</mark>;
      }
      return <span key={index}>{part}</span>;
    });
  }, [filteredLogContent, searchQuery]);

  const handleSearchNext = () => {
    if (matches.length === 0) return;
    setHighlightIndex((prev) => (prev + 1) % matches.length);
  };

  const handleSearchPrev = () => {
    if (matches.length === 0) return;
    setHighlightIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSearchPrev();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchNext();
    }
  };

  // Scroll to highlighted match
  useEffect(() => {
    if (highlightIndex >= 0 && matches.length > 0) {
      const logContainer = document.querySelector('.log-content-container');
      if (logContainer) {
        const lines = filteredLogContent.split('\n');
        const targetLine = matches[highlightIndex];
        const lineHeight = 16; // Approximate line height in pixels (text-xs)
        const scrollPosition = targetLine * lineHeight;
        logContainer.scrollTo({
          top: Math.max(0, scrollPosition - 100), // Offset to show some context
          behavior: 'smooth'
        });
      }
    }
  }, [highlightIndex, matches, filteredLogContent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-semibold dark:text-white text-gray-900">Pod Logs</h2>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{pod}</span>
              <span className="mx-2">•</span>
              <span>{namespace}</span>
              <span className="mx-2">•</span>
              <span>{container}</span>
              {clusterName && (
                <>
                  <span className="mx-2">•</span>
                  <span>{clusterName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {logContent && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Download logs as text file"
                >
                  <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy logs"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {logContent && !isLoading && (
          <div className="px-6 py-3 border-b dark:border-gray-700 border-gray-200">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search logs..."
                  className="w-full pl-10 pr-20 py-2 text-sm dark:bg-gray-700 bg-gray-100 border 
                           dark:border-gray-600 border-gray-300 rounded-lg 
                           dark:text-white text-gray-900 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && matches.length > 0 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {highlightIndex + 1} / {matches.length}
                    </span>
                    <button
                      onClick={handleSearchPrev}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-400"
                      title="Previous"
                    >
                      ↑
                    </button>
                    <button
                      onClick={handleSearchNext}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-400"
                      title="Next"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 min-h-0 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 z-10 flex items-center justify-center rounded-lg">
              <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg p-4 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium dark:text-white text-gray-900">Refreshing logs...</span>
              </div>
            </div>
          )}
          {!logContent && !isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p>No logs available</p>
            </div>
          ) : logContent ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-900 dark:bg-black rounded-lg p-4 scroll-smooth log-content-container">
              {searchQuery.trim() ? (
                <div className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
                  {highlightedContent}
                </div>
              ) : (
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words m-0">
                  {filteredLogContent}
                </pre>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

