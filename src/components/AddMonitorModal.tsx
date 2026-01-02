import React, { useState, useEffect, useMemo } from 'react';
import { X, Globe, Network, Plus, Server, ChevronLeft, ChevronRight, Check } from 'lucide-react';
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


export function AddMonitorModal({ onClose, onAdd, onUpdate, existingMonitor, isEditing }: AddMonitorModalProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState(0);
  
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
  const [submitButtonClicked, setSubmitButtonClicked] = useState(false);
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

  // Calculate total steps based on monitor type and group creation
  const getTotalSteps = () => {
    // HTTP: Type, Basic, Connection, Advanced, Monitoring, Review (6 steps)
    // TCP/K8s: Type, Basic, Connection, Monitoring, Review (5 steps)
    const baseSteps = monitorType === 'http' ? 6 : 5;
    return needsGroupCreation ? baseSteps + 1 : baseSteps; // Add 1 for group creation step
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    // Adjust step number if group creation is needed
    const actualStep = needsGroupCreation ? step : step;
    
    switch (actualStep) {
      case 0: // Group creation
        return newGroupName.trim() !== '';
      case 1: // Monitor type selection (or step 1 if no group creation)
        if (needsGroupCreation) {
          return true; // Always valid once a type is selected
        }
        return true; // Always valid once a type is selected
      case 2: // Basic information (or step 2 if no group creation)
        return name.trim() !== '' && selectedGroupId > 0 && selectedRegion > 0;
      case 3: // Connection details
        if (monitorType === 'http' || monitorType === 'tcp') {
          return url.trim() !== '' && (monitorType === 'http' || port.trim() !== '');
        }
        if (monitorType === 'k8s') {
          const hasKubeConfig = Boolean(
            kubeConfig !== null || 
            (existingKubeConfig && existingKubeConfig !== '') || 
            isEditing
          );
          return Boolean(clusterName.trim() !== '' && hasKubeConfig);
        }
        return false;
      case 4: // Advanced settings (HTTP only) or Monitoring settings
        if (monitorType === 'http') {
          return true; // Advanced settings are mostly optional
        }
        // For TCP/K8s, this is monitoring settings
        return interval.trim() !== '' && retries.trim() !== '' && timeout.trim() !== '';
      case 5: // Monitoring settings (HTTP) or Review (TCP/K8s)
        if (monitorType === 'http') {
          return interval.trim() !== '' && retries.trim() !== '' && timeout.trim() !== '';
        }
        return true; // Review step for TCP/K8s
      case 6: // Review (HTTP only)
        return true;
      default:
        return false;
    }
  };
  
  // Handle group creation
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty', { position: 'bottom-right' });
      return;
    }
    
    setIsCreatingGroup(true);
    try {
      const newGroup = await monitorService.addMonitorGroup(newGroupName.trim());
      // Refresh groups list
      const updatedGroups = await monitorService.getMonitorGroupListByUser();
      setGroups(updatedGroups);
      // Auto-select the newly created group
      if (newGroup && newGroup.id) {
        setSelectedGroupId(newGroup.id);
      } else if (updatedGroups.length > 0) {
        setSelectedGroupId(updatedGroups[0].id);
      }
      toast.success('Group created successfully', { position: 'bottom-right' });
      // Move to next step
      setCurrentStep(1);
      setNewGroupName('');
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group. Please try again.', { position: 'bottom-right' });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const canGoNext = () => {
    return validateStep(currentStep);
  };

  const canGoPrevious = () => {
    if (needsGroupCreation) {
      return currentStep > 0;
    }
    return currentStep > 1;
  };

  const handleNext = async () => {
    if (!canGoNext()) return;
    
    // If on group creation step, create the group first
    if (currentStep === 0 && needsGroupCreation) {
      await handleCreateGroup();
      return;
    }
    
    // Determine the last step (where submit button appears)
    // For HTTP: last step is 6 (Review)
    // For TCP/K8s: last step is 5 (Review)
    // With group creation: add 1 to the step numbers
    const lastStep = needsGroupCreation
      ? getTotalSteps() - 1
      : (monitorType === 'http' ? 6 : 5);
    
    // Only advance if we're not on the last step yet
    // This prevents any accidental navigation that might trigger submission
    if (currentStep < lastStep) {
      setCurrentStep(currentStep + 1);
    }
    // Do nothing if already on last step - user must click submit button
  };

  const handlePrevious = () => {
    if (canGoPrevious()) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Reset to step 1 when monitor type changes (only if not editing)
  useEffect(() => {
    if (!isEditing && currentStep > 1) {
      setCurrentStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorType, isEditing]);

  // Reset submit button clicked flag when step changes
  useEffect(() => {
    setSubmitButtonClicked(false);
  }, [currentStep]);

  // Ensure we never show group creation step when editing
  useEffect(() => {
    if (isEditing && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [isEditing, currentStep]);

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const groups = await monitorService.getMonitorGroupListByUser();
        setGroups(groups);
        
        if (isEditing) {
          // When editing, always start at step 1 (monitor type selection)
          // The monitor already exists and has a group, so no group creation needed
          if (existingMonitor) {
            // Try to get monitorGroup from multiple possible locations
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
          setCurrentStep(1); // Always start at step 1 when editing
        } else if (groups.length > 0) {
          // New monitor with groups available
          setSelectedGroupId(groups[0].id);
          setCurrentStep(1); // Start at step 1 if groups exist
        } else {
          // New monitor with no groups
          setCurrentStep(0); // Start at step 0 (group creation) if no groups
        }
      } catch (error) {
        console.error('Failed to fetch monitor groups:', error);
        // If error and not editing, start at group creation step
        if (!isEditing) {
          setCurrentStep(0);
        } else {
          // When editing, still start at step 1 even if groups fail to load
          setCurrentStep(1);
        }
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
            console.log('Found monitorGroup from K8s details API:', groupId, 'Full k8sDetails:', k8sDetails);
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
      setSubmitButtonClicked(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                Create Monitor Group
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                You need to create a monitor group before adding monitors. Groups help you organize and manage your monitors.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Production, Development, Testing"
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                required
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGroupName.trim() && !isCreatingGroup) {
                    handleCreateGroup();
                  }
                }}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                This group will be automatically selected for your new monitor.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                Select Monitor Type
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Choose the type of monitor you want to create
              </p>
            </div>
            <div className="flex gap-4">
              {monitorTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setMonitorType(type.id as 'http' | 'tcp' | 'k8s')}
                  disabled={isEditing}
                  className={`flex-1 px-6 py-8 rounded-lg border-2 transition-all duration-200 
                            flex flex-col items-center justify-center gap-3 relative
                            ${isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${monitorType === type.id
                              ? 'border-blue-500 dark:bg-blue-900/20 bg-blue-50 shadow-lg scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <type.icon className={`w-12 h-12 ${
                    monitorType === type.id
                      ? 'text-blue-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className={`font-semibold text-lg ${
                    monitorType === type.id
                      ? 'text-blue-500'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {type.label}
                  </span>
                  {monitorType === type.id && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                Basic Information
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Provide the basic details for your monitor
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Monitor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                required
                placeholder="e.g., Production API"
              />
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Group <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white bg-gray-100 dark:bg-gray-800 cursor-not-allowed">
                  {isLoadingGroups ? (
                    <span className="text-gray-500 dark:text-gray-400">Loading...</span>
                  ) : (
                    sortedGroups.find(g => g.id === selectedGroupId)?.name || 
                    (selectedGroupId > 0 ? `Group ID: ${selectedGroupId}` : 'Unknown Group')
                  )}
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
                Region <span className="text-red-500">*</span>
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
                Environment <span className="text-red-500">*</span>
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
          </div>
        );

      case 3:
        if (monitorType === 'http' || monitorType === 'tcp') {
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                  Connection Details
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure the connection settings for your {monitorType === 'http' ? 'HTTP(S)' : 'TCP'} monitor
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  {monitorType === 'http' ? 'URL' : 'IP Address'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={monitorType === 'http' ? 'https://example.com' : '192.168.1.1 or hostname'}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
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
                    placeholder="e.g., 80, 443, 3306"
                    className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>
          );
        } else if (monitorType === 'k8s') {
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                  Kubernetes Configuration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Provide your Kubernetes cluster details
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Cluster Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="e.g., production-cluster"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  KubeConfig File <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    onChange={(e) => setKubeConfig(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                             dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 
                             file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold
                             file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100
                             dark:file:bg-blue-900/20 dark:file:text-blue-400"
                    required={!isEditing}
                  />
                  {kubeConfig && (
                    <button
                      type="button"
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
            </div>
          );
        }
        return null;

      case 4:
        if (monitorType === 'http') {
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                  HTTP Advanced Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure advanced HTTP monitoring options
                </p>
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
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                  Expected HTTP Response Code Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      From
                    </label>
                    <input
                      type="number"
                      value={httpResponseCodeFrom}
                      onChange={(e) => setHttpResponseCodeFrom(e.target.value)}
                      min="100"
                      max="599"
                      className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                               dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                      To
                    </label>
                    <input
                      type="number"
                      value={httpResponseCodeTo}
                      onChange={(e) => setHttpResponseCodeTo(e.target.value)}
                      min="100"
                      max="599"
                      className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                               dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs dark:text-gray-400 text-gray-600">
                  The monitor will consider the HTTP request successful if the response code falls within this range
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  HTTP Body {httpMethod === 'GET' && '(GET methods do not support body)'}
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Enter request body (JSON, form data, etc.)"
                  className="font-mono text-sm w-full px-3 py-2 rounded-lg dark:bg-gray-700 border 
                            dark:border-gray-600 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  disabled={httpMethod === 'GET'}
                  readOnly={false}
                />
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
                                 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
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
                                 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
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

              <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium dark:text-gray-300">
                    Check Cert Expiry
                  </label>
                  <Switch
                    checked={checkCertExpiry}
                    onCheckedChange={(checked) => setCheckCertExpiry(checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium dark:text-gray-300">
                    Ignore TLS
                  </label>
                  <Switch
                    checked={ignoreTLS}
                    onCheckedChange={(checked) => setIgnoreTLS(checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium dark:text-gray-300">
                    Check Security Headers
                  </label>
                  <Switch
                    checked={checkMonitorHttpHeaders}
                    onCheckedChange={(checked) => setCheckMonitorHttpHeaders(checked)}
                  />
                </div>
              </div>
            </div>
          );
        } else {
          // TCP or K8s - Monitoring Settings
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                  Monitoring Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure how often and how the monitor should check
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Check Interval (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Retries before alert <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Timeout (seconds) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {monitorType === 'tcp' && (
                <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                  <label className="block text-sm font-medium dark:text-gray-300">
                    Ignore TLS
                  </label>
                  <Switch
                    checked={ignoreTLS}
                    onCheckedChange={(checked) => setIgnoreTLS(checked)}
                  />
                </div>
              )}
            </div>
          );
        }

      case 5:
        if (monitorType === 'http') {
          // HTTP - Monitoring Settings
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                  Monitoring Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure how often and how the monitor should check
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Check Interval (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Retries before alert <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Timeout (seconds) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          );
        } else {
          // TCP/K8s - Review
          return renderReviewStep();
        }

      case 6:
        // HTTP - Review
        return renderReviewStep();

      default:
        return null;
    }
  };

  const renderReviewStep = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
            Review & Confirm
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Please review your monitor configuration before creating it
          </p>
        </div>

        <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Monitor Type:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">
                {monitorTypes.find(t => t.id === monitorType)?.label}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Name:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">{name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Group:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">
                {sortedGroups.find(g => g.id === selectedGroupId)?.name || 
                 (selectedGroupId > 0 ? `Group ID: ${selectedGroupId}` : 'Unknown')}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Region:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">
                {MonitorRegion[selectedRegion] || `Region ${selectedRegion}`}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Environment:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">
                {MonitorEnvironment[environment]}
              </p>
            </div>
            {monitorType === 'http' && (
              <>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">URL:</span>
                  <p className="text-sm font-semibold dark:text-white text-gray-900 break-all">{url}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">HTTP Method:</span>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">{httpMethod}</p>
                </div>
              </>
            )}
            {monitorType === 'tcp' && (
              <>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">IP:</span>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">{url}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Port:</span>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">{port}</p>
                </div>
              </>
            )}
            {monitorType === 'k8s' && (
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cluster Name:</span>
                <p className="text-sm font-semibold dark:text-white text-gray-900">{clusterName}</p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Check Interval:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">{interval} minutes</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Retries:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">{retries}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout:</span>
              <p className="text-sm font-semibold dark:text-white text-gray-900">{timeout} seconds</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getStepTitle = () => {
    if (needsGroupCreation) {
      const titles: Record<number, string> = {
        0: 'Create Monitor Group',
        1: 'Select Monitor Type',
        2: 'Basic Information',
        3: monitorType === 'k8s' ? 'Kubernetes Configuration' : 'Connection Details',
        4: monitorType === 'http' ? 'Advanced Settings' : 'Monitoring Settings',
        5: monitorType === 'http' ? 'Monitoring Settings' : 'Review & Confirm',
        6: 'Review & Confirm'
      };
      return titles[currentStep] || 'Step';
    } else {
      const titles: Record<number, string> = {
        1: 'Select Monitor Type',
        2: 'Basic Information',
        3: monitorType === 'k8s' ? 'Kubernetes Configuration' : 'Connection Details',
        4: monitorType === 'http' ? 'Advanced Settings' : 'Monitoring Settings',
        5: monitorType === 'http' ? 'Monitoring Settings' : 'Review & Confirm',
        6: 'Review & Confirm'
      };
      return titles[currentStep] || 'Step';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl max-h-[90vh] dark:bg-gray-900 bg-gray-50 rounded-lg shadow-lg flex flex-col">
        <div className="flex-none flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-medium dark:text-white">
              {isEditing ? 'Edit Monitor' : 'Add New Monitor'}
            </h2>
            {!isLoadingGroups && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Step {needsGroupCreation ? currentStep + 1 : currentStep} of {getTotalSteps()}: {getStepTitle()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        {!isLoadingGroups && (
          <div className="flex-none px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            {Array.from({ length: getTotalSteps() }, (_, i) => {
              const step = needsGroupCreation ? i : i + 1;
              const displayStep = i + 1;
              return (
                <React.Fragment key={step}>
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        step < currentStep
                          ? 'bg-green-500 text-white'
                          : step === currentStep
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step < currentStep ? <Check className="w-5 h-5" /> : displayStep}
                    </div>
                  </div>
                  {i < getTotalSteps() - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-colors ${
                        step < currentStep
                          ? 'bg-green-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        )}

        {isLoadingGroups ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <LoadingSpinner text="Loading groups..." />
          </div>
        ) : (
          <form 
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Only allow form submission on the final step AND when submit button was explicitly clicked
            // For HTTP: step 6 (Review) is the final step
            // For TCP/K8s: step 5 (Review) is the final step
            const isLastStep = needsGroupCreation 
              ? currentStep === getTotalSteps() - 1 
              : (monitorType === 'http' ? currentStep === 6 : currentStep === 5);
            
            // Strict check: only submit if we're on the last step AND submit button was clicked
            // This prevents any accidental submissions from Enter key, navigation, or other triggers
            if (!isLastStep || !submitButtonClicked) {
              return; // Do nothing if not on last step or submit button wasn't clicked
            }
            
            // Only proceed with submission on the last step when submit button was explicitly clicked
            handleSubmit(e);
          }}
          onKeyDown={(e) => {
            // Prevent Enter key from submitting form unless on the last step
            if (e.key === 'Enter') {
              const isLastStep = needsGroupCreation 
                ? currentStep === getTotalSteps() - 1 
                : (monitorType === 'http' ? currentStep === 6 : currentStep === 5);
              
              // Only allow Enter on last step, prevent it on all other steps
              if (!isLastStep) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderStepContent()}
            </div>
          </div>

          <div className="flex-none border-t dark:border-gray-700 p-4">
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={canGoPrevious() ? handlePrevious : onClose}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                         flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {canGoPrevious() ? 'Previous' : 'Cancel'}
              </button>
              
              {(() => {
                // Determine if we should show "Next" button or "Submit" button
                // For HTTP: steps 1-6, submit button only on step 6
                // For TCP/K8s: steps 1-5, submit button only on step 5
                // With group creation: add 1 to all step numbers
                const isLastStep = needsGroupCreation
                  ? currentStep === getTotalSteps() - 1
                  : (monitorType === 'http' ? currentStep === 6 : currentStep === 5);
                return !isLastStep;
              })() ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext();
                  }}
                  disabled={!canGoNext() || isCreatingGroup}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingGroup ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Creating...
                    </>
                  ) : currentStep === 0 && needsGroupCreation ? (
                    <>
                      Create Group
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={() => {
                    // Mark that submit button was explicitly clicked
                    setSubmitButtonClicked(true);
                  }}
                  disabled={isSubmitting || !canGoNext()}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {isEditing ? 'Update Monitor' : 'Create Monitor'}
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
