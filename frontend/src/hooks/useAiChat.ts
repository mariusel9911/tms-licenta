import { useState, useCallback, useRef } from 'react';
import { sendChatMessageApi } from '@/api/ai.api';
import type { ChatMessage } from '@/types/ai.types';

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    // Create AbortController for this request
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const responseText = await sendChatMessageApi(trimmed, controller.signal);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      // Silently ignore aborted requests (user closed panel)
      if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') {
        return;
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to get a response. Please try again.';
      setError(msg);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [isLoading]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages, cancelRequest };
}
