interface ChatResponse {
  message_id?: string;
  model?: string;
  timestamp?: number;
  output?: {
    content: string;
    type: string;
  };
  content?: string;
  type?: string;
}

class AiService {
  private baseUrl = import.meta.env.VITE_APP_ABBY_API_URL + 'v1';
  private apiKey = import.meta.env.VITE_APP_ABBY_API_KEY;

  async chat(prompt: string, onMessage: (message: ChatResponse) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/developers/simple_chat/`, {
        method: 'POST',
        headers: {
          'X-ABBY-API-Key': this.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AlertHawk-UI'
        },
        body: JSON.stringify({
          model: "o4-mini",
          input: prompt
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Received API response:', responseData);
      
      // Call the callback with the response data
      onMessage(responseData);
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

}

export const aiService = new AiService();
export default aiService;