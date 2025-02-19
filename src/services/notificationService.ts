import { notificationHttp } from './httpClient';

interface NotificationItem {
  id: number;
  monitorGroupId: number;
  name: string;
  notificationTypeId: number;
  description: string;
  notificationSlack: Record<string, unknown> | null;
  notificationEmail: Record<string, unknown> | null;
  notificationTeams: Record<string, unknown> | null;
  notificationTelegram: Record<string, unknown> | null;
  notificationWebHook: {
    notificationId: number;
    message: string;
    webHookUrl: string;
    body: string;
    headersJson: string;
    headers: Record<string, string> | null;
  } | null;
  notificationPush: Record<string, unknown> | null;
}

export interface NotificationType {
  id: number;
  name: string;
  description: string;
}

export class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async getNotifications(): Promise<NotificationItem[]> {
    const response = await notificationHttp.get<NotificationItem[]>(
      `/api/Notification/SelectNotificationItemList`
    );
    return response.data;
  }

  async getNotificationTypes(): Promise<NotificationType[]> {
    const response = await notificationHttp.get('/api/NotificationType/GetNotificationType');
    return response.data;
  }

  async createNotification(data: Partial<NotificationItem>) {
    try {
      const response = await notificationHttp.post(`/api/Notification/createNotificationItem`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error };
    }
  }

  async updateNotification(data: NotificationItem) {
    try {
      const payload = {
        id: data.id,
        monitorGroupId: data.monitorGroupId,
        name: data.name,
        notificationTypeId: data.notificationTypeId,
        description: data.description,
        notificationSlack: {
          notificationId: 0,
          channel: data.notificationSlack?.channel || "",
          webHookUrl: data.notificationSlack?.webHookUrl || ""
        },
        notificationEmail: {
          notificationId: 0,
          fromEmail: data.notificationEmail?.fromEmail || "",
          toEmail: data.notificationEmail?.toEmail || "",
          hostname: data.notificationEmail?.hostname || "",
          port: data.notificationEmail?.port || 0,
          username: data.notificationEmail?.username || "",
          password: data.notificationEmail?.password || "",
          toCCEmail: data.notificationEmail?.toCCEmail || "",
          toBCCEmail: data.notificationEmail?.toCCEmail,
          enableSsl: data.notificationEmail?.enableSsl,
          subject: data.notificationEmail?.subject || "",
          body: data.notificationEmail?.body || "",
          isHtmlBody: data.notificationEmail?.isHtmlBody || false
        },
        notificationTeams: {
          notificationId: 0,
          webHookUrl: data.notificationTeams?.webHookUrl || ""
        },
        notificationTelegram: {
          notificationId: 0,
          chatId: data.notificationTelegram?.chatId || 0,
          telegramBotToken: data.notificationTelegram?.telegramBotToken || ""
        },
        notificationWebHook: {
          notificationId: 0,
          message: data.notificationWebHook?.message,
          webHookUrl: data.notificationWebHook?.webHookUrl,
          body: data.notificationWebHook?.body,
          headersJson: data.notificationWebHook?.headersJson,
          headers: [{
            item1: data.notificationWebHook?.headers?.item1 || "",
            item2: data.notificationWebHook?.headers?.item2 || ""
          }]
        }
      };

      const response = await notificationHttp.put(`/api/Notification/UpdateNotificationItem`, payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error };
    }
  }

  async deleteNotification(id: number) {
    try {
      await notificationHttp.delete(`/api/Notification/DeleteNotificationItem?id=${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
}

export default NotificationService.getInstance(); 