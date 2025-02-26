import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from '../auth/msalConfig';

class HttpClient {
  private static monitoringInstance: HttpClient;
  private static authInstance: HttpClient;
  private static notificationInstance: HttpClient;
  private axiosInstance: AxiosInstance;
  private msalInstance: PublicClientApplication;

  private constructor(baseURL: string) {
    this.axiosInstance = axios.create({ baseURL });
    this.msalInstance = new PublicClientApplication(msalConfig);
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // First check for stored auth token
        const storedToken = localStorage.getItem('authToken');
        if (storedToken) {
          config.headers['Authorization'] = `Bearer ${storedToken}`;
          return config;
        }

        // If no stored token, try MSAL
        try {
          const currentAccounts = this.msalInstance.getAllAccounts();
          if (currentAccounts.length > 0) {
            const tokenResponse = await this.msalInstance.acquireTokenSilent({
              ...loginRequest,
              account: currentAccounts[0]
            });
            config.headers['Authorization'] = `Bearer ${tokenResponse.accessToken}`;
            localStorage.setItem('authToken', tokenResponse.accessToken);
          }
        } catch (error) {
          console.error('Failed to get token:', error);
        }
        
        return config;
      }
    );

    // Response interceptor to handle 401s
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userInfo');
          
          // Redirect to login page
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  public static getMonitoringInstance(): AxiosInstance {
    if (!HttpClient.monitoringInstance) {
      HttpClient.monitoringInstance = new HttpClient(import.meta.env.VITE_APP_MONITORING_API_URL);
    }
    return HttpClient.monitoringInstance.axiosInstance;
  }

  public static getAuthInstance(): AxiosInstance {
    if (!HttpClient.authInstance) {
      HttpClient.authInstance = new HttpClient(import.meta.env.VITE_APP_AUTH_API_URL);
    }
    return HttpClient.authInstance.axiosInstance;
  }

  public static getNotificationInstance(): AxiosInstance {
    if (!HttpClient.notificationInstance) {
      HttpClient.notificationInstance = new HttpClient(import.meta.env.VITE_APP_NOTIFICATION_API_URL);
    }
    return HttpClient.notificationInstance.axiosInstance;
  }
}

export const monitoringHttp = HttpClient.getMonitoringInstance();
export const authHttp = HttpClient.getAuthInstance();
export const notificationHttp = HttpClient.getNotificationInstance(); 