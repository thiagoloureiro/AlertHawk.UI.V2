import React, { useState, useEffect } from 'react';
import { X, Shield, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { MonitorHttpHeaders } from '../types';
import monitorService from '../services/monitorService';

interface SecurityHeadersModalProps {
  onClose: () => void;
  monitorId: number;
  monitorName: string;
  onEditMonitor?: () => void;
}

interface SecurityHeader {
  name: string;
  value?: string;
  description: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  present: boolean;
}

const SECURITY_HEADERS: Omit<SecurityHeader, 'value' | 'present'>[] = [
  {
    name: 'Strict-Transport-Security',
    description: 'Enforces HTTPS connections and prevents protocol downgrade attacks',
    importance: 'critical'
  },
  {
    name: 'Content-Security-Policy',
    description: 'Prevents XSS attacks by controlling resource loading',
    importance: 'critical'
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking attacks by controlling iframe embedding',
    importance: 'high'
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME type sniffing attacks',
    importance: 'high'
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer information is sent with requests',
    importance: 'medium'
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls browser features and APIs that can be used',
    importance: 'medium'
  },
  {
    name: 'Cache-Control',
    description: 'Controls caching behavior for security-sensitive content',
    importance: 'low'
  }
];

function calculateSecurityGrade(headers: SecurityHeader[]): { grade: string; score: number; color: string } {
  const criticalHeaders = headers.filter(h => h.importance === 'critical');
  const highHeaders = headers.filter(h => h.importance === 'high');
  const mediumHeaders = headers.filter(h => h.importance === 'medium');
  const lowHeaders = headers.filter(h => h.importance === 'low');

  const criticalPresent = criticalHeaders.filter(h => h.present).length;
  const highPresent = highHeaders.filter(h => h.present).length;
  const mediumPresent = mediumHeaders.filter(h => h.present).length;
  const lowPresent = lowHeaders.filter(h => h.present).length;

  // Weighted scoring: critical=4, high=3, medium=2, low=1
  const totalPossible = (criticalHeaders.length * 4) + (highHeaders.length * 3) + (mediumHeaders.length * 2) + (lowHeaders.length * 1);
  const actualScore = (criticalPresent * 4) + (highPresent * 3) + (mediumPresent * 2) + (lowPresent * 1);
  
  const percentage = totalPossible > 0 ? (actualScore / totalPossible) * 100 : 0;

  if (percentage >= 90) return { grade: 'A', score: percentage, color: 'text-green-600 dark:text-green-400' };
  if (percentage >= 80) return { grade: 'B', score: percentage, color: 'text-blue-600 dark:text-blue-400' };
  if (percentage >= 70) return { grade: 'C', score: percentage, color: 'text-yellow-600 dark:text-yellow-400' };
  if (percentage >= 60) return { grade: 'D', score: percentage, color: 'text-orange-600 dark:text-orange-400' };
  if (percentage >= 40) return { grade: 'E', score: percentage, color: 'text-red-500 dark:text-red-400' };
  return { grade: 'F', score: percentage, color: 'text-red-600 dark:text-red-500' };
}

function getHeaderIcon(header: SecurityHeader) {
  if (header.present) {
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
  
  switch (header.importance) {
    case 'critical':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'high':
      return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    case 'medium':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'low':
      return <XCircle className="w-5 h-5 text-gray-400" />;
    default:
      return <XCircle className="w-5 h-5 text-gray-400" />;
  }
}

function getImportanceColor(importance: string) {
  switch (importance) {
    case 'critical':
      return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'high':
      return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'medium':
      return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    case 'low':
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  }
}

export function SecurityHeadersModal({ onClose, monitorId, monitorName, onEditMonitor }: SecurityHeadersModalProps) {
  const [headers, setHeaders] = useState<SecurityHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecurityHeaders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await monitorService.getMonitorSecurityHeaders(monitorId);
        
        // Check if security headers monitoring is enabled
        const hasAnyHeaders = Object.values(data).some(value => value && typeof value === 'string' && value.trim() !== '');
        
        if (!hasAnyHeaders) {
          setError('Security headers monitoring is not enabled for this monitor. Please enable "Check Security Headers" in the monitor settings to analyze security headers.');
          setHeaders([]);
          return;
        }
        
        const securityHeaders: SecurityHeader[] = SECURITY_HEADERS.map(header => {
          // Map header names to API response property names
          const propertyMap: { [key: string]: keyof MonitorHttpHeaders } = {
            'strict-transport-security': 'strictTransportSecurity',
            'content-security-policy': 'contentSecurityPolicy',
            'x-frame-options': 'xFrameOptions',
            'x-content-type-options': 'xContentTypeOptions',
            'referrer-policy': 'referrerPolicy',
            'permissions-policy': 'permissionsPolicy',
            'cache-control': 'cacheControl'
          };
          
          const propertyName = propertyMap[header.name.toLowerCase()];
          const value = propertyName ? data[propertyName] as string : undefined;
          
          return {
            ...header,
            value,
            present: !!value
          };
        });
        
        setHeaders(securityHeaders);
      } catch (err) {
        console.error('Failed to fetch security headers:', err);
        setError('Failed to load security headers. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityHeaders();
  }, [monitorId]);

  const grade = calculateSecurityGrade(headers);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl max-h-[90vh] dark:bg-gray-800 bg-white rounded-lg shadow-lg flex flex-col">
        <div className="flex-none flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold dark:text-white">
                Security Headers Analysis
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {monitorName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading security headers...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Retry
                  </button>
                  {onEditMonitor && (
                    <button
                      onClick={() => {
                        onClose();
                        onEditMonitor();
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Edit Monitor
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {/* Security Grade */}
              <div className="mb-8">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${grade.color} mb-2`}>
                    {grade.grade}
                  </div>
                  <div className="text-lg text-gray-600 dark:text-gray-400">
                    Security Score: {Math.round(grade.score)}%
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {grade.grade === 'A' && 'Excellent! Your security headers are well configured.'}
                      {grade.grade === 'B' && 'Good security posture with minor improvements needed.'}
                      {grade.grade === 'C' && 'Fair security configuration with room for improvement.'}
                      {grade.grade === 'D' && 'Below average security configuration. Consider adding more headers.'}
                      {grade.grade === 'E' && 'Poor security configuration. Multiple critical headers missing.'}
                      {grade.grade === 'F' && 'Very poor security configuration. Immediate action required.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Headers List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold dark:text-white mb-4">
                  Security Headers Status
                </h3>
                {headers.map((header, index) => (
                  <div
                    key={index}
                    className="p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {getHeaderIcon(header)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium dark:text-white text-gray-900">
                            {header.name}
                          </h4>
                          <span className={`px-2 py-1 text-xs rounded-full border ${getImportanceColor(header.importance)}`}>
                            {header.importance.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            header.present 
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                          }`}>
                            {header.present ? 'PRESENT' : 'MISSING'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {header.description}
                        </p>
                        {header.value && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Value:</p>
                            <code className="block p-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-xs font-mono break-all">
                              {header.value}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-400 mb-2">
                  Recommendations
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• Ensure all critical headers are present for maximum security</li>
                  <li>• Configure Content-Security-Policy with appropriate directives</li>
                  <li>• Set Strict-Transport-Security with appropriate max-age</li>
                  <li>• Consider adding additional security headers based on your application needs</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
