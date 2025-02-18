import React, { useState } from 'react';
import { MetricsList } from '../components/MetricsList';
import { MetricDetails } from '../components/MetricDetails';
import { Monitor } from '../types';

export function Dashboard() {
  const [selectedMetric, setSelectedMetric] = useState<Monitor | null>(null);

  return (
    <div className="flex h-full">
      <div className="w-[30%] border-r dark:border-gray-700 border-gray-200">
        <MetricsList
          selectedMetric={selectedMetric}
          onSelectMetric={setSelectedMetric}
        />
      </div>
      <div className="flex-1">
        {selectedMetric ? (
          <MetricDetails metric={selectedMetric} />
        ) : (
          <div className="h-full flex items-center justify-center dark:text-gray-400 text-gray-500">
            Select a metric to view details
          </div>
        )}
      </div>
    </div>
  );
} 