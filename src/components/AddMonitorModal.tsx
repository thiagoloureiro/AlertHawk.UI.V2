import React, { useState, useEffect, useMemo } from 'react';
import { X, Globe, Network, Plus, Server, Check } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { Select, Switch, Textarea } from './ui';
import monitorService, { MonitorRegion } from '../services/monitorService';
import type { UpdateMonitorHttpPayload, UpdateMonitorTcpPayload } from '../services/monitorService';
import type { Monitor } from '../types';
import { toast } from 'react-hot-toast';

interface AddMonitorModalProps {
  onClose: () => void;
  onAdd: (monitor: UpdateMonitorHttpPayload | UpdateMonitorTcpPayload | any) => Promise<void>;
  onUpdate?: (monitor: UpdateMonitorHttpPayload | UpdateMonitorTcpPayload | any) => Promise<void>;
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


const inputClass =
  'w-full px-3 py-2 border dark:bg-gray-700 dark:border-gray-600 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none';

export function AddMonitorModal({ onClose, onAdd, onUpdate, existingMonitor, isEditing }: AddMonitorModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [monitorType, setMonitorType] = useState<'http' | 'tcp' | 'k8s'>(
    existingMonitor?.monitorTypeId === 3 ? 'tcp' : 
    existingMonitor?.monitorTypeId === 4 ? 'k8s' : 'http'
  );
  
  // Group creation state
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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
  const [checkMonitorHttpHeaders, setCheckMonitorHttpHeaders] = useState(
    existingMonitor && 'checkMonitorHttpHeaders' in existingMonitor ? (existingMonitor as any).checkMonitorHttpHeaders : false
  );
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [maxRedirects, setMaxRedirects] = useState((existingMonitor as any)?.maxRedirects?.toString() ?? '3');
  const [timeout, setTimeout] = useState((existingMonitor as any)?.timeout?.toString() ?? '30');
  const [httpResponseCodeFrom, setHttpResponseCodeFrom] = useState(
    (existingMonitor as any)?.httpResponseCodeFrom?.toString() ?? '200'
  );
  const [httpResponseCodeTo, setHttpResponseCodeTo] = useState(
    (existingMonitor as any)?.httpResponseCodeTo?.toString() ?? '299'
  );
  const [body, setBody] = useState((existingMonitor as any)?.body || '');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (isEditing && existingMonitor) {
      // Try to get monitorGroup from existingMonitor
      // For K8s monitors, API returns monitorGroup (lowercase)
      const groupId = existingMonitor.monitorGroup || 
                     (existingMonitor.monitorK8s as any)?.monitorGroup ||
                     (existingMonitor.monitorK8s as any)?.MonitorGroup || 
                     (existingMonitor as any)?.MonitorGroup ||
                     (existingMonitor as any)?.monitorGroup;
      return groupId || 0;
    }
    return 0;
  });
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

  // Check if user needs to create a group first
  const needsGroupCreation = groups.length === 0 && !isEditing;

  const validationMessage = (): string | null => {
    if (!name.trim()) return 'Name is required';
    if (needsGroupCreation) {
      if (!newGroupName.trim()) return 'Group name is required';
    } else if (selectedGroupId <= 0) {
      return 'Select a group';
    }
    if (selectedRegion <= 0) return 'No monitoring region is available';
    if (monitorType === 'http' && !url.trim()) return 'URL is required';
    if (monitorType === 'tcp' && (!url.trim() || !port.trim())) return 'IP address and port are required';
    if (monitorType === 'k8s') {
      const hasKubeConfig = Boolean(
        kubeConfig !== null ||
        (existingKubeConfig && existingKubeConfig !== '') ||
        isEditing
      );
      if (!clusterName.trim() || !hasKubeConfig) return 'Cluster name and kubeconfig are required';
    }
    if (!interval.trim() || !retries.trim() || !timeout.trim()) {
      return 'Interval, retries, and timeout are required';
    }
    return null;
  };

  const handleCreateGroup = async (): Promise<number | null> => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty', { position: 'bottom-right' });
      return null;
    }

    setIsCreatingGroup(true);
    try {
      const newGroup = await monitorService.addMonitorGroup(newGroupName.trim());
      const updatedGroups = await monitorService.getMonitorGroupListByUser();
      setGroups(updatedGroups);
      const createdId = newGroup?.id || updatedGroups[0]?.id || 0;
      if (createdId) {
        setSelectedGroupId(createdId);
      }
      return createdId || null;
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group. Please try again.', { position: 'bottom-right' });
      return null;
    } finally {
      setIsCreatingGroup(false);
    }
  };

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const groups = await monitorService.getMonitorGroupListByUser();
        setGroups(groups);
        
        if (isEditing) {
          if (existingMonitor) {
            // API returns monitorGroup (lowercase) for K8s monitors
            const groupId = existingMonitor.monitorGroup || 
                           (existingMonitor.monitorK8s as any)?.monitorGroup ||
                           (existingMonitor.monitorK8s as any)?.MonitorGroup || 
                           (existingMonitor as any)?.MonitorGroup ||
                           (existingMonitor as any)?.monitorGroup;
            if (groupId) {
              setSelectedGroupId(groupId);
            }
          }
        } else if (groups.length > 0) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch monitor groups:', error);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [existingMonitor, isEditing]);

  // Always fetch K8s details when editing a K8s monitor to ensure we have the correct monitorGroup
  // The API returns monitorGroup (lowercase) but the TypeScript interface uses MonitorGroup (uppercase)
  useEffect(() => {
    const fetchK8sDetailsIfNeeded = async () => {
      if (isEditing && existingMonitor?.monitorTypeId === 4) {
        try {
          const k8sDetails = await monitorService.getMonitorK8sDetails(existingMonitor.id);
          // API actually returns monitorGroup (lowercase), not MonitorGroup (uppercase)
          // Check lowercase first, then uppercase for compatibility
          const groupId = (k8sDetails as any).monitorGroup || (k8sDetails as any).MonitorGroup || k8sDetails.MonitorGroup;
          if (groupId && groupId > 0) {
            setSelectedGroupId(groupId);
            
          } else {
            console.warn('monitorGroup not found in K8s details or is 0:', k8sDetails);
          }
        } catch (error) {
          console.error('Failed to fetch K8s details for group:', error);
        }
      }
    };

    fetchK8sDetailsIfNeeded();
  }, [isEditing, existingMonitor]);

  // Verify group is found when editing
  useEffect(() => {
    if (isEditing && selectedGroupId > 0 && groups.length > 0) {
      const foundGroup = groups.find(g => g.id === selectedGroupId);
      if (!foundGroup) {
        console.warn(`Group with ID ${selectedGroupId} not found in groups list. Available groups:`, groups.map(g => ({ id: g.id, name: g.name })));
      }
    }
  }, [isEditing, selectedGroupId, groups]);

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

  // Update HTTP response code fields when existingMonitor changes (e.g., when HTTP details are fetched)
  useEffect(() => {
    if (existingMonitor && (existingMonitor as any)?.httpResponseCodeFrom !== undefined) {
      setHttpResponseCodeFrom((existingMonitor as any).httpResponseCodeFrom.toString());
    }
    if (existingMonitor && (existingMonitor as any)?.httpResponseCodeTo !== undefined) {
      setHttpResponseCodeTo((existingMonitor as any).httpResponseCodeTo.toString());
    }
    if (existingMonitor && (existingMonitor as any)?.body !== undefined) {
      setBody((existingMonitor as any).body);
    }
    if (existingMonitor && (existingMonitor as any)?.checkMonitorHttpHeaders !== undefined) {
      setCheckMonitorHttpHeaders((existingMonitor as any).checkMonitorHttpHeaders);
    }
  }, [existingMonitor]);

  const handleSubmit = async (e: React.FormEvent, groupIdOverride?: number) => {
    e.preventDefault();
    const groupId = groupIdOverride ?? selectedGroupId;
    setIsSubmitting(true);
    try {
      const basePayload = {
        name,
        monitorGroup: groupId,
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
          MonitorGroup: groupId,
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
          // Trigger refresh by calling onAdd (it will refresh the list in MetricsList)
          // We pass the k8sPayload to trigger the refresh callback
          if (onAdd) {
            await onAdd(k8sPayload as any);
          }
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
          checkMonitorHttpHeaders,
          daysToExpireCert: 0,
          paused: false,
          responseStatusCode: 200,
          responseTime: 0,
          lastStatus: true,
          monitorTypeId: 1,
          HttpResponseCodeFrom: parseInt(httpResponseCodeFrom),
          HttpResponseCodeTo: parseInt(httpResponseCodeTo)
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = validationMessage();
    if (message) {
      toast.error(message, { position: 'bottom-right' });
      if (message.includes('Interval') || message.includes('region')) {
        setShowAdvanced(true);
      }
      return;
    }

    let groupId = selectedGroupId;
    if (needsGroupCreation) {
      const createdId = await handleCreateGroup();
      if (!createdId) return;
      groupId = createdId;
    }

    await handleSubmit(e, groupId);
  };

  useEffect(() => {
    if (!isEditing || !existingMonitor) return;
    const method = getMonitorHttpMethod(existingMonitor);
    const custom =
      (existingMonitor.heartBeatInterval ?? 1) !== 1 ||
      (existingMonitor.retries ?? 3) !== 3 ||
      Number((existingMonitor as any)?.timeout ?? 30) !== 30 ||
      (existingMonitor.monitorEnvironment ?? MonitorEnvironment.Production) !== MonitorEnvironment.Production ||
      Boolean((existingMonitor as any).ignoreTlsSsl) ||
      Boolean((existingMonitor as any).checkMonitorHttpHeaders) ||
      existingMonitor.checkCertExpiry === false ||
      Boolean((existingMonitor as any).body) ||
      Number((existingMonitor as any).maxRedirects ?? 3) !== 3 ||
      Number((existingMonitor as any).httpResponseCodeFrom ?? 200) !== 200 ||
      Number((existingMonitor as any).httpResponseCodeTo ?? 299) !== 299 ||
      (method !== undefined && method !== 1);
    if (custom) setShowAdvanced(true);
  }, [isEditing, existingMonitor]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-xl max-h-[90vh] dark:bg-gray-900 bg-gray-50 shadow-lg flex flex-col">
        <div className="flex-none flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-medium dark:text-white">
            {isEditing ? 'Edit Monitor' : 'Add Monitor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 dark:text-gray-400" />
          </button>
        </div>

        {isLoadingGroups ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <LoadingSpinner text="Loading groups..." />
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                {monitorTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setMonitorType(type.id as 'http' | 'tcp' | 'k8s')}
                    disabled={isEditing}
                    className={`px-3 py-3 border flex flex-col items-center gap-1.5 transition-colors
                      ${isEditing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                      ${monitorType === type.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    <type.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Production API"
                  required
                />
              </div>

              {(monitorType === 'http' || monitorType === 'tcp') && (
                <div className={monitorType === 'tcp' ? 'grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3' : ''}>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      {monitorType === 'http' ? 'URL' : 'IP address'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={monitorType === 'http' ? 'https://example.com' : '192.168.1.1 or hostname'}
                      className={inputClass}
                      required
                    />
                  </div>
                  {monitorType === 'tcp' && (
                    <div>
                      <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                        Port <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="443"
                        className={inputClass}
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {monitorType === 'k8s' && (
                <>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Cluster name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={clusterName}
                      onChange={(e) => setClusterName(e.target.value)}
                      placeholder="production-cluster"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      Kubeconfig {isEditing ? '' : <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="file"
                      accept=".yaml,.yml"
                      onChange={(e) => setKubeConfig(e.target.files?.[0] || null)}
                      className={`${inputClass} file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium`}
                      required={!isEditing}
                    />
                    {isEditing && !kubeConfig && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Leave empty to keep the current kubeconfig.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Group <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <div className={`${inputClass} bg-gray-100 dark:bg-gray-800 cursor-not-allowed`}>
                    {sortedGroups.find((g) => g.id === selectedGroupId)?.name ||
                      (selectedGroupId > 0 ? `Group ${selectedGroupId}` : 'Unknown group')}
                  </div>
                ) : needsGroupCreation ? (
                  <>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. Production"
                      className={inputClass}
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      You don't have a group yet. This one is created with the monitor.
                    </p>
                  </>
                ) : (
                  <Select
                    value={selectedGroupId}
                    onValueChange={(value) => setSelectedGroupId(Number(value))}
                  >
                    {sortedGroups.map((group) => (
                      <Select.Item key={group.id} value={group.id.toString()}>
                        {group.name}
                      </Select.Item>
                    ))}
                  </Select>
                )}
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={(e) => setShowAdvanced(e.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
                <span className="text-sm font-medium dark:text-gray-200 text-gray-800">
                  Advanced settings
                </span>
              </label>

              {!showAdvanced && (
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                  Checks every {interval} min, {retries} retries, {timeout}s timeout, {MonitorEnvironment[environment]}
                  {selectedRegion > 0 ? `, ${MonitorRegion[selectedRegion] || `region ${selectedRegion}`}` : ''}.
                </p>
              )}

              {showAdvanced && (
                <div className="space-y-4 border-t dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          .map(([envName, value]) => (
                            <Select.Item key={value} value={value.toString()}>
                              {envName}
                            </Select.Item>
                          ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                        Interval (min)
                      </label>
                      <input
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        min="1"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                        Retries
                      </label>
                      <input
                        type="number"
                        value={retries}
                        onChange={(e) => setRetries(e.target.value)}
                        min="1"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                        Timeout (sec)
                      </label>
                      <input
                        type="number"
                        value={timeout}
                        onChange={(e) => setTimeout(e.target.value)}
                        min="1"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {monitorType === 'http' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                            HTTP method
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
                            Max redirects
                          </label>
                          <input
                            type="number"
                            value={maxRedirects}
                            onChange={(e) => setMaxRedirects(e.target.value)}
                            min="0"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                          Success status codes
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            value={httpResponseCodeFrom}
                            onChange={(e) => setHttpResponseCodeFrom(e.target.value)}
                            min="100"
                            max="599"
                            aria-label="Status code from"
                            className={inputClass}
                          />
                          <input
                            type="number"
                            value={httpResponseCodeTo}
                            onChange={(e) => setHttpResponseCodeTo(e.target.value)}
                            min="100"
                            max="599"
                            aria-label="Status code to"
                            className={inputClass}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          A response in this range counts as up.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                          Request body {httpMethod === 'GET' ? '(not used for GET)' : ''}
                        </label>
                        <Textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          rows={4}
                          placeholder="JSON or form body"
                          disabled={httpMethod === 'GET'}
                          className={`${inputClass} font-mono text-sm`}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium dark:text-gray-300">Headers</label>
                          <button
                            type="button"
                            onClick={() => setShowHeaderForm(true)}
                            className="px-2.5 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>
                        {headers.map((header, index) => (
                          <div
                            key={`${header.name}-${index}`}
                            className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 dark:bg-gray-800"
                          >
                            <span className="flex-1 font-mono text-sm truncate">
                              {header.name}: {header.value}
                            </span>
                            <button
                              type="button"
                              onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
                              className="p-1 text-gray-500 hover:text-red-500"
                              aria-label={`Remove ${header.name}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {showHeaderForm && (
                          <div className="border dark:border-gray-700 p-3 space-y-2">
                            <input
                              type="text"
                              value={headerName}
                              onChange={(e) => setHeaderName(e.target.value)}
                              placeholder="Header name"
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={headerValue}
                              onChange={(e) => setHeaderValue(e.target.value)}
                              placeholder="Header value"
                              className={inputClass}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowHeaderForm(false);
                                  setHeaderName('');
                                  setHeaderValue('');
                                }}
                                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!headerName || !headerValue}
                                onClick={() => {
                                  if (headerName && headerValue) {
                                    setHeaders([...headers, { name: headerName, value: headerValue }]);
                                    setHeaderName('');
                                    setHeaderValue('');
                                    setShowHeaderForm(false);
                                  }
                                }}
                                className="px-3 py-1 text-sm bg-blue-500 text-white disabled:opacity-50"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium dark:text-gray-300">Check certificate expiry</span>
                          <Switch checked={checkCertExpiry} onCheckedChange={setCheckCertExpiry} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium dark:text-gray-300">Ignore TLS errors</span>
                          <Switch checked={ignoreTLS} onCheckedChange={setIgnoreTLS} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium dark:text-gray-300">Check security headers</span>
                          <Switch checked={checkMonitorHttpHeaders} onCheckedChange={setCheckMonitorHttpHeaders} />
                        </div>
                      </div>
                    </>
                  )}

                  {monitorType === 'tcp' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium dark:text-gray-300">Ignore TLS errors</span>
                      <Switch checked={ignoreTLS} onCheckedChange={setIgnoreTLS} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-none border-t dark:border-gray-700 p-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCreatingGroup}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting || isCreatingGroup ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isEditing ? 'Update monitor' : 'Create monitor'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
