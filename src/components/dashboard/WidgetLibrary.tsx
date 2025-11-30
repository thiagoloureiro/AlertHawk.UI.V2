import React from 'react';
import { BarChart3, PieChart, Activity, AlertTriangle, Gauge, TrendingUp, Users, Shield, X, Square } from 'lucide-react';

interface WidgetLibraryProps {
  onAddWidget: (type: string) => void;
  onClose?: () => void;
  currentWidgetCount?: number;
  maxWidgets?: number;
}

const widgetTypes = [
  {
    id: 'uptime',
    name: 'Uptime Summary',
    description: 'Uptime statistics across different time periods',
    icon: TrendingUp,
    category: 'Metrics'
  },
  {
    id: 'alert',
    name: 'Alert Timeline',
    description: 'Timeline of alerts and incidents',
    icon: AlertTriangle,
    category: 'Alerts'
  },
  {
    id: 'group-summary',
    name: 'Group Summary',
    description: 'Summary of monitor groups and their health',
    icon: Users,
    category: 'Status'
  },
  {
    id: 'monitor-status',
    name: 'Monitor Status',
    description: 'Detailed view of individual monitors',
    icon: Activity,
    category: 'Status'
  },
  {
    id: 'ssl-status',
    name: 'SSL Certificate Status',
    description: 'SSL certificate expiration and status',
    icon: Shield,
    category: 'Security'
  },
  {
    id: 'status-blocks',
    name: 'Status Blocks',
    description: 'Visual blocks showing ONLINE/OFFLINE/PAUSED counts',
    icon: Square,
    category: 'Status'
  }
];

const categories = ['Metrics', 'Alerts', 'Status', 'Security'];

export function WidgetLibrary({ onAddWidget, onClose, currentWidgetCount = 0, maxWidgets = 15 }: WidgetLibraryProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Widget Library</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Widget List */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 scroll-smooth">
        {/* Widget Limit Message */}
        {currentWidgetCount >= maxWidgets && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Maximum of {maxWidgets} widgets reached
              </span>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Delete a widget to add a new one
            </p>
          </div>
        )}
        
        {categories.map((category) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {category}
            </h3>
            <div className="space-y-2">
              {widgetTypes
                .filter(widget => widget.category === category)
                .map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <button
                      key={widget.id}
                      onClick={() => onAddWidget(widget.id)}
                      className="w-full p-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {widget.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {widget.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
