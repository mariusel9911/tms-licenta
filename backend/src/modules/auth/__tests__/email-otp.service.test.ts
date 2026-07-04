import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

const mockSendOtpEmail = vi.hoisted(() => vi.fn());
vi.mock('../../../config/mailer.service', () => ({
  mailerService: {
    sendOtpEmail: mockSendOtpEmail,
  },
}));

const mockSettingsGet = vi.hoisted(() => vi.fn());
vi.mock('../../settings/settings.service', () => ({
  settingsService: {
    get: mockSettingsGet,
  },
}));

import bcrypt from 'bcryptjs';
import { emailOtpService } from '../email-otp.service.js';

const bcryptMock = bcrypt as unknown as {
  compare: ReturnType<typeof vi.fn>;
  hash: ReturnType<typeof vi.fn>;
};

const smtpSettings = {
  smtpEnabled: true,
  smtpHost: 'smtp.example.com',
  smtpEmail: 'noreply@example.com',
};

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  mockSettingsGet.mockResolvedValue(smtpSettings);
});

// ─── sendEmailOtp() ───────────────────────────────────────────────────────────

describe('emailOtpService.sendEmailOtp()', () => {
  it('generates code, stores hash, sends email, returns expiresAt', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'user@test.ro' } as never);
    bcryptMock.hash.mockResolvedValue('hashed-code');
    prismaMock.emailOtpChallenge.deleteMany.mockResolvedValue({ count: 0 });
    const fakeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    prismaMock.emailOtpChallenge.create.mockResolvedValue({ expiresAt: fakeExpiry } as never);
    // $transaction callback form: execute the callback with prismaMock as tx
    prismaMock.$transaction.mockImplementation((cb: unknown) =>
      typeof cb === 'function' ? (cb as (tx: typeof prismaMock) => unknown)(prismaMock) : Promise.resolve(cb),
    );
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await emailOtpService.sendEmailOtp(1);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(bcryptMock.hash).toHaveBeenCalled();
    expect(prismaMock.emailOtpChallenge.create).toHaveBeenCalled();
    expect(mockSendOtpEmail).toHaveBeenCalledWith('user@test.ro', expect.any(String));
  });

  it('throws smtp_not_configured when SMTP is disabled', async () => {
    mockSettingsGet.mockResolvedValue({ smtpEnabled: false, smtpHost: '', smtpEmail: '' });

    await expect(emailOtpService.sendEmailOtp(1)).rejects.toThrow('smtp_not_configured');
    expect(mockSendOtpEmail).not.toHaveBeenCalled();
  });

  it('throws smtp_not_configured when smtpHost is empty', async () => {
    mockSettingsGet.mockResolvedValue({ smtpEnabled: true, smtpHost: '', smtpEmail: 'a@b.com' });

    await expect(emailOtpService.sendEmailOtp(1)).rejects.toThrow('smtp_not_configured');
  });
});

// ─── verifyEmailOtp() ─────────────────────────────────────────────────────────

describe('emailOtpService.verifyEmailOtp()', () => {
  it('returns true and marks usedAt when code matches', async () => {
    const challenge = { id: 10, codeHash: 'hashed-code', userId: 1, expiresAt: new Date(Date.now() + 60000), usedAt: null };
    prismaMock.emailOtpChallenge.findFirst.mockResolvedValue(challenge as never);
    bcryptMock.compare.mockResolvedValue(true);
    prismaMock.emailOtpChallenge.update.mockResolvedValue({} as never);

    const result = await emailOtpService.verifyEmailOtp(1, '123456');

    expect(result).toBe(true);
    expect(prismaMock.emailOtpChallenge.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('returns false when no active challenge found', async () => {
    prismaMock.emailOtpChallenge.findFirst.mockResolvedValue(null);

    const result = await emailOtpService.verifyEmailOtp(1, '123456');

    expect(result).toBe(false);
    expect(prismaMock.emailOtpChallenge.update).not.toHaveBeenCalled();
  });

  it('returns false when code does not match', async () => {
    const challenge = { id: 10, codeHash: 'hashed-code', userId: 1, expiresAt: new Date(Date.now() + 60000), usedAt: null };
    prismaMock.emailOtpChallenge.findFirst.mockResolvedValue(challenge as never);
    bcryptMock.compare.mockResolvedValue(false);

    const result = await emailOtpService.verifyEmailOtp(1, '000000');

    expect(result).toBe(false);
    expect(prismaMock.emailOtpChallenge.update).not.toHaveBeenCalled();
  });
});

// ─── cleanupExpiredChallenges() ───────────────────────────────────────────────

describe('emailOtpService.cleanupExpiredChallenges()', () => {
  it('deletes expired challenges for a specific user', async () => {
    prismaMock.emailOtpChallenge.deleteMany.mockResolvedValue({ count: 2 });

    await emailOtpService.cleanupExpiredChallenges(1);

    expect(prismaMock.emailOtpChallenge.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('deletes all expired challenges when no userId given', async () => {
    prismaMock.emailOtpChallenge.deleteMany.mockResolvedValue({ count: 5 });

    await emailOtpService.cleanupExpiredChallenges();

    expect(prismaMock.emailOtpChallenge.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
