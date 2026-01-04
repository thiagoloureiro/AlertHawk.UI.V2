import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { DashboardBuilder } from '../pages/DashboardBuilder';
import { Metrics } from '../pages/Metrics';
import { ApplicationMetrics } from '../pages/ApplicationMetrics';
import { ClustersDiagram } from '../pages/ClustersDiagram';
import { ClusterEvents } from '../pages/ClusterEvents';
import { MonitorDetails } from '../pages/MonitorDetails';
import { MonitorAlerts } from '../pages/MonitorAlerts';
import { MonitorGroups } from '../pages/MonitorGroups';
import { MonitorAgents } from '../pages/MonitorAgents';
import { NotificationManagement } from '../pages/NotificationManagement';
import { UserManagement } from '../pages/UserManagement';
import { Administration } from '../pages/Administration';
import { Settings } from '../pages/Settings';
import { StatusDashboard } from '../pages/StatusDashboard';
import { SSLCertificateMonitor } from '../pages/SSLCertificateMonitor';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { isMetricsEnabled } from '../lib/utils';

export function AppRoutes() {
  const metricsEnabled = isMetricsEnabled();
  
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/status" element={<StatusDashboard />} />
      <Route path="/status/:monitorId/:hours" element={<StatusDashboard />} />

      {/* Protected Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard-builder" element={<DashboardBuilder />} />
      <Route path="/dashboard-builder/:dashboardId" element={<DashboardBuilder />} />
      <Route path="/dashboard/:monitorId" element={<MonitorDetails />} />
      {metricsEnabled && (
        <>
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/application-metrics" element={<ApplicationMetrics />} />
          <Route path="/clusters-diagram" element={<ClustersDiagram />} />
          <Route path="/cluster-events" element={<ClusterEvents />} />
        </>
      )}
      <Route path="/alerts" element={<MonitorAlerts />} />
      <Route path="/ssl-certificates" element={<SSLCertificateMonitor />} />
      <Route path="/groups" element={<MonitorGroups />} />
      <Route path="/agents" element={<MonitorAgents />} />
      <Route path="/notifications" element={<NotificationManagement />} />
      <Route path="/users" element={<ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin><Administration /></ProtectedRoute>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/monitor/:monitorId/alerts" element={<MonitorAlerts />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
} 