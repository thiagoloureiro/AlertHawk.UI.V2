import React, { useState } from 'react';
import { X, Edit3, Activity, AlertTriangle, Gauge, Shield, Users } from 'lucide-react';
import { DashboardData, DashboardWidget as DashboardWidgetType } from '../../pages/DashboardBuilder';
import { AlertTimeline } from './AlertTimeline';
import { MetricCard } from './MetricCard';
import { GroupStatusGrid } from './GroupStatusGrid';
import { MonitorStatusGrid } from './MonitorStatusGrid';
import { SSLStatusWidget } from './SSLStatusWidget';

interface DashboardWidgetProps {
  widget: DashboardWidgetType;
  data: DashboardData;
  isPreviewMode: boolean;
  onUpdate: (id: string, updates: Partial<DashboardWidgetType>) => void;
  onDelete: (id: string) => void;
}

const widgetIcons = {
  uptime: Gauge,
  alert: AlertTriangle,
  'group-summary': Users,
  'monitor-status': Activity,
  'ssl-status': Shield,
  // Legacy widget types
  metric: Gauge,
  status: Activity,
  chart: Activity,
  'pie-chart': Activity,
  'alert-chart': AlertTriangle,
};

export function DashboardWidget({ widget, data, isPreviewMode, onUpdate, onDelete }: DashboardWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const Icon = widgetIcons[widget.type];

  const handleTitleChange = (newTitle: string) => {
    onUpdate(widget.id, { title: newTitle });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleConfigChange = (newConfig: any) => {
    onUpdate(widget.id, { config: { ...widget.config, ...newConfig } });
  };

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'uptime':
        return (
          <MetricCard
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'alert':
        return (
          <AlertTimeline
            data={data.alerts}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'group-summary':
        return (
          <GroupStatusGrid
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'monitor-status':
        return (
          <MonitorStatusGrid
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'ssl-status':
        return (
          <SSLStatusWidget
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      // Legacy widget types - map to new equivalents
      case 'metric':
        return (
          <MetricCard
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'status':
        return (
          <MonitorStatusGrid
            data={data.monitorGroups}
            config={widget.config}
            onConfigChange={handleConfigChange}
          />
        );
      case 'chart':
      case 'pie-chart':
      case 'alert-chart':
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>Chart widgets have been removed</p>
              <p className="text-sm mt-1">Please replace this widget with a new one</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">❓</div>
              <p>Unknown widget type: {widget.type}</p>
              <p className="text-sm mt-1">Please replace this widget</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
        isEditing ? 'ring-2 ring-blue-500' : ''
      }`}
      style={{
        gridColumn: `span ${widget.position.w}`,
        gridRow: `span ${widget.position.h}`,
      }}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {isEditing ? (
                <input
                  type="text"
                  value={widget.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onBlur={handleBlur}
                  className="bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-white"
                  autoFocus
                />
              ) : (
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">{widget.title}</h3>
              )}
        </div>
        
            {!isPreviewMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  title="Rename widget"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(widget.id)}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                  title="Delete widget"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
      </div>

      {/* Widget Content */}
      <div className="p-4 h-[calc(100%-60px)]">
        {renderWidgetContent()}
      </div>
    </div>
  );
}
