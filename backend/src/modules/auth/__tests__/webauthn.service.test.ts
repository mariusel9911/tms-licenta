import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({ prisma: prismaMock }));

vi.mock('../../../config/env', () => ({
  env: {
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_RP_NAME: 'TMS Transport',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '8h',
    PORT: 3001,
    NODE_ENV: 'test',
    SEED_USER_EMAIL: 'admin@tms.ro',
  },
}));

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server/helpers', () => ({
  isoUint8Array: {
    fromUTF8String: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  },
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { webAuthnService } from '../webauthn.service.js';

const mockGenReg = vi.mocked(generateRegistrationOptions);
const mockVerReg = vi.mocked(verifyRegistrationResponse);
const mockGenAuth = vi.mocked(generateAuthenticationOptions);
const mockVerAuth = vi.mocked(verifyAuthenticationResponse);

const mockUser = {
  id: 1,
  email: 'test@tms.ro',
  name: 'Test User',
  currentChallenge: 'test-challenge-123',
  authenticators: [],
} as never;

const mockAuthenticator = {
  id: 'auth-cuid-1',
  userId: 1,
  credentialId: 'cred-id-base64',
  credentialPublicKey: Buffer.from([1, 2, 3, 4]),
  counter: BigInt(0),
  transports: null,
  deviceName: 'Security Key',
  createdAt: new Date('2026-01-01'),
} as never;

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

describe('webAuthnService.generateRegistrationOptions', () => {
  it('generates options and stores challenge on user', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      ...mockUser,
      authenticators: [],
    } as never);
    prismaMock.user.update.mockResolvedValue(mockUser);
    mockGenReg.mockResolvedValue({ challenge: 'new-challenge' } as never);

    const result = await webAuthnService.generateRegistrationOptions(1);

    expect(mockGenReg).toHaveBeenCalledWith(expect.objectContaining({
      rpID: 'localhost',
      rpName: 'TMS Transport',
    }));
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentChallenge: 'new-challenge' },
    }));
    expect(result).toEqual({ challenge: 'new-challenge' });
  });
});

describe('webAuthnService.verifyRegistration', () => {
  it('creates authenticator and clears challenge on success', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    mockVerReg.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-id-base64',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
      },
    } as never);
    prismaMock.authenticator.create.mockResolvedValue(mockAuthenticator);
    prismaMock.user.update.mockResolvedValue(mockUser);

    const result = await webAuthnService.verifyRegistration(1, {}, 'My Key');

    expect(prismaMock.authenticator.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 1, deviceName: 'My Key' }),
    }));
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentChallenge: null },
    }));
    expect(result).toEqual(mockAuthenticator);
  });

  it('throws no_challenge when user has no currentChallenge', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      ...mockUser,
      currentChallenge: null,
    } as never);

    await expect(webAuthnService.verifyRegistration(1, {})).rejects.toThrow('no_challenge');
  });

  it('throws verification_failed when verifyRegistrationResponse returns verified: false', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    mockVerReg.mockResolvedValue({ verified: false } as never);

    await expect(webAuthnService.verifyRegistration(1, {})).rejects.toThrow('verification_failed');
  });

  it('uses "Security Key" as default deviceName when none provided', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    mockVerReg.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred', publicKey: new Uint8Array([1]), counter: 0, transports: [] },
      },
    } as never);
    prismaMock.authenticator.create.mockResolvedValue(mockAuthenticator);
    prismaMock.user.update.mockResolvedValue(mockUser);

    await webAuthnService.verifyRegistration(1, {});

    expect(prismaMock.authenticator.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deviceName: 'Security Key' }),
    }));
  });
});

describe('webAuthnService.generateAuthenticationOptions', () => {
  it('generates options for user authenticators and stores challenge', async () => {
    prismaMock.authenticator.findMany.mockResolvedValue([mockAuthenticator]);
    prismaMock.user.update.mockResolvedValue(mockUser);
    mockGenAuth.mockResolvedValue({ challenge: 'auth-challenge' } as never);

    const result = await webAuthnService.generateAuthenticationOptions(1);

    expect(mockGenAuth).toHaveBeenCalledWith(expect.objectContaining({ rpID: 'localhost' }));
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentChallenge: 'auth-challenge' },
    }));
    expect(result).toEqual({ challenge: 'auth-challenge' });
  });
});

describe('webAuthnService.verifyAuthentication', () => {
  it('returns true and updates counter when authentication succeeds', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    mockVerAuth.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    } as never);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await webAuthnService.verifyAuthentication(1, { id: 'cred-id-base64' });

    expect(result).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('returns false when authenticator belongs to different user', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    prismaMock.authenticator.findUnique.mockResolvedValue({
      ...mockAuthenticator,
      userId: 999,
    } as never);

    const result = await webAuthnService.verifyAuthentication(1, { id: 'cred-id-base64' });

    expect(result).toBe(false);
    expect(mockVerAuth).not.toHaveBeenCalled();
  });

  it('throws no_challenge when user has no currentChallenge', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      ...mockUser,
      currentChallenge: null,
    } as never);

    await expect(webAuthnService.verifyAuthentication(1, {})).rejects.toThrow('no_challenge');
  });

  it('returns false when verifyAuthenticationResponse returns verified: false', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(mockUser);
    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    mockVerAuth.mockResolvedValue({ verified: false } as never);

    const result = await webAuthnService.verifyAuthentication(1, { id: 'cred-id-base64' });

    expect(result).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('webAuthnService.listAuthenticators', () => {
  it('returns authenticators for user', async () => {
    const list = [{ id: 'auth-cuid-1', deviceName: 'Security Key', createdAt: new Date('2026-01-01') }];
    prismaMock.authenticator.findMany.mockResolvedValue(list as never);

    const result = await webAuthnService.listAuthenticators(1);

    expect(result).toEqual(list);
    expect(prismaMock.authenticator.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 1 },
    }));
  });
});

describe('webAuthnService.removeAuthenticator', () => {
  it('deletes authenticator owned by user', async () => {
    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    prismaMock.authenticator.delete.mockResolvedValue(mockAuthenticator);

    await webAuthnService.removeAuthenticator(1, 'auth-cuid-1');

    expect(prismaMock.authenticator.delete).toHaveBeenCalledWith({ where: { id: 'auth-cuid-1' } });
  });

  it('throws not_found when authenticator belongs to different user', async () => {
    prismaMock.authenticator.findUnique.mockResolvedValue({
      ...mockAuthenticator,
      userId: 999,
    } as never);

    await expect(webAuthnService.removeAuthenticator(1, 'auth-cuid-1')).rejects.toThrow('not_found');
  });

  it('throws not_found when authenticator does not exist', async () => {
    prismaMock.authenticator.findUnique.mockResolvedValue(null);

    await expect(webAuthnService.removeAuthenticator(1, 'missing-id')).rejects.toThrow('not_found');
  });
});

describe('webAuthnService.generateLoginOptions', () => {
  it('generates options, stores challenge in map, and returns passkeyLoginToken', async () => {
    mockGenAuth.mockResolvedValue({ challenge: 'login-challenge' } as never);

    const result = await webAuthnService.generateLoginOptions();

    expect(mockGenAuth).toHaveBeenCalledWith(expect.objectContaining({
      rpID: 'localhost',
      allowCredentials: [],
    }));
    expect(result).toHaveProperty('options');
    expect(result).toHaveProperty('passkeyLoginToken');
    expect(typeof result.passkeyLoginToken).toBe('string');
  });
});

describe('webAuthnService.verifyLoginAuthentication', () => {
  it('throws passkey_challenge_expired for unknown passkeyLoginToken', async () => {
    await expect(
      webAuthnService.verifyLoginAuthentication({}, 'unknown-token'),
    ).rejects.toThrow('passkey_challenge_expired');
  });

  it('throws passkey_challenge_expired when challenge has expired (fake timers)', async () => {
    vi.useFakeTimers();
    mockGenAuth.mockResolvedValue({ challenge: 'expiring-challenge' } as never);
    const { passkeyLoginToken } = await webAuthnService.generateLoginOptions();

    // Advance time past the 5-minute TTL
    vi.advanceTimersByTime(6 * 60 * 1000);

    await expect(
      webAuthnService.verifyLoginAuthentication({}, passkeyLoginToken),
    ).rejects.toThrow('passkey_challenge_expired');

    vi.useRealTimers();
  });

  it('throws passkey_not_found when no authenticator matches credentialId', async () => {
    // First generate options to store valid token
    mockGenAuth.mockResolvedValue({ challenge: 'valid-challenge' } as never);
    const { passkeyLoginToken } = await webAuthnService.generateLoginOptions();

    prismaMock.authenticator.findUnique.mockResolvedValue(null);

    await expect(
      webAuthnService.verifyLoginAuthentication({ id: 'unknown-cred' }, passkeyLoginToken),
    ).rejects.toThrow('passkey_not_found');
  });

  it('throws passkey_verification_failed when verifyAuthenticationResponse returns verified: false', async () => {
    mockGenAuth.mockResolvedValue({ challenge: 'valid-challenge' } as never);
    const { passkeyLoginToken } = await webAuthnService.generateLoginOptions();

    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    mockVerAuth.mockResolvedValue({ verified: false } as never);

    await expect(
      webAuthnService.verifyLoginAuthentication({ id: 'cred-id-base64' }, passkeyLoginToken),
    ).rejects.toThrow('passkey_verification_failed');
  });

  it('returns authenticator.userId on successful verification', async () => {
    mockGenAuth.mockResolvedValue({ challenge: 'valid-challenge' } as never);
    const { passkeyLoginToken } = await webAuthnService.generateLoginOptions();

    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    mockVerAuth.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5 },
    } as never);
    prismaMock.authenticator.update.mockResolvedValue(mockAuthenticator);

    const userId = await webAuthnService.verifyLoginAuthentication({ id: 'cred-id-base64' }, passkeyLoginToken);

    expect(userId).toBe(1); // mockAuthenticator.userId = 1
    expect(prismaMock.authenticator.update).toHaveBeenCalled();
  });
});

describe('webAuthnService.renameAuthenticator', () => {
  it('renames authenticator owned by user', async () => {
    const updated = { id: 'auth-cuid-1', deviceName: 'New Name', createdAt: new Date('2026-01-01') };
    prismaMock.authenticator.findUnique.mockResolvedValue(mockAuthenticator);
    prismaMock.authenticator.update.mockResolvedValue(updated as never);

    const result = await webAuthnService.renameAuthenticator(1, 'auth-cuid-1', 'New Name');

    expect(prismaMock.authenticator.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'auth-cuid-1' },
      data: { deviceName: 'New Name' },
    }));
    expect(result).toEqual(updated);
  });

  it('throws not_found when authenticator belongs to different user', async () => {
    prismaMock.authenticator.findUnique.mockResolvedValue({
      ...mockAuthenticator,
      userId: 999,
    } as never);

    await expect(webAuthnService.renameAuthenticator(1, 'auth-cuid-1', 'Name')).rejects.toThrow('not_found');
  });
});
