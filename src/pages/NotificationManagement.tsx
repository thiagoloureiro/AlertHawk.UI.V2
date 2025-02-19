import React, { useState, useEffect } from 'react';
import { Plus, Bell, Trash2, AlertCircle, Check, Loader2, Mail, MessageSquare, Slack, Smartphone, Webhook, Edit, X } from 'lucide-react';
import notificationService from '../services/notificationService';
import { NotificationItem, NotificationType } from '../services/notificationService';
import { toast } from 'react-hot-toast';
import monitorService from '../services/monitorService';
import { MonitorGroup } from '../services/monitorService';
import { data } from 'react-router-dom';

interface NotificationFormProps {
  onClose: () => void;
  onSave: (notification: Partial<NotificationItem>) => void;
  notification?: NotificationItem;
  monitorGroups: MonitorGroup[];
}

function NotificationForm({ onClose, onSave, notification, monitorGroups }: NotificationFormProps) {
  const [name, setName] = useState(notification?.name || '');
  const [description, setDescription] = useState(notification?.description || '');
  const [type, setType] = useState(notification?.notificationTypeId || 1);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [formData, setFormData] = useState({
    teams: {
      webHookUrl: notification?.notificationTeams?.webHookUrl || ''
    },
    slack: {
      webHookUrl: notification?.notificationSlack?.webHookUrl || '',
      channel: notification?.notificationSlack?.channel || ''
    },
    telegram: {
      chatId: notification?.notificationTelegram?.chatId || '',
      telegramBotToken: notification?.notificationTelegram?.telegramBotToken || ''
    },
    webhook: {
      message: notification?.notificationWebHook?.message || '',
      webHookUrl: notification?.notificationWebHook?.webHookUrl || '',
      body: notification?.notificationWebHook?.body || '',
      headers: notification?.notificationWebHook?.headersJson || ''
    },
    email: {
      fromEmail: notification?.notificationEmail?.fromEmail || '',
      hostname: notification?.notificationEmail?.hostname || '',
      port: notification?.notificationEmail?.port || '',
      username: notification?.notificationEmail?.username || '',
      password: notification?.notificationEmail?.password || '',
      toEmail: notification?.notificationEmail?.toEmail || '',
      toCCEmail: notification?.notificationEmail?.toCCEmail || '',
      toBCCEmail: notification?.notificationEmail?.toBCCEmail || '',
      enableSsl: notification?.notificationEmail?.enableSsl || false,
      subject: notification?.notificationEmail?.subject || '',
      isHtmlBody: notification?.notificationEmail?.isHtmlBody || false,
      body: notification?.notificationEmail?.body || ''
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(notification?.monitorGroupId || monitorGroups[0]?.id || 1);

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

  const handleFormDataChange = (section: string, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const basePayload = {
        id: notification?.id || 0,
        monitorGroupId: selectedGroupId,
        name,
        notificationTypeId: type,
        description,
        notificationSlack: {
          notificationId: 0,
          channel: "",
          webHookUrl: ""
        },
        notificationEmail: {
          notificationId: 0,
          fromEmail: "",
          toEmail: "",
          hostname: "",
          port: 0,
          username: "",
          password: "",
          toCCEmail: "",
          toBCCEmail: "",
          enableSsl: true,
          subject: "",
          body: "",
          isHtmlBody: true
        },
        notificationTeams: {
          notificationId: 0,
          webHookUrl: ""
        },
        notificationTelegram: {
          notificationId: 0,
          chatId: 0,
          telegramBotToken: ""
        },
        notificationWebHook: {
          notificationId: 0,
          message: "",
          webHookUrl: "",
          body: "",
          headersJson: "",
          headers: [{
            item1: "",
            item2: ""
          }]
        }
      };

      // Update the specific notification type data based on form input
      switch (type) {
        case 1: // Email
        basePayload.notificationEmail = {
          notificationId: 0,
          fromEmail: formData.email.fromEmail,
          toEmail: formData.email.toEmail,
          hostname: formData.email.hostname,
          port: Number(formData.email.port),
          username: formData.email.username,
          password: formData.email.password,
          toCCEmail: formData.email.toCCEmail,
          toBCCEmail: formData.email.toBCCEmail,
          enableSsl: formData.email.enableSsl,
          subject: formData.email.subject,
          body: formData.email.body,
          isHtmlBody: formData.email.isHtmlBody
        };
        break;
        case 2: // Teams
          basePayload.notificationTeams = {
            notificationId: 0,
            webHookUrl: formData.teams.webHookUrl
          };
          break;
        case 3: // Telegram
          basePayload.notificationTelegram = {
            notificationId: 0,
            chatId: Number(formData.telegram.chatId),
            telegramBotToken: formData.telegram.telegramBotToken
          };
          break;
        case 4: // Slack
          basePayload.notificationSlack = {
            notificationId: 0,
            channel: formData.slack.channel,
            webHookUrl: formData.slack.webHookUrl
          };
          break;
          case 5: // Webhook
          basePayload.notificationWebHook = {
            notificationId: 0,
            message: formData.webhook.message,
            webHookUrl: formData.webhook.webHookUrl,
            body: formData.webhook.body,
            headersJson: formData.webhook.headers,
            headers: [{
              item1: formData.webhook.headers.item1,
              item2: formData.webhook.headers.item2
            }]
          };
          break;
        case 6: // Push notification - no extra fields needed
          break;
        // Other cases will be added when you provide the payloads
      }

      const response = await onSave(basePayload);
      if (response.success) {
        toast.success(
          notification 
            ? 'Notification updated successfully' 
            : 'Notification created successfully',
          { position: 'bottom-right' }
        );
        onClose();
      } else {
        toast.error(
          notification
            ? 'Failed to update notification'
            : 'Failed to create notification',
          { position: 'bottom-right' }
        );
      }
    } catch (error) {
      toast.error(
        notification
          ? 'Failed to update notification'
          : 'Failed to create notification',
        { position: 'bottom-right' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Render type-specific fields
  const renderTypeSpecificFields = () => {
    switch (type) {
      case 2: // MS Teams
        return (
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Webhook URL
            </label>
            <input
              type="text"
              value={formData.teams.webHookUrl}
              onChange={(e) => handleFormDataChange('teams', 'webHookUrl', e.target.value)}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Teams webhook URL"
            />
          </div>
        );

      case 4: // Slack
        return (
          <>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Webhook URL
              </label>
              <input
                type="text"
                value={formData.slack.webHookUrl}
                onChange={(e) => handleFormDataChange('slack', 'webHookUrl', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Slack webhook URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={formData.slack.channel}
                onChange={(e) => handleFormDataChange('slack', 'channel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter channel name"
              />
            </div>
          </>
        );

      case 3: // Telegram
        return (
          <>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Chat ID
              </label>
              <input
                type="number"
                value={formData.telegram.chatId}
                onChange={(e) => {
                  // Remove any decimal points and convert to integer
                  const value = parseInt(e.target.value);
                  handleFormDataChange('telegram', 'chatId', isNaN(value) ? '' : value.toString());
                }}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter chat ID (numbers only)"
                step="1" // Only allow whole numbers
                onKeyDown={(e) => {
                  // Prevent decimal point and e (scientific notation)
                  if (e.key === '.' || e.key === 'e') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="text"
                value={formData.telegram.telegramBotToken}
                onChange={(e) => handleFormDataChange('telegram', 'telegramBotToken', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter bot token"
              />
            </div>
          </>
        );

      case 5: // Webhook
        return (
          <>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Message
              </label>
              <input
                type="text"
                value={formData.webhook.message}
                onChange={(e) => handleFormDataChange('webhook', 'message', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter message"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Webhook URL
              </label>
              <input
                type="text"
                value={formData.webhook.webHookUrl}
                onChange={(e) => handleFormDataChange('webhook', 'webHookUrl', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter webhook URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Body
              </label>
              <textarea
                value={formData.webhook.body}
                onChange={(e) => handleFormDataChange('webhook', 'body', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter body"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Headers (JSON)
              </label>
              <textarea
                value={formData.webhook.headers}
                onChange={(e) => handleFormDataChange('webhook', 'headers', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter headers in JSON format"
                rows={4}
              />
            </div>
          </>
        );

      case 1: // Email
  return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  value={formData.email.fromEmail}
                  onChange={(e) => handleFormDataChange('email', 'fromEmail', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter from email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  SMTP Server (Hostname)
                </label>
                <input
                  type="text"
                  value={formData.email.hostname}
                  onChange={(e) => handleFormDataChange('email', 'hostname', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter SMTP server hostname"
                />
              </div>
        </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={formData.email.port}
                  onChange={(e) => handleFormDataChange('email', 'port', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter port"
                />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.email.username}
                  onChange={(e) => handleFormDataChange('email', 'username', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={formData.email.password}
                onChange={(e) => handleFormDataChange('email', 'password', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  To Email
                </label>
                <input
                  type="email"
                  value={formData.email.toEmail}
                  onChange={(e) => handleFormDataChange('email', 'toEmail', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="To email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  CC Email
                </label>
                <input
                  type="email"
                  value={formData.email.toCCEmail}
                  onChange={(e) => handleFormDataChange('email', 'toCCEmail', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="CC email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  BCC Email
                </label>
                <input
                  type="email"
                  value={formData.email.toBCCEmail}
                  onChange={(e) => handleFormDataChange('email', 'toBCCEmail', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                         dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="BCC email"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.email.enableSsl}
                  onChange={(e) => handleFormDataChange('email', 'enableSsl', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium dark:text-gray-300">
                  Enable SSL
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.email.isHtmlBody}
                  onChange={(e) => handleFormDataChange('email', 'isHtmlBody', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium dark:text-gray-300">
                  HTML Body
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={formData.email.subject}
                onChange={(e) => handleFormDataChange('email', 'subject', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                Body
              </label>
              <textarea
                value={formData.email.body}
                onChange={(e) => handleFormDataChange('email', 'body', e.target.value)}
                className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email body"
                rows={4}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-[70%] dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                   transition-colors duration-200 text-gray-500 dark:text-gray-400"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
          {notification ? 'Edit Notification' : 'Create Notification'}
        </h3>
        
        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto px-4">
          {/* Common fields */}
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

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">
              Monitor Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                       dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {monitorGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type-specific fields */}
          {renderTypeSpecificFields()}

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
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                       disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {notification ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {notification ? 'Update' : 'Create'}
                </>
              )}
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
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                   transition-colors duration-200 text-gray-500 dark:text-gray-400"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

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
  const [monitorGroups, setMonitorGroups] = useState<MonitorGroup[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [notifications, types, groups] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getNotificationTypes(),
          monitorService.getMonitorGroupList()
        ]);
        setNotifications(notifications);
        setNotificationTypes(types);
        setMonitorGroups(groups);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        toast.error('Failed to load data', { position: 'bottom-right' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getTypeLabel = (typeId: number) => {
    const type = notificationTypes.find(t => t.id === typeId);
    return type?.name || 'Unknown';
  };

  const handleSave = async (notificationData: Partial<NotificationItem>) => {
    try {
      if (selectedNotification) {
        // Create base payload for update
        const updatePayload = {
          id: selectedNotification.id,
          monitorGroupId: notificationData.monitorGroupId || selectedNotification.monitorGroupId,
          name: notificationData.name || selectedNotification.name,
          notificationTypeId: notificationData.notificationTypeId || selectedNotification.notificationTypeId,
          description: notificationData.description || selectedNotification.description,
          notificationSlack: notificationData.notificationSlack || {
            notificationId: 0,
            channel: "",
            webHookUrl: ""
          },
          notificationEmail: notificationData.notificationEmail || {
            notificationId: 0,
            fromEmail: "",
            toEmail: "",
            hostname: "",
            port: 0,
            username: "",
            password: "",
            toCCEmail: "",
            toBCCEmail: "",
            enableSsl: true,
            subject: "",
            body: "",
            isHtmlBody: true
          },
          notificationTeams: notificationData.notificationTeams || {
            notificationId: 0,
            webHookUrl: ""
          },
          notificationTelegram:  notificationData.notificationTelegram || {
            notificationId: 0,
            chatId: 0,
            telegramBotToken: ""
          },
          notificationWebHook: notificationData.notificationWebHook || {
            notificationId: 0,
            message: "",
            webHookUrl: "",
            body: "",
            headersJson: "",
            headers: [{
              item1: "",
              item2: ""
            }]
          }
        };

        const response = await notificationService.updateNotification(updatePayload as NotificationItem);
        if (response.success) {
          const data = await notificationService.getNotifications();
          setNotifications(data);
          return { success: true };
        }
      } else {
        // Handle create - remains the same
        const response = await notificationService.createNotification(notificationData);
        const data = await notificationService.getNotifications();
        setNotifications(data);
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error('Failed to save notification:', error);
      return { success: false, error };
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

  const getGroupName = (groupId: number) => {
    const group = monitorGroups.find(g => g.id === groupId);
    return group?.name || 'Unknown Group';
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
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Group</th>
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
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                     bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {getGroupName(item.monitorGroupId)}
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
          monitorGroups={monitorGroups}
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