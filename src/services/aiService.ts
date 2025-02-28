import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from '../auth/msalConfig';

// Create a dedicated MSAL instance for MS Graph operations
const msalInstance = new PublicClientApplication(msalConfig);
msalInstance.initialize();

interface ChatResponse {
  user_mail: string;
  conversation_id: string;
  message_id: string;
  timestamp: number;
  output: {
    content: string;
    type: string;
  };
}

class AiService {
  private baseUrl = 'https://dev.api.abby.abb.com/api/v1';

  private async ensureActiveAccount() {
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
        scopes: [import.meta.env.VITE_MSAL_SCOPES],
        account: account
      });
      
      return response.accessToken;
    } catch (error) {
      console.error('Error getting MS Graph token:', error);
      throw error;
    }
  }

  async getNewConversationId(): Promise<{ conversation_id: string; user_mail: string }> {
    try {
      const token = await this.getMsGraphToken();
      const response = await fetch(`${this.baseUrl}/get_new_conversation_id/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*',
          'User-Agent': 'AlertHawk-UI'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting conversation ID:', error);
      throw error;
    }
  }

  async chat(conversationId: string, prompt: string, onMessage: (message: ChatResponse) => void): Promise<void> {
    try {
      const token = await this.getMsGraphToken();
      
      const formData = new FormData();
      formData.append('data', JSON.stringify({
        conversation_id: conversationId,
        model: "openai-chatgpt4-mini",
        prompt: prompt
      }));

      const response = await fetch(`${this.baseUrl}/chat/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'User-Agent': 'AlertHawk-UI'
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              onMessage(jsonData);
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const token = await this.getMsGraphToken();
      
      const response = await fetch(`${this.baseUrl}/delete_conversation/?conversation_id=${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*',
          'User-Agent': 'AlertHawk-UI'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
}

export const aiService = new AiService();
export { msalInstance };
export default aiService;