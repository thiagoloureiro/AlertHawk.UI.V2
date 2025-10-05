import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertIncident } from '../../types';

interface AlertChartProps {
  data: AlertIncident[];
  config: any;
  onConfigChange: (config: any) => void;
}

export function AlertChart({ data, config }: AlertChartProps) {
  // Process data for the chart
  const chartData = React.useMemo(() => {
    // Group alerts by day
    const alertsByDay = data.reduce((acc, alert) => {
      const date = new Date(alert.timeStamp).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, count: 0, online: 0, offline: 0 };
      }
      acc[date].count++;
      if (alert.status) {
        acc[date].online++;
      } else {
        acc[date].offline++;
      }
      return acc;
    }, {} as Record<string, { date: string; count: number; online: number; offline: number }>);

    return Object.values(alertsByDay)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days
  }, [data]);

  const pieData = React.useMemo(() => {
    const total = data.length;
    const online = data.filter(alert => alert.status).length;
    const offline = total - online;
    
    return [
      { name: 'Online', value: online, color: '#10B981' },
      { name: 'Offline', value: offline, color: '#EF4444' }
    ];
  }, [data]);

  const COLORS = ['#10B981', '#EF4444'];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🚨</div>
          <p>No alert data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {/* Bar Chart - Alerts over time */}
        <div className="h-full">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alerts by Day</h4>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="#6B7280"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Status distribution */}
        <div className="h-full">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status Distribution</h4>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
