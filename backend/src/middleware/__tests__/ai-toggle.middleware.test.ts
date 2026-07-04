import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import type { Request, Response, NextFunction } from 'express';

// ─── Import shared prismaMock (pattern from maintenance.middleware.test.ts) ──
import { prismaMock } from '../../__tests__/helpers/prisma-mock.js';

vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  requireChatbotEnabled,
  requirePredictionsEnabled,
  isChatbotEnabled,
  isPredictionEnabled,
  clearAiToggleCache,
} from '../ai-toggle.middleware.js';

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function makeReq(): Request {
  return {} as unknown as Request;
}

beforeEach(() => {
  mockReset(prismaMock);
  clearAiToggleCache();
});

// ─── isChatbotEnabled / isPredictionEnabled (read-only getters) ───────────────

describe('isChatbotEnabled()', () => {
  it('returns true when DB reports chatbot on', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: true,
      aiPredictionEnabled: true,
    } as never);

    const result = await isChatbotEnabled();

    expect(result).toBe(true);
    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledOnce();
  });

  it('returns false when DB reports chatbot off', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);

    const result = await isChatbotEnabled();

    expect(result).toBe(false);
  });

  it('uses cached value on second call within TTL', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: true,
      aiPredictionEnabled: true,
    } as never);

    await isChatbotEnabled();
    await isChatbotEnabled(); // second call — should use cache

    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledOnce();
  });

  it('defaults chatbot to false when settings row is missing (fail-closed)', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue(null as never);

    const result = await isChatbotEnabled();

    expect(result).toBe(false);
  });

  it('keeps previous value and does NOT throw on DB error', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: true,
      aiPredictionEnabled: true,
    } as never);
    await isChatbotEnabled();

    clearAiToggleCache();
    prismaMock.appSettings.findUnique.mockRejectedValue(new Error('DB connection lost'));

    const result = await isChatbotEnabled();
    expect(result).toBe(true);
  });
});

describe('isPredictionEnabled()', () => {
  it('returns true when DB reports predictions on', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);

    const result = await isPredictionEnabled();

    expect(result).toBe(true);
  });

  it('returns false when DB reports predictions off', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: false,
    } as never);

    const result = await isPredictionEnabled();

    expect(result).toBe(false);
  });

  it('defaults predictions to true when settings row is missing (fail-open)', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue(null as never);

    const result = await isPredictionEnabled();

    expect(result).toBe(true);
  });
});

// ─── clearAiToggleCache ───────────────────────────────────────────────────────

describe('clearAiToggleCache()', () => {
  it('forces a fresh DB read on the next call', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: true,
      aiPredictionEnabled: true,
    } as never);

    await isChatbotEnabled();
    clearAiToggleCache();
    await isChatbotEnabled();

    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ─── requireChatbotEnabled ────────────────────────────────────────────────────

describe('requireChatbotEnabled', () => {
  it('calls next() when chatbot is enabled', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: true,
      aiPredictionEnabled: true,
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await requireChatbotEnabled(makeReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 503 with disabled=true when chatbot is off', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await requireChatbotEnabled(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        disabled: true,
        error: 'AI chatbot is currently disabled',
      }),
    );
  });

  it('short-circuits fast — does NOT touch downstream handlers when disabled', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);
    const next = vi.fn() as NextFunction;

    const start = Date.now();
    await requireChatbotEnabled(makeReq(), makeRes(), next);
    const elapsed = Date.now() - start;

    // Should complete in <100ms — the whole point is not to hang on
    // unreachable Ollama. The mocked DB call is effectively instant.
    expect(elapsed).toBeLessThan(100);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requirePredictionsEnabled ────────────────────────────────────────────────

describe('requirePredictionsEnabled', () => {
  it('calls next() when predictions are enabled', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await requirePredictionsEnabled(makeReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 with disabled=true when predictions are off', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: false,
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await requirePredictionsEnabled(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        disabled: true,
        error: 'AI predictions are currently disabled',
      }),
    );
  });

  it('toggles independently from chatbot — chatbot off, predictions on → next()', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await requirePredictionsEnabled(makeReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
