import React, { useState, useEffect } from 'react';
import { Plus, Bell, Trash2, AlertCircle, Check, Loader2 } from 'lucide-react';
import notificationService from '../services/notificationService';
import { NotificationItem } from '../services/notificationService';

interface NotificationFormProps {
  onClose: () => void;
  onSave: (notification: Partial<NotificationItem>) => void;
}

function NotificationForm({ onClose, onSave }: NotificationFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, notificationTypeId: type });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      {/* ... form JSX ... */}
    </div>
  );
}

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const data = await notificationService.getNotifications();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        setNotification({
          type: 'error',
          message: 'Failed to load notifications'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const getTypeLabel = (typeId: number) => {
    switch (typeId) {
      case 1: return 'Email';
      case 2: return 'Microsoft Teams';
      case 3: return 'Slack';
      case 4: return 'Telegram';
      case 5: return 'Webhook';
      case 6: return 'Push';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading notifications...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Notification Management</h1>
            <p className="dark:text-gray-400 text-gray-600">Configure and manage notification channels</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                     text-white transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            Add Notification
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            notification.type === 'success' 
              ? 'dark:bg-green-900/20 bg-green-50 dark:text-green-200 text-green-800'
              : 'dark:bg-red-900/20 bg-red-50 dark:text-red-200 text-red-800'
          }`}>
            {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {notification.message}
          </div>
        )}

        {/* Notifications List */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-gray-700 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Type</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(item => (
                  <tr key={item.id} className="dark:hover:bg-gray-700 hover:bg-gray-50 border-t 
                                             dark:border-gray-700 border-gray-200 transition-colors duration-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                        <span className="dark:text-white text-gray-900 font-medium">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 dark:text-gray-300 text-gray-700">
                      {item.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                     bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                        {getTypeLabel(item.notificationTypeId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                       transition-colors duration-200 text-red-500 dark:text-red-400">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Notification Form */}
      {showForm && (
        <NotificationForm
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}