import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import { sendChatMessageApi } from '@/api/ai.api';

const mockPost = vi.mocked(apiClient.post);

describe('ai.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendChatMessageApi()', () => {
    it('calls POST /ai/chat with message body', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: { response: 'Hello from AI' } } });

      const result = await sendChatMessageApi('How do orders work?');

      expect(mockPost).toHaveBeenCalledWith('/ai/chat', { message: 'How do orders work?' }, { signal: undefined });
      expect(result).toBe('Hello from AI');
    });

    it('returns the response string from data.data.response', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: { response: 'Specific response' } } });

      const result = await sendChatMessageApi('Another question');

      expect(result).toBe('Specific response');
    });

    it('propagates rejection when apiClient throws', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(sendChatMessageApi('Hello')).rejects.toThrow('Network error');
    });
  });
});
