import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

// Import shared mock first so it is initialized before the vi.mock factory is called
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

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(),
    totp: {
      verify: vi.fn(),
    },
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

const mockSettingsGet = vi.hoisted(() => vi.fn());
vi.mock('../../settings/settings.service', () => ({
  settingsService: { get: mockSettingsGet },
}));

const mockEmailOtpVerify = vi.hoisted(() => vi.fn());
vi.mock('../email-otp.service', () => ({
  emailOtpService: {
    sendEmailOtp: vi.fn(),
    verifyEmailOtp: mockEmailOtpVerify,
    cleanupExpiredChallenges: vi.fn(),
  },
}));

const mockWebAuthnVerifyAuthentication = vi.hoisted(() => vi.fn());
const mockWebAuthnVerifyLoginAuthentication = vi.hoisted(() => vi.fn());
vi.mock('../webauthn.service', () => ({
  webAuthnService: {
    verifyAuthentication: (...args: unknown[]) => mockWebAuthnVerifyAuthentication(...args),
    verifyLoginAuthentication: (...args: unknown[]) => mockWebAuthnVerifyLoginAuthentication(...args),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    SEED_USER_EMAIL: 'admin@tms.ro',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '8h',
    PORT: 3001,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { authService } from '../auth.service.js';
import { buildUser } from '../../../__tests__/helpers/factories.js';

// Typed accessors for mocked functions (avoids TS overload resolution issues)
const bcryptMock = bcrypt as unknown as {
  compare: ReturnType<typeof vi.fn>;
  hash: ReturnType<typeof vi.fn>;
};
const jwtMock = jwt as unknown as {
  sign: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
};
const speakeasyMock = speakeasy as unknown as {
  generateSecret: ReturnType<typeof vi.fn>;
  totp: { verify: ReturnType<typeof vi.fn> };
};
const qrcodeMock = qrcode as unknown as { toDataURL: ReturnType<typeof vi.fn> };

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  // Default: SMTP not configured (won't add email_otp to methods unless overridden)
  mockSettingsGet.mockResolvedValue({ smtpEnabled: false, smtpHost: '', smtpEmail: '' });
  // Default mfaPendingToken mocks for verifyMfa tests
  prismaMock.mfaPendingToken.findUnique.mockResolvedValue({
    jti: 'test-jti', userId: 1, expiresAt: new Date(Date.now() + 300_000),
  } as never);
  prismaMock.mfaPendingToken.delete.mockResolvedValue({} as never);
  // login() resets loginFailures on success
  prismaMock.user.update.mockResolvedValue({} as never);
});

afterEach(() => {
  authService._clearUsedTotpCodes();
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe('authService.login()', () => {
  it('returns token and user on success', async () => {
    const user = buildUser({ totpEnabled: false });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-token');

    const result = await authService.login(user.email, 'password123');

    expect(result).toEqual({
      token: 'mock-token',
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSystemAdmin: false },
    });
  });

  it('throws "User not found" when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.login('unknown@tms.ro', 'password')).rejects.toThrow('User not found');
  });

  it('throws "Invalid credentials" when password is wrong', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.login(user.email, 'wrong-password')).rejects.toThrow('Invalid credentials');
  });

  it('returns mfaToken when user has MFA enabled', async () => {
    const user = buildUser({ totpEnabled: true });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-mfa-token');
    prismaMock.authenticator.count.mockResolvedValue(0);
    prismaMock.mfaPendingToken.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue(user as never);

    const result = await authService.login(user.email, 'password123');

    expect(result).toEqual({
      mfaRequired: true,
      mfaToken: 'mock-mfa-token',
      methods: ['totp', 'recovery_code'],
      maskedEmail: 't**t@tms.ro',
    });
  });

  it('includes email_otp in methods when SMTP is configured and user enabled it', async () => {
    mockSettingsGet.mockResolvedValue({ smtpEnabled: true, smtpHost: 'smtp.test.com', smtpEmail: 'noreply@test.com' });
    const user = buildUser({ totpEnabled: true, emailOtpEnabled: true });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-mfa-token');
    prismaMock.authenticator.count.mockResolvedValue(0);
    prismaMock.mfaPendingToken.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue(user as never);

    const result = await authService.login(user.email, 'password123') as { methods: string[] };

    expect(result.methods).toContain('email_otp');
    expect(result.methods).toEqual(['totp', 'recovery_code', 'email_otp']);
  });

  it('includes a jti claim in the signed JWT payload', async () => {
    const user = buildUser({ totpEnabled: false });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-token');

    await authService.login(user.email, 'password123');

    const signedPayload = jwtMock.sign.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof signedPayload.jti).toBe('string');
    expect((signedPayload.jti as string).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// verifyMfa()
// ---------------------------------------------------------------------------

describe('authService.verifyMfa()', () => {
  it('returns token and user when TOTP code is valid', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    speakeasyMock.totp.verify.mockReturnValue(true);
    jwtMock.sign.mockReturnValue('mock-full-token');

    const result = await authService.verifyMfa('valid-mfa-token', '123456', undefined);

    expect(result).toEqual({
      token: 'mock-full-token',
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSystemAdmin: false },
    });
  });

  it('throws "mfa_token_invalid" when jwt.verify throws (expired token)', async () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(authService.verifyMfa('expired-token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws "totp_invalid" when TOTP code is wrong', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    speakeasyMock.totp.verify.mockReturnValue(false);

    await expect(authService.verifyMfa('valid-mfa-token', '000000', undefined)).rejects.toThrow('totp_invalid');
  });

  it('throws "totp_already_used" when the same TOTP code is used twice', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    speakeasyMock.totp.verify.mockReturnValue(true);
    jwtMock.sign.mockReturnValue('mock-full-token');

    // First use succeeds
    await expect(authService.verifyMfa('valid-mfa-token', '123456', undefined)).resolves.toBeDefined();

    // Second use with the same code must fail
    await expect(authService.verifyMfa('valid-mfa-token', '123456', undefined)).rejects.toThrow('totp_already_used');
  });

  it('returns token and user when valid recovery code is provided', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    // Recovery code path: findMany returns one row, bcrypt.compare matches
    prismaMock.recoveryCode.findMany.mockResolvedValue([
      { id: 1, userId: user.id, codeHash: 'hashedcode', usedAt: null, createdAt: new Date() },
    ] as never);
    bcryptMock.compare.mockResolvedValue(true);
    prismaMock.recoveryCode.update.mockResolvedValue({} as never);
    jwtMock.sign.mockReturnValue('mock-full-token');

    const result = await authService.verifyMfa('valid-mfa-token', undefined, 'ABCD-1234-EF56');

    expect(result.token).toBe('mock-full-token');
    expect(prismaMock.recoveryCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
  });

  it('throws "recovery_code_invalid" when recovery code does not match', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.recoveryCode.findMany.mockResolvedValue([
      { id: 1, userId: user.id, codeHash: 'hashedcode', usedAt: null, createdAt: new Date() },
    ] as never);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.verifyMfa('valid-mfa-token', undefined, 'WRONG-CODE')).rejects.toThrow('recovery_code_invalid');
  });

  it('includes a jti claim in the JWT signed after successful MFA', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    speakeasyMock.totp.verify.mockReturnValue(true);
    jwtMock.sign.mockReturnValue('mock-full-token');

    await authService.verifyMfa('valid-mfa-token', '654321', undefined);

    const signedPayload = jwtMock.sign.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof signedPayload.jti).toBe('string');
    expect((signedPayload.jti as string).length).toBeGreaterThan(0);
  });

  it('returns token when emailOtpCode is valid', async () => {
    const user = buildUser({ totpEnabled: true });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 0 } } as never);
    mockEmailOtpVerify.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-full-token');

    const result = await authService.verifyMfa('valid-mfa-token', undefined, undefined, undefined, '654321');

    expect(result).toMatchObject({ token: 'mock-full-token' });
    expect(mockEmailOtpVerify).toHaveBeenCalledWith(user.id, '654321');
  });
});

// ---------------------------------------------------------------------------
// getMfaStatus()
// ---------------------------------------------------------------------------

describe('authService.getMfaStatus()', () => {
  it('returns totpEnabled:false for user without MFA', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ totpEnabled: false } as never);

    const result = await authService.getMfaStatus(1);

    expect(result).toEqual({ totpEnabled: false });
  });

  it('throws "User not found" when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.getMfaStatus(999)).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// setupMfa()
// ---------------------------------------------------------------------------

describe('authService.setupMfa()', () => {
  it('returns qrCodeDataUrl on success', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    speakeasyMock.generateSecret.mockReturnValue({
      base32: 'TESTSECRETBASE32',
      otpauth_url: 'otpauth://totp/TMS%20(test%40tms.ro)?secret=TESTSECRETBASE32',
    });
    prismaMock.user.update.mockResolvedValue(user as never);
    qrcodeMock.toDataURL.mockResolvedValue('data:image/png;base64,test');

    const result = await authService.setupMfa(user.id, 'password123');

    expect(result).toEqual({ qrCodeDataUrl: 'data:image/png;base64,test' });
  });

  it('throws "wrong_password" when password is incorrect', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.setupMfa(user.id, 'wrong')).rejects.toThrow('wrong_password');
  });
});

// ---------------------------------------------------------------------------
// confirmMfaSetup()
// ---------------------------------------------------------------------------

describe('authService.confirmMfaSetup()', () => {
  it('enables totpEnabled and returns 10 recovery codes', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      totpSecret: 'SECRET123',
      totpEnabled: false,
    } as never);
    speakeasyMock.totp.verify.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue(buildUser({ totpEnabled: true }) as never);
    // Mock _generateRecoveryCodes dependencies
    prismaMock.$transaction.mockResolvedValue([] as never);
    bcryptMock.hash.mockResolvedValue('hashed-code');

    const result = await authService.confirmMfaSetup(1, '123456');

    expect(result).toHaveProperty('recoveryCodes');
    expect(result.recoveryCodes).toHaveLength(10);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where:  { id: 1 },
      data:   { totpEnabled: true },
      select: { email: true },
    });
  });

  it('throws "totp_invalid" when code is wrong', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      totpSecret: 'SECRET123',
      totpEnabled: false,
    } as never);
    speakeasyMock.totp.verify.mockReturnValue(false);

    await expect(authService.confirmMfaSetup(1, '000000')).rejects.toThrow('totp_invalid');
  });
});

// ---------------------------------------------------------------------------
// disableMfa()
// ---------------------------------------------------------------------------

describe('authService.disableMfa()', () => {
  it('deletes recovery codes and disables MFA in a transaction', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: 'SECRET123' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    // Mock individual operations so they return Promises (satisfy expect.anything())
    prismaMock.recoveryCode.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.user.update.mockResolvedValue(user as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    await expect(authService.disableMfa(user.id, 'password123')).resolves.toBeUndefined();

    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      expect.anything(), // recoveryCode.deleteMany promise
      expect.anything(), // user.update promise
    ]);
  });

  it('throws "wrong_password" when password is incorrect', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.disableMfa(user.id, 'wrong')).rejects.toThrow('wrong_password');
  });
});

// ---------------------------------------------------------------------------
// verifyRecoveryCode()
// ---------------------------------------------------------------------------

describe('authService.verifyRecoveryCode()', () => {
  it('returns true and marks code as used when code matches', async () => {
    prismaMock.recoveryCode.findMany.mockResolvedValue([
      { id: 5, userId: 1, codeHash: 'hash1', usedAt: null, createdAt: new Date() },
    ] as never);
    bcryptMock.compare.mockResolvedValue(true);
    prismaMock.recoveryCode.update.mockResolvedValue({} as never);

    const result = await authService.verifyRecoveryCode(1, 'ABCD-1234-EF56');

    expect(result).toBe(true);
    expect(prismaMock.recoveryCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
  });

  it('returns false when no code matches', async () => {
    prismaMock.recoveryCode.findMany.mockResolvedValue([
      { id: 5, userId: 1, codeHash: 'hash1', usedAt: null, createdAt: new Date() },
    ] as never);
    bcryptMock.compare.mockResolvedValue(false);

    const result = await authService.verifyRecoveryCode(1, 'WRONG-CODE');

    expect(result).toBe(false);
    expect(prismaMock.recoveryCode.update).not.toHaveBeenCalled();
  });

  it('returns false when no unused codes exist', async () => {
    prismaMock.recoveryCode.findMany.mockResolvedValue([] as never);

    const result = await authService.verifyRecoveryCode(1, 'ABCD-1234-EF56');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRecoveryCodeCount()
// ---------------------------------------------------------------------------

describe('authService.getRecoveryCodeCount()', () => {
  it('returns the count of unused recovery codes', async () => {
    prismaMock.recoveryCode.count.mockResolvedValue(7);

    const result = await authService.getRecoveryCodeCount(1);

    expect(result).toBe(7);
    expect(prismaMock.recoveryCode.count).toHaveBeenCalledWith({
      where: { userId: 1, usedAt: null },
    });
  });
});

// ---------------------------------------------------------------------------
// login() — additional branch coverage
// ---------------------------------------------------------------------------

describe('authService.login() — additional branches', () => {
  it('throws account_locked when user.lockedUntil is in the future', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...buildUser(),
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
      loginFailures: 10,
    } as never);

    await expect(authService.login('test@tms.ro', 'password')).rejects.toMatchObject({
      message: 'account_locked',
      remainingMin: expect.any(Number),
    });
  });

  it('sets lockedUntil when loginFailures reaches LOCKOUT_MAX_FAILURES', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...buildUser(),
      loginFailures: 9, // 9+1=10 hits the limit
      lockedUntil: null,
    } as never);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.login('test@tms.ro', 'bad')).rejects.toThrow('Invalid credentials');

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
      }),
    );
  });

  it('does NOT set lockedUntil when failures are below threshold', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...buildUser(),
      loginFailures: 2,
      lockedUntil: null,
    } as never);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.login('test@tms.ro', 'bad')).rejects.toThrow('Invalid credentials');

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lockedUntil: undefined }),
      }),
    );
  });

  it('unshifts passkey into methods when authenticatorCount > 0', async () => {
    const user = buildUser({ totpEnabled: true });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-mfa-token');
    prismaMock.authenticator.count.mockResolvedValue(2); // has passkeys
    prismaMock.mfaPendingToken.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue(user as never);

    const result = await authService.login(user.email, 'password123') as { methods: string[] };

    expect(result.methods[0]).toBe('passkey');
    expect(result.methods).toContain('totp');
  });

  it('does not include email_otp when SMTP configured but user has not enabled it', async () => {
    mockSettingsGet.mockResolvedValue({ smtpEnabled: true, smtpHost: 'smtp.test.com', smtpEmail: 'x@x.com' });
    const user = buildUser({ totpEnabled: true, emailOtpEnabled: false } as never);
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-mfa-token');
    prismaMock.authenticator.count.mockResolvedValue(0);
    prismaMock.mfaPendingToken.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue(user as never);

    const result = await authService.login(user.email, 'password123') as { methods: string[] };

    expect(result.methods).not.toContain('email_otp');
  });

  it('maskEmail returns short-form for 2-char local part', async () => {
    const user = buildUser({ totpEnabled: true, email: 'ab@tms.ro', emailOtpEnabled: false } as never);
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mfa-token');
    prismaMock.authenticator.count.mockResolvedValue(0);
    prismaMock.mfaPendingToken.create.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue(user as never);

    const result = await authService.login('ab@tms.ro', 'pass') as { maskedEmail: string };

    expect(result.maskedEmail).toBe('a*@tms.ro');
  });
});

// ---------------------------------------------------------------------------
// verifyMfa() — additional branch coverage
// ---------------------------------------------------------------------------

describe('authService.verifyMfa() — additional branches', () => {
  it('throws mfa_token_invalid when payload.mfaPending is false', async () => {
    jwtMock.verify.mockReturnValue({ mfaPending: false, userId: 1, jti: 'jti-1' });

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws mfa_token_invalid when pendingToken not found in DB', async () => {
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: 1, jti: 'jti-missing' });
    prismaMock.mfaPendingToken.findUnique.mockResolvedValue(null);

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws mfa_token_invalid when pendingToken is expired', async () => {
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: 1, jti: 'jti-expired' });
    prismaMock.mfaPendingToken.findUnique.mockResolvedValue({
      jti: 'jti-expired',
      userId: 1,
      expiresAt: new Date(Date.now() - 1000), // past
    } as never);

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws mfa_token_invalid when user not found after token validation', async () => {
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: 999, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws mfa_token_invalid when user has no MFA configured', async () => {
    const user = buildUser({ totpEnabled: false });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 0 } } as never);

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('throws mfa_token_invalid when totpCode provided but no totpSecret', async () => {
    const user = buildUser({ totpEnabled: true, totpSecret: null });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 0 } } as never);

    await expect(authService.verifyMfa('token', '123456', undefined)).rejects.toThrow('mfa_token_invalid');
  });

  it('verifies via webauthn path (success) and returns token', async () => {
    const user = buildUser({ totpEnabled: true });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 1 } } as never);
    mockWebAuthnVerifyAuthentication.mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('mock-full-token');

    const result = await authService.verifyMfa('token', undefined, undefined, { id: 'cred-id' });

    expect(result.token).toBe('mock-full-token');
    expect(mockWebAuthnVerifyAuthentication).toHaveBeenCalledWith(user.id, { id: 'cred-id' });
  });

  it('throws webauthn_invalid when webauthn verification fails', async () => {
    const user = buildUser({ totpEnabled: true });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 1 } } as never);
    mockWebAuthnVerifyAuthentication.mockResolvedValue(false);

    await expect(authService.verifyMfa('token', undefined, undefined, { id: 'cred-id' })).rejects.toThrow('webauthn_invalid');
  });

  it('throws email_otp_invalid when emailOtpCode does not match', async () => {
    const user = buildUser({ totpEnabled: true });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 0 } } as never);
    mockEmailOtpVerify.mockResolvedValue(false);

    await expect(authService.verifyMfa('token', undefined, undefined, undefined, '000000')).rejects.toThrow('email_otp_invalid');
  });

  it('throws mfa_token_invalid when no code is provided', async () => {
    const user = buildUser({ totpEnabled: true });
    jwtMock.verify.mockReturnValue({ mfaPending: true, userId: user.id, jti: 'test-jti' });
    prismaMock.user.findUnique.mockResolvedValue({ ...user, _count: { authenticators: 0 } } as never);

    // All code params are undefined/empty
    await expect(authService.verifyMfa('token', undefined, undefined, undefined, undefined)).rejects.toThrow('mfa_token_invalid');
  });
});

// ---------------------------------------------------------------------------
// getMfaStatus() — emailOtpEnabled field
// ---------------------------------------------------------------------------

describe('authService.getMfaStatus() — emailOtpEnabled', () => {
  it('returns both totpEnabled and emailOtpEnabled', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      totpEnabled: true,
      emailOtpEnabled: true,
    } as never);

    const result = await authService.getMfaStatus(1);

    expect(result).toMatchObject({ totpEnabled: true, emailOtpEnabled: true });
  });
});

// ---------------------------------------------------------------------------
// toggleEmailOtp()
// ---------------------------------------------------------------------------

describe('authService.toggleEmailOtp()', () => {
  it('enables email OTP without requiring a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' } as never);
    prismaMock.user.update.mockResolvedValue({ emailOtpEnabled: true } as never);

    const result = await authService.toggleEmailOtp(1, true);

    expect(result).toEqual({ emailOtpEnabled: true });
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });

  it('disables email OTP when correct password provided', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' } as never);
    bcryptMock.compare.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue({ emailOtpEnabled: false } as never);

    const result = await authService.toggleEmailOtp(1, false, 'correct-pass');

    expect(result).toEqual({ emailOtpEnabled: false });
  });

  it('throws password_required when disabling without password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' } as never);

    await expect(authService.toggleEmailOtp(1, false)).rejects.toThrow('password_required');
  });

  it('throws wrong_password when disabling with incorrect password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' } as never);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.toggleEmailOtp(1, false, 'wrong')).rejects.toThrow('wrong_password');
  });

  it('throws User not found when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.toggleEmailOtp(1, true)).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// setupMfa() — user not found
// ---------------------------------------------------------------------------

describe('authService.setupMfa() — user not found', () => {
  it('throws User not found when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.setupMfa(999, 'pass')).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// confirmMfaSetup() — missing totpSecret
// ---------------------------------------------------------------------------

describe('authService.confirmMfaSetup() — missing totpSecret', () => {
  it('throws mfa_setup_not_started when user has no totpSecret', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      totpSecret: null,
      totpEnabled: false,
    } as never);

    await expect(authService.confirmMfaSetup(1, '123456')).rejects.toThrow('mfa_setup_not_started');
  });

  it('throws mfa_setup_not_started when user is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.confirmMfaSetup(1, '123456')).rejects.toThrow('mfa_setup_not_started');
  });
});

// ---------------------------------------------------------------------------
// disableMfa() — user not found
// ---------------------------------------------------------------------------

describe('authService.disableMfa() — user not found', () => {
  it('throws User not found when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.disableMfa(999, 'pass')).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// regenerateRecoveryCodes()
// ---------------------------------------------------------------------------

describe('authService.regenerateRecoveryCodes()', () => {
  it('returns new recovery codes on success', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(true);
    prismaMock.$transaction.mockResolvedValue([] as never);
    bcryptMock.hash.mockResolvedValue('hashed-code');

    const result = await authService.regenerateRecoveryCodes(user.id, 'password123');

    expect(result).toHaveProperty('recoveryCodes');
    expect(result.recoveryCodes).toHaveLength(10);
  });

  it('throws wrong_password when password is incorrect', async () => {
    const user = buildUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptMock.compare.mockResolvedValue(false);

    await expect(authService.regenerateRecoveryCodes(user.id, 'wrong')).rejects.toThrow('wrong_password');
  });

  it('throws User not found when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.regenerateRecoveryCodes(999, 'pass')).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// getUserById()
// ---------------------------------------------------------------------------

describe('authService.getUserById()', () => {
  it('returns user with isSystemAdmin=false for non-seed user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 2,
      email: 'user@tms.ro',
      name: 'Regular User',
      role: 'ADMIN',
    } as never);

    const result = await authService.getUserById(2);

    expect(result).toEqual({
      id: 2,
      email: 'user@tms.ro',
      name: 'Regular User',
      role: 'ADMIN',
      isSystemAdmin: false,
    });
  });

  it('returns user with isSystemAdmin=true for seed user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@tms.ro',
      name: 'Admin',
      role: 'ADMIN',
    } as never);

    const result = await authService.getUserById(1);

    expect(result?.isSystemAdmin).toBe(true);
  });

  it('returns null when user is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await authService.getUserById(999);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// passkeyLogin()
// ---------------------------------------------------------------------------

describe('authService.passkeyLogin()', () => {
  it('returns token and user on successful passkey login', async () => {
    const user = buildUser();
    mockWebAuthnVerifyLoginAuthentication.mockResolvedValue(user.id);
    prismaMock.user.findUnique.mockResolvedValue(user);
    jwtMock.sign.mockReturnValue('passkey-token');

    const result = await authService.passkeyLogin({ id: 'cred' }, 'passkey-login-token');

    expect(result.token).toBe('passkey-token');
    expect(result.user.id).toBe(user.id);
  });

  it('throws passkey_not_found when user is not found after verification', async () => {
    mockWebAuthnVerifyLoginAuthentication.mockResolvedValue(999);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authService.passkeyLogin({ id: 'cred' }, 'passkey-login-token')).rejects.toThrow('passkey_not_found');
  });
});
