import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from '../auth/msalConfig';

// Create a dedicated MSAL instance for MS Graph operations
const msalInstance = new PublicClientApplication(msalConfig);

class MsalService {
  private initialized = false;

  private async initialize() {
    if (!this.initialized) {
      await msalInstance.initialize();
      this.initialized = true;
    }
  }

  private async ensureActiveAccount() {
    await this.initialize();
    const currentAccount = msalInstance.getActiveAccount();
    if (!currentAccount) {
      // If no active account, get all accounts and set the first one as active
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      } else {
        throw new Error('No accounts found. Please sign in first.');
      }
    }
  }

  async getMsGraphToken(): Promise<string> {
    try {
      await this.ensureActiveAccount();
      
      const account = msalInstance.getActiveAccount();
      if (!account) {
        throw new Error('No active account! Verify a user is signed in and setActiveAccount has been called.');
      }

      const response = await msalInstance.acquireTokenSilent({
        scopes: ['User.Read'],
        account: account
      });
      
      return response.accessToken;
    } catch (error) {
      console.error('Error getting MS Graph token:', error);
      throw error;
    }
  }

  async getUserPhoto(): Promise<string | null> {
    try {
      let token;
      try {
        token = await this.getMsGraphToken();
      } catch (error) {
        console.warn('Failed to get MS Graph token:', error);
        return null;
      }

      const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch user photo:', response.status);
        return null;
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error fetching user photo:', error);
      return null;
    }
  }
}

// Create and export a singleton instance
const msalService = new MsalService();
export { msalService };
export default msalService; 