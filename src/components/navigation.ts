import type { ElementType } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Bell,
  LineChart,
  MessageSquare,
  Users,
  UserCircle,
  Settings,
  Shield,
  BarChart3,
  Package,
  Network,
  Activity,
  DollarSign,
  HardDrive,
  Wrench,
} from 'lucide-react';

export type NavItem = {
  id: string;
  name: string;
  icon: ElementType;
  path: string;
  action?: 'qr';
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const MONITORING_ITEMS: NavItem[] = [
  { id: '1', name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: '2', name: 'Dashboard builder', icon: BarChart3, path: '/dashboard-builder' },
  { id: '9', name: 'Groups', icon: Users, path: '/groups' },
  { id: '5', name: 'Agents', icon: Monitor, path: '/agents' },
  { id: '6', name: 'Alerts', icon: Bell, path: '/alerts' },
  { id: '7', name: 'SSL certificates', icon: Shield, path: '/ssl-certificates' },
  { id: '8', name: 'Notifications', icon: MessageSquare, path: '/notifications' },
];

export const METRICS_ITEMS: NavItem[] = [
  { id: '3', name: 'Cluster metrics', icon: LineChart, path: '/metrics' },
  { id: '4', name: 'Application metrics', icon: Package, path: '/application-metrics' },
  { id: '15', name: 'Volume metrics', icon: HardDrive, path: '/volume-metrics' },
  { id: '12', name: 'Clusters diagram', icon: Network, path: '/clusters-diagram' },
  { id: '13', name: 'Cluster events', icon: Activity, path: '/cluster-events' },
  { id: '16', name: 'FinOps', icon: DollarSign, path: '/finops-metrics' },
];

export const ADMIN_ITEMS: NavItem[] = [
  { id: '10', name: 'Users', icon: UserCircle, path: '/users' },
  { id: '11', name: 'Administration', icon: Wrench, path: '/admin' },
];

export const SETTINGS_ITEM: NavItem = { id: 'settings', name: 'Settings', icon: Settings, path: '/settings' };

const ALL_ITEMS = [...MONITORING_ITEMS, ...METRICS_ITEMS, ...ADMIN_ITEMS, SETTINGS_ITEM];

export function getPageTitle(pathname: string): { section: string; title: string } {
  if (/^\/monitor\/[^/]+\/alerts/.test(pathname)) return { section: 'Monitoring', title: 'Monitor alerts' };
  if (/^\/dashboard\/.+/.test(pathname)) return { section: 'Monitoring', title: 'Monitor details' };

  const match = ALL_ITEMS
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (!match) return { section: 'Monitoring', title: 'Dashboard' };

  const section = METRICS_ITEMS.includes(match)
    ? 'Metrics'
    : ADMIN_ITEMS.includes(match)
      ? 'Admin'
      : match === SETTINGS_ITEM
        ? 'Account'
        : 'Monitoring';

  return { section, title: match.name };
}
