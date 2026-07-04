import { randomUUID } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

// In-memory challenge store for usernameless passkey login (TTL: 5 minutes)
const passkeyLoginChallenges = new Map<string, { challenge: string; expiresAt: number }>();

const rpID   = env.WEBAUTHN_RP_ID;
const rpName = env.WEBAUTHN_RP_NAME;
const origin = env.WEBAUTHN_ORIGIN;

export const webAuthnService = {
  async generateRegistrationOptions(userId: number) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { authenticators: { select: { credentialId: true, transports: true } } },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(String(userId)),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: user.authenticators.map((a) => ({
        id: a.credentialId,
        type: 'public-key' as const,
        transports: a.transports
          ? (JSON.parse(a.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
    });

    // Store challenge temporarily on user for later verification
    await prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: options.challenge },
    });

    return options;
  },

  async verifyRegistration(userId: number, body: unknown, deviceName?: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.currentChallenge) throw new Error('no_challenge');

    const verification = await verifyRegistrationResponse({
      response: body as RegistrationResponseJSON,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('verification_failed');
    }

    const { credential } = verification.registrationInfo;

    const authenticator = await prisma.authenticator.create({
      data: {
        userId,
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
        deviceName: deviceName ?? 'Security Key',
      },
    });

    // Clear challenge
    await prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: null },
    });

    return authenticator;
  },

  async generateAuthenticationOptions(userId: number) {
    const authenticators = await prisma.authenticator.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map((a) => ({
        id: a.credentialId,
        type: 'public-key' as const,
        transports: a.transports
          ? (JSON.parse(a.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
      userVerification: 'required',
    });

    await prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: options.challenge },
    });

    return options;
  },

  async verifyAuthentication(userId: number, body: unknown): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.currentChallenge) throw new Error('no_challenge');

    const response = body as AuthenticationResponseJSON;

    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialId: response.id },
    });

    if (!authenticator || authenticator.userId !== userId) return false;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: authenticator.credentialId,
        publicKey: new Uint8Array(authenticator.credentialPublicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports
          ? (JSON.parse(authenticator.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });

    if (!verification.verified) return false;

    // Update counter and clear challenge atomically
    await prisma.$transaction([
      prisma.authenticator.update({
        where: { id: authenticator.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { currentChallenge: null },
      }),
    ]);

    return true;
  },

  async listAuthenticators(userId: number) {
    return prisma.authenticator.findMany({
      where: { userId },
      select: { id: true, deviceName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async removeAuthenticator(userId: number, authenticatorId: string) {
    const auth = await prisma.authenticator.findUnique({ where: { id: authenticatorId } });
    if (!auth || auth.userId !== userId) throw new Error('not_found');
    await prisma.authenticator.delete({ where: { id: authenticatorId } });
  },

  async renameAuthenticator(userId: number, authenticatorId: string, deviceName: string) {
    const auth = await prisma.authenticator.findUnique({ where: { id: authenticatorId } });
    if (!auth || auth.userId !== userId) throw new Error('not_found');
    return prisma.authenticator.update({
      where: { id: authenticatorId },
      data: { deviceName },
      select: { id: true, deviceName: true, createdAt: true },
    });
  },

  // ── Usernameless / discoverable passkey login (no credentials required) ────

  async generateLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // empty → browser shows picker for any registered passkey
      userVerification: 'required',
    });

    const passkeyLoginToken = randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    passkeyLoginChallenges.set(passkeyLoginToken, { challenge: options.challenge, expiresAt });
    setTimeout(() => passkeyLoginChallenges.delete(passkeyLoginToken), 5 * 60 * 1000).unref();

    return { options, passkeyLoginToken };
  },

  async verifyLoginAuthentication(body: unknown, passkeyLoginToken: string): Promise<number> {
    const stored = passkeyLoginChallenges.get(passkeyLoginToken);
    if (!stored || Date.now() > stored.expiresAt) {
      throw new Error('passkey_challenge_expired');
    }
    passkeyLoginChallenges.delete(passkeyLoginToken); // single-use

    const response = body as AuthenticationResponseJSON;

    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialId: response.id },
    });
    if (!authenticator) throw new Error('passkey_not_found');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: authenticator.credentialId,
        publicKey: new Uint8Array(authenticator.credentialPublicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports
          ? (JSON.parse(authenticator.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });

    if (!verification.verified) throw new Error('passkey_verification_failed');

    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    return authenticator.userId;
  },
};
