import React, { useState, useEffect } from 'react';
import { Plus, Bell, Trash2, AlertCircle, Check, Loader2, Mail, MessageSquare, Slack, Smartphone, Webhook, Edit } from 'lucide-react';
import notificationService from '../services/notificationService';
import { NotificationItem, NotificationType } from '../services/notificationService';
import { toast } from 'react-hot-toast';

interface NotificationFormProps {
  onClose: () => void;
  onSave: (notification: Partial<NotificationItem>) => void;
  notification?: NotificationItem;
}

function NotificationForm({ onClose, onSave, notification }: NotificationFormProps) {
  const [name, setName] = useState(notification?.name || '');
  const [description, setDescription] = useState(notification?.description || '');
  const [type, setType] = useState(notification?.notificationTypeId || 1);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);

  useEffect(() => {
    const fetchNotificationTypes = async () => {
      try {
        const types = await notificationService.getNotificationTypes();
        setNotificationTypes(types);
      } catch (error) {
        console.error('Failed to fetch notification types:', error);
        toast.error('Failed to load notification types', { position: 'bottom-right' });
      }
    };

    fetchNotificationTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, notificationTypeId: type });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
          {notification ? 'Edit Notification' : 'Create Notification'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                     dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Enter notification name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                     dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Enter description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Notification Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                     dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {notificationTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                     dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              {notification ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const getNotificationIcon = (typeId: number) => {
  const baseClass = "w-4 h-4 dark:text-gray-300 text-gray-600";
  
  switch (typeId) {
    case 1: // Email
      return <Mail className={baseClass} />;
    case 2: // Microsoft Teams
      return <MessageSquare className={baseClass} />;
    case 3: // Telegram
      return <Smartphone className={baseClass} />;
    case 4: // Slack
      return <Slack className={baseClass} />;
    case 5: // Webhook
      return <Webhook className={baseClass} />;
    case 6: // Push Notification
      return <Smartphone className={baseClass} />;
    default:
      return <Bell className={baseClass} />;
  }
};

// Add DeleteConfirmation component
interface DeleteConfirmationProps {
  notification: NotificationItem;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

function DeleteConfirmation({ notification, onConfirm, onCancel, isDeleting }: DeleteConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
          Delete Notification
        </h3>
        <p className="dark:text-gray-300 text-gray-600 mb-6">
          Are you sure you want to delete the notification "{notification.name}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                     dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                     disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<NotificationItem | null>(null);
  const [isDeletingNotification, setIsDeletingNotification] = useState(false);

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

    const fetchNotificationTypes = async () => {
      try {
        const types = await notificationService.getNotificationTypes();
        setNotificationTypes(types);
      } catch (error) {
        console.error('Failed to fetch notification types:', error);
        toast.error('Failed to load notification types', { position: 'bottom-right' });
      }
    };

    fetchNotifications();
    fetchNotificationTypes();
  }, []);

  const getTypeLabel = (typeId: number) => {
    const type = notificationTypes.find(t => t.id === typeId);
    return type?.name || 'Unknown';
  };

  const handleSave = async (notificationData: Partial<NotificationItem>) => {
    try {
      setIsLoading(true);
      if (selectedNotification) {
        // Handle edit
        await notificationService.updateNotification({
          ...selectedNotification,
          ...notificationData
        });
        toast.success('Notification updated successfully', { position: 'bottom-right' });
      } else {
        // Handle create
        await notificationService.createNotification(notificationData);
        toast.success('Notification created successfully', { position: 'bottom-right' });
      }
      
      // Refresh the list and reset form
      await fetchNotifications();
      setShowForm(false);
      setSelectedNotification(null);
    } catch (error) {
      console.error('Failed to save notification:', error);
      toast.error(
        selectedNotification 
          ? 'Failed to update notification' 
          : 'Failed to create notification',
        { position: 'bottom-right' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (notification: NotificationItem) => {
    try {
      setIsDeletingNotification(true);
      await notificationService.deleteNotification(notification.id);
      toast.success('Notification deleted successfully', { position: 'bottom-right' });
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification', { position: 'bottom-right' });
    } finally {
      setIsDeletingNotification(false);
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
            onClick={() => {
              setSelectedNotification(null);
              setShowForm(true);
            }}
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
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(item.notificationTypeId)}
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedNotification(item);
                            setShowForm(true);
                          }}
                          className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                   transition-colors duration-200 text-blue-500 dark:text-blue-400"
                          title="Edit Notification"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setNotificationToDelete(item);
                            setShowDeleteConfirmation(true);
                          }}
                          className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                   transition-colors duration-200 text-red-500 dark:text-red-400"
                          title="Delete Notification"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
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
          onClose={() => {
            setShowForm(false);
            setSelectedNotification(null);
          }}
          onSave={handleSave}
          notification={selectedNotification}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && notificationToDelete && (
        <DeleteConfirmation
          notification={notificationToDelete}
          onConfirm={async () => {
            setIsDeletingNotification(true);
            try {
              const response = await notificationService.deleteNotification(notificationToDelete.id);
              if (response.success) {
                toast.success('Notification deleted successfully', { position: 'bottom-right' });
                setShowDeleteConfirmation(false);
                setNotificationToDelete(null);
                const data = await notificationService.getNotifications();
                setNotifications(data);
              } else {
                toast.error('Failed to delete notification', { position: 'bottom-right' });
              }
            } catch (error) {
              toast.error('Failed to delete notification', { position: 'bottom-right' });
            } finally {
              setIsDeletingNotification(false);
            }
          }}
          onCancel={() => {
            setShowDeleteConfirmation(false);
            setNotificationToDelete(null);
          }}
          isDeleting={isDeletingNotification}
        />
      )}
    </div>
  );
}