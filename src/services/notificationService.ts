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
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/Notification';
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async getNotifications(): Promise<NotificationItem[]> {
    const response = await notificationHttp.get<NotificationItem[]>(
      `${this.baseUrl}/SelectNotificationItemList`
    );
    return response.data;
  }

  async getNotificationTypes(): Promise<NotificationType[]> {
    const response = await notificationHttp.get('/api/NotificationType/GetNotificationType');
    return response.data;
  }

  async createNotification(data: Partial<NotificationItem>) {
    try {
      const response = await notificationHttp.post(`${this.baseUrl}/createNotificationItem`, data);
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

      const response = await notificationHttp.put(`${this.baseUrl}/UpdateNotificationItem`, payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error };
    }
  }

  async deleteNotification(id: number) {
    try {
      await notificationHttp.delete(`${this.baseUrl}/DeleteNotificationItem?id=${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
}

export default NotificationService.getInstance(); 