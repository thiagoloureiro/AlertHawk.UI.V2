import React from 'react';
import { useParams } from 'react-router-dom';
import { MetricDetails } from '../components/MetricDetails';
import monitorService from '../services/monitorService';

export function MonitorDetails() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const [monitor, setMonitor] = React.useState(null);

  React.useEffect(() => {
    if (monitorId) {
      monitorService.getMonitor(parseInt(monitorId, 10))
        .then(setMonitor)
        .catch(console.error);
    }
  }, [monitorId]);

  if (!monitor) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold dark:text-white">
        Monitor Details: {monitorId}
      </h1>
      <MetricDetails metric={monitor} />
    </div>
  );
} 