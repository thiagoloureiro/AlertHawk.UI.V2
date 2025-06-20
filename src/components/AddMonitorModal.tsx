import React, { useState, useEffect, useMemo } from 'react';
import { X, Globe, Network, Plus, Loader2, Server } from 'lucide-react';
import { Select, Switch, Textarea } from './ui';
import monitorService, { MonitorRegion } from '../services/monitorService';
import type { UpdateMonitorHttpPayload, UpdateMonitorTcpPayload } from '../services/monitorService';
import type { Monitor } from '../types';

interface AddMonitorModalProps {
  onClose: () => void;
  onAdd: (monitor: UpdateMonitorHttpPayload | UpdateMonitorTcpPayload) => Promise<void>;
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

const monitorTypes = [
  { id: 'http', label: 'HTTP(S)', icon: Globe },
  { id: 'tcp', label: 'TCP', icon: Network },
  { id: 'k8s', label: 'Kubernetes', icon: Server }
];

interface MonitorK8sPayload {
  monitorId: number;
  clusterName: string;
  kubeConfig: string;
  lastStatus: boolean;
  name: string;
  monitorGroup: number;
  monitorRegion: number;
  monitorEnvironment: number;
  heartBeatInterval: number;
  retries: number;
  timeout: number;
}

export function AddMonitorModal({ onClose, onAdd, onUpdate, existingMonitor, isEditing }: AddMonitorModalProps) {
  
  const [monitorType, setMonitorType] = useState<'http' | 'tcp' | 'k8s'>(
    existingMonitor?.monitorTypeId === 3 ? 'tcp' : 
    existingMonitor?.monitorTypeId === 4 ? 'k8s' : 'http'
  );
  

  const [name, setName] = useState(existingMonitor?.name || '');
  const [url, setUrl] = useState(
    existingMonitor?.monitorTypeId === 3 
      ? existingMonitor.monitorTcp?.IP ?? ''
      : existingMonitor?.urlToCheck ?? ''
  );
  const [port, setPort] = useState(
    existingMonitor?.monitorTypeId === 3 
      ? existingMonitor.monitorTcp?.port?.toString() ?? ''
    : ''
  );
  const [interval, setInterval] = useState(existingMonitor?.heartBeatInterval?.toString() || '1');
  const [retries, setRetries] = useState(existingMonitor?.retries?.toString() || '3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [environment, setEnvironment] = useState(existingMonitor?.monitorEnvironment || MonitorEnvironment.Production);
  const [checkCertExpiry, setCheckCertExpiry] = useState(existingMonitor?.checkCertExpiry ?? true);
  const [ignoreTLS, setIgnoreTLS] = useState(existingMonitor && 'ignoreTlsSsl' in existingMonitor ? (existingMonitor as any).ignoreTlsSsl : false);
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [maxRedirects, setMaxRedirects] = useState((existingMonitor as any)?.maxRedirects?.toString() ?? '3');
  const [timeout, setTimeout] = useState((existingMonitor as any)?.timeout?.toString() ?? '30');
  const [body, setBody] = useState('');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(
    isEditing && existingMonitor?.monitorGroup ? existingMonitor.monitorGroup : 0
  );
  const [regions, setRegions] = useState<number[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(existingMonitor?.monitorRegion || 0);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [showHeaderForm, setShowHeaderForm] = useState(false);
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [clusterName, setClusterName] = useState(existingMonitor?.monitorK8s?.clusterName || '');
  const [kubeConfig, setKubeConfig] = useState<File | null>(null);
  const [existingKubeConfig] = useState(existingMonitor?.monitorK8s?.kubeConfig || '');

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groups = await monitorService.getMonitorGroupListByUser();
        setGroups(groups);
        if (isEditing && existingMonitor?.monitorGroup) {
          setSelectedGroupId(existingMonitor.monitorGroup);
        } else if (groups.length > 0 && !isEditing) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch monitor groups:', error);
      }
    };

    fetchGroups();
  }, [existingMonitor, isEditing]);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const agents = await monitorService.getMonitorAgents();
        const uniqueRegions = [...new Set(agents.map(agent => agent.monitorRegion))];
        setRegions(uniqueRegions);
        
        if (existingMonitor?.monitorRegion) {
          setSelectedRegion(existingMonitor.monitorRegion);
        } else if (uniqueRegions.length > 0) {
          setSelectedRegion(uniqueRegions[0]);
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error);
      }
    };

    fetchRegions();
  }, [existingMonitor]);

  useEffect(() => {
    if (httpMethod === 'GET') {
      setBody('');
    }
  }, [httpMethod]);

  // Helper to extract monitorHttpMethod from Monitor
  function getMonitorHttpMethod(monitor: Monitor | undefined): number | undefined {
    if (!monitor) return undefined;
    // @ts-expect-error: monitorHttpMethod may be present on some monitor objects
    if ('monitorHttpMethod' in monitor && typeof (monitor as any).monitorHttpMethod !== 'undefined') return (monitor as any).monitorHttpMethod;
    return undefined;
  }

  // Set httpMethod from existingMonitor when editing an HTTP monitor
  useEffect(() => {
    if (
      existingMonitor &&
      (existingMonitor.monitorTypeId === 1 || existingMonitor.monitorTypeId === undefined)
    ) {
      const methodNum = getMonitorHttpMethod(existingMonitor);
      if (methodNum === 2) setHttpMethod('POST');
      else if (methodNum === 3) setHttpMethod('PUT');
      else if (methodNum === 1) setHttpMethod('GET');
    }
  }, [existingMonitor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const basePayload = {
        name,
        monitorGroup: selectedGroupId,
        monitorRegion: selectedRegion,
        monitorEnvironment: environment,
        heartBeatInterval: parseInt(interval),
        retries: parseInt(retries),
        status: true,
      };

      if (monitorType === 'k8s') {
        // Handle file reading and base64 conversion
        let base64Content = '';
        if (kubeConfig) {
          const fileContent = await kubeConfig.text();
          base64Content = btoa(fileContent);
        } else if (existingKubeConfig && !isEditing) {
          // Only require existing config for new monitors
          base64Content = existingKubeConfig;
        } else if (!isEditing) {
          throw new Error('KubeConfig file is required for new monitors');
        }

        const k8sPayload = {
          Id: existingMonitor?.id || 0,
          MonitorId: existingMonitor?.id || 0,
          MonitorTypeId: 4,
          MonitorType: {
            Id: 4,
            Name: "Kubernetes"
          },
          Name: name,
          HeartBeatInterval: parseInt(interval),
          Retries: parseInt(retries),
          Status: true,
          DaysToExpireCert: 30,
          Paused: false,
          UrlToCheck: "",
          CheckCertExpiry: false,
          MonitorGroup: selectedGroupId,
          MonitorRegion: selectedRegion,
          ClusterName: clusterName,
          KubeConfig: base64Content || '',
          LastStatus: true,
          MonitorEnvironment: environment,
          Base64Content: base64Content || '',
        };

        if (isEditing && onUpdate) {
          await monitorService.updateMonitorK8s(k8sPayload);
        } else {
          await monitorService.createMonitorK8s(k8sPayload);
        }
      } else if (monitorType === 'tcp') {
        const tcpPayload: UpdateMonitorTcpPayload = {
          ...basePayload,
          monitorId: existingMonitor?.id || 0,
          id: existingMonitor?.id || 0,
          port: parseInt(port),
          ip: url,
          timeout: parseInt(timeout),
          ignoreTlsSsl: ignoreTLS,
          checkCertExpiry: false,
          daysToExpireCert: 0,
          paused: false,
          part: 0,
          monitorTypeId: 3,
          lastStatus: true
        };
        
        if (isEditing && onUpdate) {
          await onUpdate(tcpPayload);
        } else {
          await onAdd(tcpPayload);
        }
      } else {
        const httpPayload: UpdateMonitorHttpPayload = {
          ...basePayload,
          monitorId: existingMonitor?.id || 0,
          id: existingMonitor?.id || 0,
          urlToCheck: url,
          ignoreTlsSsl: ignoreTLS,
          maxRedirects: parseInt(maxRedirects),
          timeout: parseInt(timeout),
          monitorHttpMethod: httpMethod === 'POST' ? 2 : httpMethod === 'PUT' ? 3 : 1,
          body,
          checkCertExpiry,
          daysToExpireCert: 0,
          paused: false,
          responseStatusCode: 200,
          responseTime: 0,
          lastStatus: true,
          monitorTypeId: 1
        };

        if (isEditing && onUpdate) {
          await onUpdate(httpPayload);
        } else {
          await onAdd(httpPayload);
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to submit monitor:', error);
    } finally {
      setIsSubmitting(false);
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
              <div className="flex gap-2 mb-6">
                {monitorTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setMonitorType(type.id as 'http' | 'tcp' | 'k8s')}
                    disabled={isEditing}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors duration-200 
                              flex items-center justify-center gap-2 relative
                              ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}
                              ${monitorType === type.id
                                ? 'border-blue-500 dark:bg-blue-900/20 bg-blue-50'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-500'}`}
                  >
                    <type.icon className={`w-5 h-5 ${
                      monitorType === type.id
                        ? 'text-blue-500'
                        : 'text-gray-500 dark:text-gray-400'
                    }`} />
                    <span className={`font-medium ${
                      monitorType === type.id
                        ? 'text-blue-500'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {type.label}
                    </span>
                    {type.id === 'k8s' && (
                      <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 
                                    text-yellow-800 dark:text-yellow-500 text-xs rounded-full border border-yellow-300 
                                    dark:border-yellow-700/50">
                        Beta
                      </span>
                    )}
                  </button>
                ))}
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
                {isEditing ? (
                  <div className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                                 dark:text-white bg-gray-100 dark:bg-gray-800 cursor-not-allowed">
                    {sortedGroups.find(g => g.id === selectedGroupId)?.name || 'Unknown Group'}
                  </div>
                ) : (
                  <Select
                    value={selectedGroupId}
                    onValueChange={(value) => setSelectedGroupId(Number(value))}
                  >
                    {sortedGroups.map(group => (
                      <Select.Item key={group.id} value={group.id.toString()}>
                        {group.name}
                      </Select.Item>
                    ))}
                  </Select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Region
                </label>
                <Select
                  value={selectedRegion.toString()}
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

              {(monitorType === 'http' || monitorType === 'tcp') && (
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    {monitorType === 'http' ? 'URL' : 'IP'}
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
              )}

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

              {monitorType === 'k8s' && (
                <>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Cluster Name
                    </label>
                    <input
                      type="text"
                      value={clusterName}
                      onChange={(e) => setClusterName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                               dark:text-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      KubeConfig File
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".yaml,.yml"
                        onChange={(e) => setKubeConfig(e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                                 dark:text-white focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 
                                 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold
                                 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100
                                 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                        required={!isEditing}
                      />
                      {kubeConfig && (
                        <button
                          onClick={() => setKubeConfig(null)}
                          className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 
                                   dark:hover:text-red-400 transition-colors"
                          title="Remove file"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Upload your kubeconfig YAML file
                    </p>
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
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
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