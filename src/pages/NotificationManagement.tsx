import React, { useState } from 'react';
import { Plus, Bell, Trash2, AlertCircle, Check } from 'lucide-react';
import type { Notification, NotificationType } from '../types';

const demoNotifications: Notification[] = [
  {
    id: '1',
    name: 'Production Alerts',
    type: 'ms-teams',
    createdAt: '2024-03-15T10:00:00Z',
    isActive: true
  },
  {
    id: '2',
    name: 'Critical Issues',
    type: 'slack',
    createdAt: '2024-03-14T15:30:00Z',
    isActive: true
  },
  {
    id: '3',
    name: 'System Updates',
    type: 'telegram',
    createdAt: '2024-03-13T09:15:00Z',
    isActive: true
  },
  {
    id: '4',
    name: 'Maintenance Alerts',
    type: 'email',
    createdAt: '2024-03-12T14:20:00Z',
    isActive: false
  }
];

interface NotificationFormProps {
  onClose: () => void;
  onSave: (notification: Partial<Notification>) => void;
}

function NotificationForm({ onClose, onSave }: NotificationFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NotificationType>('ms-teams');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Notification name is required');
      return;
    }

    onSave({
      name: name.trim(),
      type,
      isActive: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b dark:border-gray-700 border-gray-200">
          <h3 className="text-xl font-semibold dark:text-white text-gray-900">
            Create New Notification
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 
                          text-red-700 dark:text-red-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
                Notification Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg dark:bg-gray-700 bg-white border 
                         dark:border-gray-600 border-gray-300 dark:text-white text-gray-900 
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
                placeholder="Enter notification name"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
                Notification Type
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType)}
                className="w-full px-4 py-2 rounded-lg dark:bg-gray-700 bg-white border 
                         dark:border-gray-600 border-gray-300 dark:text-white text-gray-900 
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
              >
                <option value="ms-teams">Microsoft Teams</option>
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="push">Push Notification</option>
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                       dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                       transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white
                       transition-colors duration-200"
            >
              Create Notification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NotificationManagement() {
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSave = async (notificationData: Partial<Notification>) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setNotification({
        type: 'success',
        message: 'Notification created successfully'
      });
      setShowForm(false);
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to create notification'
      });
    }
  };

  const getTypeLabel = (type: NotificationType) => {
    switch (type) {
      case 'ms-teams': return 'Microsoft Teams';
      case 'slack': return 'Slack';
      case 'telegram': return 'Telegram';
      case 'push': return 'Push Notification';
      case 'email': return 'Email';
      case 'webhook': return 'Webhook';
      default: return type;
    }
  };

  const getTypeColor = (type: NotificationType) => {
    switch (type) {
      case 'ms-teams': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'slack': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'telegram': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'push': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'email': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'webhook': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

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
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Status</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {demoNotifications.map(notification => (
                  <tr 
                    key={notification.id}
                    className="dark:hover:bg-gray-700 hover:bg-gray-50 border-t 
                             dark:border-gray-700 border-gray-200 transition-colors duration-200"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                        <span className="dark:text-white text-gray-900 font-medium">
                          {notification.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                   ${getTypeColor(notification.type)}`}>
                        {getTypeLabel(notification.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 dark:text-gray-300 text-gray-700">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                   ${notification.isActive 
                                     ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                     : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {notification.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                 transition-colors duration-200 text-red-500 dark:text-red-400"
                      >
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