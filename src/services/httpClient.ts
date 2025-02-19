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
    
    // Initialize MSAL immediately and get token if possible
    this.msalInstance.initialize().then(() => {
      const currentAccounts = this.msalInstance.getAllAccounts();
      if (currentAccounts.length > 0) {
        this.msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: currentAccounts[0]
        }).then(tokenResponse => {
          localStorage.setItem('authToken', tokenResponse.accessToken);
        }).catch(console.error);
      }
    }).catch(console.error);

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
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
        } catch  {
          const token = localStorage.getItem('authToken');
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
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
          console.log('Token expired. Redirecting to login...');
          await this.msalInstance.loginRedirect(loginRequest);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getMonitoringInstance(): AxiosInstance {
    if (!HttpClient.monitoringInstance) {
      HttpClient.monitoringInstance = new HttpClient(import.meta.env.VITE_MONITORING_API_URL);
    }
    return HttpClient.monitoringInstance.axiosInstance;
  }

  public static getAuthInstance(): AxiosInstance {
    if (!HttpClient.authInstance) {
      HttpClient.authInstance = new HttpClient(import.meta.env.VITE_AUTH_API_URL);
    }
    return HttpClient.authInstance.axiosInstance;
  }

  public static getNotificationInstance(): AxiosInstance {
    if (!HttpClient.notificationInstance) {
      HttpClient.notificationInstance = new HttpClient(import.meta.env.VITE_NOTIFICATION_API_URL);
    }
    return HttpClient.notificationInstance.axiosInstance;
  }
}

export const monitoringHttp = HttpClient.getMonitoringInstance();
export const authHttp = HttpClient.getAuthInstance();
export const notificationHttp = HttpClient.getNotificationInstance(); 