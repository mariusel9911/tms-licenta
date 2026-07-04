export interface ChatMessage {
  id: string;       // local UUID for React key
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatApiResponse {
  success: boolean;
  data: {
    response: string;
  };
}
