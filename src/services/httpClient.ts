import axios, { AxiosInstance, AxiosError } from 'axios';
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from '../auth/msalConfig';

class HttpClient {
  private static monitoringInstance: HttpClient;
  private static authInstance: HttpClient;
  private static notificationInstance: HttpClient;
  private axiosInstance: AxiosInstance;
  private msalInstance: PublicClientApplication;
  private initialized: boolean = false;

  private constructor(baseURL: string) {
    this.axiosInstance = axios.create({ baseURL });
    this.msalInstance = new PublicClientApplication(msalConfig);
    this.initialize();
  }

  private async initialize() {
    if (!this.initialized) {
      try {
        await this.msalInstance.initialize();
        this.initialized = true;
        this.setupInterceptors();
      } catch (error) {
        console.error('Failed to initialize MSAL:', error);
      }
    }
  }

  private setupInterceptors() {
    // Request interceptor to add token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (!this.initialized) {
          await this.initialize();
        }

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
          if (!this.initialized) {
            await this.initialize();
          }

          // Clear existing tokens
          localStorage.removeItem('authToken');
          localStorage.removeItem('userInfo');
          
          try {
            // Try to get current account
            const currentAccounts = this.msalInstance.getAllAccounts();
            if (currentAccounts.length > 0) {
              // Try to get a new token
              const tokenResponse = await this.msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: currentAccounts[0]
              });
              
              // Store the new token
              localStorage.setItem('authToken', tokenResponse.accessToken);
              
              // Fetch and store user info
              try {
                const userEmail = currentAccounts[0].username;
                const userResponse = await this.axiosInstance.get(
                  `${import.meta.env.VITE_APP_AUTH_API_URL}api/user/${userEmail}`,
                  {
                    headers: {
                      Authorization: `Bearer ${tokenResponse.accessToken}`
                    }
                  }
                );
                localStorage.setItem('userInfo', JSON.stringify(userResponse.data));
              } catch (error) {
                console.error('Failed to fetch user info:', error);
              }
              
              // Retry the failed request with the new token
              const config = error.config;
              if (config) {
                config.headers['Authorization'] = `Bearer ${tokenResponse.accessToken}`;
                return this.axiosInstance(config);
              }
            } else {
              // If no account is found, trigger interactive login
              await this.msalInstance.loginRedirect(loginRequest);
            }
          } catch (msalError) {
            console.error('Failed to re-authenticate:', msalError);
            // If silent token acquisition fails, trigger interactive login
            await this.msalInstance.loginRedirect(loginRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public static async getMonitoringInstance(): Promise<AxiosInstance> {
    if (!HttpClient.monitoringInstance) {
      HttpClient.monitoringInstance = new HttpClient(import.meta.env.VITE_APP_MONITORING_API_URL);
      await HttpClient.monitoringInstance.initialize();
    }
    return HttpClient.monitoringInstance.axiosInstance;
  }

  public static async getAuthInstance(): Promise<AxiosInstance> {
    if (!HttpClient.authInstance) {
      HttpClient.authInstance = new HttpClient(import.meta.env.VITE_APP_AUTH_API_URL);
      await HttpClient.authInstance.initialize();
    }
    return HttpClient.authInstance.axiosInstance;
  }

  public static async getNotificationInstance(): Promise<AxiosInstance> {
    if (!HttpClient.notificationInstance) {
      HttpClient.notificationInstance = new HttpClient(import.meta.env.VITE_APP_NOTIFICATION_API_URL);
      await HttpClient.notificationInstance.initialize();
    }
    return HttpClient.notificationInstance.axiosInstance;
  }
}

// Create and initialize instances
let monitoringHttp: AxiosInstance;
let authHttp: AxiosInstance;
let notificationHttp: AxiosInstance;

// Initialize instances
(async () => {
  monitoringHttp = await HttpClient.getMonitoringInstance();
  authHttp = await HttpClient.getAuthInstance();
  notificationHttp = await HttpClient.getNotificationInstance();
})();

export { monitoringHttp, authHttp, notificationHttp }; 