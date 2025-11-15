import React, { useState, useEffect } from 'react';
import { MetricsList } from '../components/MetricsList';
import { MetricDetails } from '../components/MetricDetails';
import { CertificateExpirationModal } from '../components/CertificateExpirationModal';
import { Monitor, MonitorGroup } from '../types';
import monitorService from '../services/monitorService';

export function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<Monitor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MonitorGroup | undefined>(undefined);
  const [showCertModal, setShowCertModal] = useState(false);
  const [expiringMonitors, setExpiringMonitors] = useState<Monitor[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [updatedMonitor, setUpdatedMonitor] = useState<{ monitor: Monitor; timestamp: number } | null>(null);

  const handleMetricSelect = (metric: Monitor | null, group?: MonitorGroup) => {
    setSelectedMetric(metric);
    setSelectedGroup(group);
  };

  // Check for certificate expiration warnings
  useEffect(() => {
    const checkCertificateExpiration = async () => {
      try {
        // Check if user has chosen to not show the warning
        const dontShowAgain = localStorage.getItem('certificateExpirationWarning');
        if (dontShowAgain === 'true') {
          return;
        }

        // Get all monitor groups for the current environment (default to Production - 6)
        const groups = await monitorService.getDashboardGroups(6);
        
        // Find monitors with certificates expiring in less than 30 days and monitorTypeId = 1
        const expiring = groups.flatMap((group: MonitorGroup) => 
          group.monitors.filter((monitor: Monitor) => 
            monitor.monitorTypeId === 1 && 
            monitor.daysToExpireCert < 30 && 
            monitor.daysToExpireCert > 0
          )
        );

        if (expiring.length > 0) {
          setExpiringMonitors(expiring);
          setShowCertModal(true);
        }
      } catch (error) {
        console.error('Failed to check certificate expiration:', error);
      }
    };

    checkCertificateExpiration();
  }, []);

  const handleDontShowAgain = () => {
    localStorage.setItem('certificateExpirationWarning', 'true');
    setShowCertModal(false);
  };

  const handleCloseCertModal = () => {
    setShowCertModal(false);
  };

  return (
    <div className="flex h-full">
      <div className="w-[30%] border-r dark:border-gray-700 border-gray-200">
        <MetricsList
          selectedMetric={selectedMetric}
          onSelectMetric={handleMetricSelect}
          refreshTrigger={refreshTrigger}
          updatedMonitor={updatedMonitor}
          onEnvironmentChange={(environmentId) => {
            // Clear selected metric and group when environment changes
            setSelectedMetric(null);
            setSelectedGroup(undefined);
          }}
        />
      </div>
      <div className="flex-1">
        <MetricDetails 
          metric={selectedMetric} 
          group={selectedGroup}
          onMetricUpdate={(updatedMetric) => {
            setSelectedMetric(updatedMetric);
            // Update MetricsList with the updated monitor (targeted update, no reload)
            // Use timestamp to ensure the update always triggers even if monitor reference is similar
            setUpdatedMonitor({ monitor: updatedMetric, timestamp: Date.now() });
            // Clear after a brief moment to allow the update to process
            setTimeout(() => setUpdatedMonitor(null), 100);
          }}
        />
      </div>
      
      <CertificateExpirationModal
        isOpen={showCertModal}
        onClose={handleCloseCertModal}
        monitors={expiringMonitors}
        onDontShowAgain={handleDontShowAgain}
      />
    </div>
  );
} 