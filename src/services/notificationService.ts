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
}

export default NotificationService.getInstance(); 