import { useState, useEffect } from 'react';
import { X, Loader2, Mail, MessageSquare, Send, Bell, Webhook, MessagesSquare } from 'lucide-react';
import { LoadingSpinner } from './ui';
import { toast } from 'react-hot-toast';
import { notificationHttp, monitoringHttp } from '../services/httpClient';

interface Notification {
  id: number;
  name: string;
  notificationTypeId: number;
  description: string;
}

interface NotificationListModalProps {
  monitorId: number;
  onClose: () => void;
}

export function NotificationListModal({ monitorId, onClose }: NotificationListModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingNotifications, setUpdatingNotifications] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notificationList, monitorNotifications] = await Promise.all([
          notificationHttp.get('/api/Notification/SelectNotificationItemList'),
          monitoringHttp.get(`/api/MonitorNotification/monitorNotifications/${monitorId}`)
        ]);

        setNotifications(notificationList.data);
        setSelectedNotifications(monitorNotifications.data.map((n: any) => n.notificationId));
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        toast.error('Failed to load notifications');
        onClose();
      }
    };

    fetchData();
  }, [monitorId]);

  const handleNotificationToggle = async (notificationId: number) => {
    try {
      setUpdatingNotifications(prev => [...prev, notificationId]);
      const isSelected = selectedNotifications.includes(notificationId);
      
      const endpoint = isSelected ? 'removeMonitorNotification' : 'addMonitorNotification';
      const payload = {
        monitorId,
        notificationId
      };

      await monitoringHttp.post(`/api/MonitorNotification/${endpoint}`, payload);
      
      setSelectedNotifications(prev => 
        isSelected
          ? prev.filter(id => id !== notificationId)
          : [...prev, notificationId]
      );

      toast.success(
        `Notification ${isSelected ? 'removed from' : 'added to'} monitor`,
        { position: 'bottom-right' }
      );
    } catch (error) {
      console.error('Failed to update notification:', error);
      toast.error(
        `Failed to ${isSelected ? 'remove' : 'add'} notification`,
        { position: 'bottom-right' }
      );
    } finally {
      setUpdatingNotifications(prev => prev.filter(id => id !== notificationId));
    }
  };

  // Add type mapping
  const notificationTypeMap: Record<number, string> = {
    1: 'Email',
    2: 'Microsoft Teams',
    3: 'Telegram',
    4: 'Slack',
    5: 'Webhook',
    6: 'Push'
  };

  // Add icon mapping
  const notificationTypeIcons: Record<string, JSX.Element> = {
    'Email': <Mail className="w-4 h-4" />,
    'Microsoft Teams': <MessagesSquare className="w-4 h-4" />,
    'Telegram': <Send className="w-4 h-4" />,
    'Slack': <MessageSquare className="w-4 h-4" />,
    'Webhook': <Webhook className="w-4 h-4" />,
    'Push': <Bell className="w-4 h-4" />
  };

  // Group notifications by type
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const type = notificationTypeMap[notification.notificationTypeId] || 'Other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
      <div className="w-full max-w-3xl dark:bg-gray-900 bg-gray-50 rounded-lg shadow-lg max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-medium dark:text-white">Monitor Notifications</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[calc(80vh-120px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedNotifications).map(([type, items]) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    {notificationTypeIcons[type]}
                    {type}
                  </h3>
                  <div className="space-y-2">
                    {items.map((notification) => (
                      <label
                        key={notification.id}
                        className="flex items-center p-3 rounded-lg dark:bg-gray-700/50 bg-gray-50 hover:bg-gray-100 
                                 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNotifications.includes(notification.id)}
                          onChange={() => handleNotificationToggle(notification.id)}
                          disabled={updatingNotifications.includes(notification.id)}
                          className="mr-3"
                        />
                        {updatingNotifications.includes(notification.id) && (
                          <LoadingSpinner size="sm" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium dark:text-white">{notification.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{notification.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 