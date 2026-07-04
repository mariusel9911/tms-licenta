import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/api/ai.api', () => ({
  sendChatMessageApi: vi.fn(),
}));

import { sendChatMessageApi } from '@/api/ai.api';
import { useAiChat } from '../useAiChat';

const mockSendChat = vi.mocked(sendChatMessageApi);

describe('useAiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has initial empty state', () => {
    const { result } = renderHook(() => useAiChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sendMessage appends user + assistant message on success', async () => {
    mockSendChat.mockResolvedValue('AI response');
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hello' });
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: 'AI response' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls sendChatMessageApi with the trimmed message', async () => {
    mockSendChat.mockResolvedValue('response');
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('  Hello World  ');
    });

    expect(mockSendChat).toHaveBeenCalledWith('Hello World', expect.any(AbortSignal));
  });

  it('ignores empty and whitespace-only messages', async () => {
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockSendChat).not.toHaveBeenCalled();
  });

  it('sets error when API call fails with response.data.error', async () => {
    const apiError = { response: { data: { error: 'Server error' } } };
    mockSendChat.mockRejectedValue(apiError);
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Server error');
    expect(result.current.isLoading).toBe(false);
    // User message was appended before the API call failed
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
  });

  it('falls back to default error message when error has no response body', async () => {
    mockSendChat.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Failed to get a response. Please try again.');
  });

  it('clearMessages resets messages and error', async () => {
    mockSendChat.mockRejectedValue({ response: { data: { error: 'Oops' } } });
    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.error).toBe('Oops');

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
