import { apiClient } from './client';
import type { ChatApiResponse } from '@/types/ai.types';

export async function sendChatMessageApi(message: string, signal?: AbortSignal): Promise<string> {
  const res = await apiClient.post<ChatApiResponse>('/ai/chat', { message }, { signal });
  return res.data.data.response;
}
