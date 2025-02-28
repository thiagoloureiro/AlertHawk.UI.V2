import React, { useState } from 'react';
import { MetricsList } from '../components/MetricsList';
import { MetricDetails } from '../components/MetricDetails';
import { Monitor, MonitorGroup } from '../types';

export function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<Monitor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MonitorGroup | undefined>(undefined);

  const handleMetricSelect = (metric: Monitor | null, group?: MonitorGroup) => {
    setSelectedMetric(metric);
    setSelectedGroup(group);
  };

  return (
    <div className="flex h-full">
      <div className="w-[30%] border-r dark:border-gray-700 border-gray-200">
        <MetricsList
          selectedMetric={selectedMetric}
          onSelectMetric={handleMetricSelect}
        />
      </div>
      <div className="flex-1">
        <MetricDetails metric={selectedMetric} group={selectedGroup} />
      </div>
    </div>
  );
} 