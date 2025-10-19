import * as signalR from '@microsoft/signalr';
import { toast } from 'react-hot-toast';

export interface SignalRNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  monitorId?: number;
  environment?: number;
  region?: number;
  groupName?: string;
}

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  private getConnectionUrl(): string {
    const baseUrl = import.meta.env.VITE_APP_API_URL || 'https://localhost:7185';
    return `${baseUrl}/notificationHub`;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  async connect(): Promise<void> {
    if (this.connection && this.isConnected) {
      return;
    }

    try {
      const token = this.getAuthToken();
      if (!token) {
        console.warn('No auth token available for SignalR connection');
        return;
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(this.getConnectionUrl(), {
          accessTokenFactory: () => token,
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < 3) {
              return 2000; // 2 seconds for first 3 attempts
            }
            return 10000; // 10 seconds for subsequent attempts
          }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start the connection
      await this.connection.start();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      console.log('SignalR connected successfully');
      toast.success('Real-time notifications connected', { 
        position: 'bottom-right',
        duration: 3000
      });

    } catch (error) {
      console.error('SignalR connection failed:', error);
      this.handleConnectionError();
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Handle connection state changes
    this.connection.onclose((error) => {
      this.isConnected = false;
      console.log('SignalR connection closed', error);
      
      if (error) {
        console.error('Connection closed due to error:', error);
        this.handleConnectionError();
      }
    });

    this.connection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      toast.loading('Reconnecting to notifications...', { 
        id: 'reconnecting',
        position: 'bottom-right'
      });
    });

    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected with connection ID:', connectionId);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      toast.dismiss('reconnecting');
      toast.success('Notifications reconnected', { 
        position: 'bottom-right',
        duration: 3000
      });
    });

    // Handle incoming notifications
    this.connection.on('ReceiveNotification', (notification: SignalRNotification) => {
      this.handleNotification(notification);
    });

    // Handle monitor-specific notifications
    this.connection.on('ReceiveMonitorNotification', (monitorId: number, notification: SignalRNotification) => {
      this.handleNotification(notification);
    });

    // Handle environment-specific notifications
    this.connection.on('ReceiveEnvironmentNotification', (environment: number, notification: SignalRNotification) => {
      this.handleNotification(notification);
    });

    // Handle region-specific notifications
    this.connection.on('ReceiveRegionNotification', (region: number, notification: SignalRNotification) => {
      this.handleNotification(notification);
    });

    // Handle group-specific notifications
    this.connection.on('ReceiveGroupNotification', (groupName: string, notification: SignalRNotification) => {
      this.handleNotification(notification);
    });
  }

  private handleNotification(notification: SignalRNotification): void {
    console.log('Received notification:', notification);

    // Show toast based on notification type
    const toastOptions = {
      position: 'bottom-right' as const,
      duration: notification.type === 'error' ? 8000 : 5000,
      style: {
        background: this.getToastBackground(notification.type),
        color: '#ffffff',
        border: `1px solid ${this.getToastBorder(notification.type)}`
      }
    };

    switch (notification.type) {
      case 'success':
        toast.success(notification.message, {
          ...toastOptions,
          icon: '✅'
        });
        break;
      case 'warning':
        toast(notification.message, {
          ...toastOptions,
          icon: '⚠️'
        });
        break;
      case 'error':
        toast.error(notification.message, {
          ...toastOptions,
          icon: '❌'
        });
        break;
      default:
        toast(notification.message, {
          ...toastOptions,
          icon: 'ℹ️'
        });
    }
  }

  private getToastBackground(type: string): string {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#3b82f6';
    }
  }

  private getToastBorder(type: string): string {
    switch (type) {
      case 'success': return '#059669';
      case 'warning': return '#d97706';
      case 'error': return '#dc2626';
      default: return '#2563eb';
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('Max reconnection attempts reached');
      toast.error('Failed to connect to notifications. Please refresh the page.', {
        position: 'bottom-right',
        duration: 10000
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
        this.isConnected = false;
        console.log('SignalR disconnected');
      } catch (error) {
        console.error('Error disconnecting SignalR:', error);
      }
    }
  }

  // Group management methods
  async joinGroup(groupName: string): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('JoinGroup', groupName);
        console.log(`Joined group: ${groupName}`);
      } catch (error) {
        console.error(`Failed to join group ${groupName}:`, error);
      }
    }
  }

  async leaveGroup(groupName: string): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('LeaveGroup', groupName);
        console.log(`Left group: ${groupName}`);
      } catch (error) {
        console.error(`Failed to leave group ${groupName}:`, error);
      }
    }
  }

  async joinMonitorGroup(monitorId: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('JoinMonitorGroup', monitorId);
        console.log(`Joined monitor group: Monitor_${monitorId}`);
      } catch (error) {
        console.error(`Failed to join monitor group ${monitorId}:`, error);
      }
    }
  }

  async leaveMonitorGroup(monitorId: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('LeaveMonitorGroup', monitorId);
        console.log(`Left monitor group: Monitor_${monitorId}`);
      } catch (error) {
        console.error(`Failed to leave monitor group ${monitorId}:`, error);
      }
    }
  }

  async joinEnvironmentGroup(environment: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('JoinEnvironmentGroup', environment);
        console.log(`Joined environment group: Environment_${environment}`);
      } catch (error) {
        console.error(`Failed to join environment group ${environment}:`, error);
      }
    }
  }

  async leaveEnvironmentGroup(environment: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('LeaveEnvironmentGroup', environment);
        console.log(`Left environment group: Environment_${environment}`);
      } catch (error) {
        console.error(`Failed to leave environment group ${environment}:`, error);
      }
    }
  }

  async joinRegionGroup(region: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('JoinRegionGroup', region);
        console.log(`Joined region group: Region_${region}`);
      } catch (error) {
        console.error(`Failed to join region group ${region}:`, error);
      }
    }
  }

  async leaveRegionGroup(region: number): Promise<void> {
    if (this.connection && this.isConnected) {
      try {
        await this.connection.invoke('LeaveRegionGroup', region);
        console.log(`Left region group: Region_${region}`);
      } catch (error) {
        console.error(`Failed to leave region group ${region}:`, error);
      }
    }
  }

  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state || null;
  }

  isConnectionActive(): boolean {
    return this.isConnected && this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

// Export singleton instance
export const signalRService = new SignalRService();
export default signalRService;
