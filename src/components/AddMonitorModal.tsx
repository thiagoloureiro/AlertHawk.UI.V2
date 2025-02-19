import React, { useState, useEffect } from 'react';
import { X, Globe, Network, Plus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Select, Switch, Textarea } from './ui';
import monitorService from '../services/monitorService';
import { MonitorRegion } from '../services/monitorService';
import { UpdateMonitorHttpPayload, UpdateMonitorTcpPayload } from '../services/monitorService';
import { Monitor } from '../services/monitorService';

interface AddMonitorModalProps {
  onClose: () => void;
  onAdd: (monitor: any) => Promise<void>;
  onUpdate?: (monitor: UpdateMonitorHttpPayload | UpdateMonitorTcpPayload) => Promise<void>;
  existingMonitor?: Monitor;
  isEditing?: boolean;
}

export enum MonitorEnvironment {
  Development = 1,
  Staging = 2,
  QA = 3,
  Testing = 4,
  PreProd = 5,
  Production = 6
}

interface Header {
  name: string;
  value: string;
}

export function AddMonitorModal({ onClose, onAdd, onUpdate, existingMonitor, isEditing }: AddMonitorModalProps) {
  const [monitorType, setMonitorType] = useState<'http' | 'tcp'>(
    existingMonitor?.monitorTypeId === 3 ? 'tcp' : 'http'
  );
  const [name, setName] = useState(existingMonitor?.name || '');
  const [url, setUrl] = useState(
    existingMonitor?.monitorTypeId === 3 
      ? existingMonitor.monitorTcp?.host ?? ''
      : existingMonitor?.urlToCheck ?? ''
  );
  const [port, setPort] = useState(
    existingMonitor?.monitorTypeId === 3 
      ? existingMonitor.monitorTcp?.port?.toString() ?? ''
    : ''
  );
  const [interval, setInterval] = useState(existingMonitor?.heartBeatInterval.toString() || '5');
  const [retries, setRetries] = useState(existingMonitor?.retries.toString() || '3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [environment, setEnvironment] = useState(existingMonitor?.monitorEnvironment || MonitorEnvironment.Production);
  const [checkCertExpiry, setCheckCertExpiry] = useState(existingMonitor?.checkCertExpiry ?? true);
  const [ignoreTLS, setIgnoreTLS] = useState(existingMonitor?.ignoreTlsSsl ?? false);
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [maxRedirects, setMaxRedirects] = useState(existingMonitor?.maxRedirects?.toString() || '3');
  const [timeout, setTimeout] = useState(existingMonitor?.timeout?.toString() || '30');
  const [body, setBody] = useState('');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(existingMonitor?.monitorGroup || 0);
  const [regions, setRegions] = useState<number[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(existingMonitor?.monitorRegion || MonitorRegion.Europe);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [showHeaderForm, setShowHeaderForm] = useState(false);
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groups = await monitorService.getMonitorGroupList();
        setGroups(groups);
        if (groups.length > 0) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch monitor groups:', error);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const agents = await monitorService.getMonitorAgents();
        const uniqueRegions = [...new Set(agents.map(a => a.monitorRegion))];
        setRegions(uniqueRegions);
        if (uniqueRegions.length > 0) {
          setSelectedRegion(uniqueRegions[0]);
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error);
      }
    };

    fetchRegions();
  }, []);

  useEffect(() => {
    if (httpMethod === 'GET') {
      setBody('');
    }
  }, [httpMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      if (isEditing && existingMonitor) {
        if (monitorType === 'tcp') {
          const updatePayload: UpdateMonitorTcpPayload = {
            monitorId: existingMonitor.id,
            id: existingMonitor.id,
            port: parseInt(port),
            ip: url,
            timeout: parseInt(timeout),
            lastStatus: existingMonitor.status,
            monitorTypeId: 3,
            name,
            heartBeatInterval: parseInt(interval),
            retries: parseInt(retries),
            status: true,
            daysToExpireCert: existingMonitor.daysToExpireCert,
            paused: existingMonitor.paused,
            monitorRegion: selectedRegion,
            monitorEnvironment: environment,
            checkCertExpiry: false,
            monitorGroup: selectedGroupId,
            ignoreTlsSsl: false,
            part: parseInt(port)
          };
          await onUpdate?.(updatePayload);
        } else {
          const updatePayload: UpdateMonitorHttpPayload = {
            monitorId: existingMonitor.id,
            id: existingMonitor.id,
            ignoreTlsSsl: ignoreTLS,
            maxRedirects: parseInt(maxRedirects),
            urlToCheck: url,
            responseStatusCode: 0,
            timeout: parseInt(timeout),
            lastStatus: existingMonitor.status,
            responseTime: 0,
            monitorHttpMethod: 1,
            body: body || '',
            monitorTypeId: 1,
            name,
            heartBeatInterval: parseInt(interval),
            retries: parseInt(retries),
            status: true,
            daysToExpireCert: existingMonitor.daysToExpireCert,
            paused: existingMonitor.paused,
            monitorRegion: selectedRegion,
            monitorEnvironment: environment,
            checkCertExpiry,
            monitorGroup: selectedGroupId
          };
          await onUpdate?.(updatePayload);
        }
      } else {
        const basePayload = {
          name,
          monitorGroup: selectedGroupId,
          monitorRegion: selectedRegion,
          monitorEnvironment: environment,
          heartBeatInterval: parseInt(interval),
          timeout: parseInt(timeout),
          retries: parseInt(retries),
          status: true,
        };

        if (monitorType === 'tcp') {
          const tcpPayload: CreateMonitorTcpPayload = {
            ...basePayload,
            monitorTypeId: 3,
            ip: url,  // URL field contains the IP for TCP
            port: parseInt(port),
            part: parseInt(port)  // API requires both port and part
          };
          await onAdd(tcpPayload);
        } else {
          const httpPayload: CreateMonitorHttpPayload = {
            ...basePayload,
            monitorTypeId: 1,
            monitorHttpMethod: httpMethod === 'GET' ? 1 : httpMethod === 'POST' ? 2 : 3,
            checkCertExpiry,
            ignoreTlsSsl: ignoreTLS,
            urlToCheck: url,
            maxRedirects: parseInt(maxRedirects),
            body: body || ''
          };
          await onAdd(httpPayload);
        }
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl max-h-[90vh] dark:bg-gray-800 bg-white rounded-lg shadow-lg flex flex-col">
        <div className="flex-none flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-medium dark:text-white">
            {isEditing ? 'Edit Monitor' : 'Add New Monitor'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMonitorType('http')}
                  className={cn(
                    "p-3 rounded-lg flex items-center gap-2 border transition-colors dark:text-white",
                    monitorType === 'http'
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <Globe className="w-5 h-5" />
                  <span>HTTP(S)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorType('tcp')}
                  className={cn(
                    "p-3 rounded-lg flex items-center gap-2 border transition-colors dark:text-white",
                    monitorType === 'tcp'
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <Network className="w-5 h-5" />
                  <span>TCP</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Monitor Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Group
                </label>
                <Select
                  value={selectedGroupId}
                  onValueChange={(value) => setSelectedGroupId(Number(value))}
                >
                  {groups.map((group) => (
                    <Select.Item key={group.id} value={group.id.toString()}>
                      {group.name}
                    </Select.Item>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Region
                </label>
                <Select
                  value={selectedRegion}
                  onValueChange={(value) => setSelectedRegion(Number(value))}
                >
                  {regions.map((region) => (
                    <Select.Item key={region} value={region.toString()}>
                      {MonitorRegion[region] || `Region ${region}`}
                    </Select.Item>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Environment
                </label>
                <Select
                  value={environment}
                  onValueChange={(value) => setEnvironment(Number(value) as MonitorEnvironment)}
                >
                  {Object.entries(MonitorEnvironment)
                    .filter(([key]) => isNaN(Number(key)))
                    .map(([name, value]) => (
                      <Select.Item key={value} value={value.toString()}>
                        {name}
                      </Select.Item>
                    ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  {monitorType === 'http' ? 'URL' : 'Host'}
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={monitorType === 'http' ? 'https://example.com' : 'Hostname or IP'}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {monitorType === 'tcp' && (
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Check Interval (minutes)
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Retries before alert
                </label>
                <input
                  type="number"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {monitorType === 'http' && (
                <>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Check Cert Expiry
                    </label>
                    <Switch
                      checked={checkCertExpiry}
                      onCheckedChange={(checked) => setCheckCertExpiry(checked)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Ignore TLS
                    </label>
                    <Switch
                      checked={ignoreTLS}
                      onCheckedChange={(checked) => setIgnoreTLS(checked)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      HTTP Method
                    </label>
                    <Select
                      value={httpMethod}
                      onValueChange={(value) => setHttpMethod(value as 'GET' | 'POST' | 'PUT')}
                    >
                      <Select.Item value="GET">GET</Select.Item>
                      <Select.Item value="POST">POST</Select.Item>
                      <Select.Item value="PUT">PUT</Select.Item>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Max Redirects
                    </label>
                    <input
                      type="number"
                      value={maxRedirects}
                      onChange={(e) => setMaxRedirects(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                               dark:text-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      HTTP Body {httpMethod === 'GET' && '(GET methods do not support body)'}
                    </label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      placeholder="Enter request body (JSON, form data, etc.)"
                      className="font-mono text-sm w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                                dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={httpMethod === 'GET'}
                      readOnly={false}
                    />
                    <p className="mt-1 text-xs dark:text-gray-400 text-gray-600">
                      For JSON, ensure the content is properly formatted. Example:
                      {`
{
  "key": "value",
  "array": [1, 2, 3],
  "nested": {
    "field": "value"
  }
}`}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium dark:text-gray-300">
                        Headers
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHeaderForm(true)}
                        className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                                 flex items-center gap-2 transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4" />
                        Add Header
                      </button>
                    </div>

                    {headers.length > 0 && (
                      <div className="space-y-2">
                        {headers.map((header, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 rounded-lg dark:bg-gray-700/50 bg-gray-50"
                          >
                            <span className="flex-1 font-mono text-sm">{header.name}: {header.value}</span>
                            <button
                              type="button"
                              onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
                              className="p-1 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showHeaderForm && (
                      <div className="p-3 border dark:border-gray-700 rounded-lg space-y-3">
                        <div>
                          <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                            Header Name
                          </label>
                          <input
                            type="text"
                            value={headerName}
                            onChange={(e) => setHeaderName(e.target.value)}
                            placeholder="Content-Type"
                            className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                                     dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                            Header Value
                          </label>
                          <input
                            type="text"
                            value={headerValue}
                            onChange={(e) => setHeaderValue(e.target.value)}
                            placeholder="application/json"
                            className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                                     dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderForm(false);
                              setHeaderName('');
                              setHeaderValue('');
                            }}
                            className="px-3 py-1 text-sm dark:bg-gray-700 bg-gray-100
                                     dark:text-white text-gray-900 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (headerName && headerValue) {
                                setHeaders([...headers, { name: headerName, value: headerValue }]);
                                setHeaderName('');
                                setHeaderValue('');
                                setShowHeaderForm(false);
                              }
                            }}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!headerName || !headerValue}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-none border-t dark:border-gray-700 p-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditing ? 'Update Monitor' : 'Add Monitor'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 