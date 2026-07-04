import { Request, Response } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { webAuthnService } from './webauthn.service.js';
import { authService } from './auth.service.js';
import { RegisterPasskeyDto, RenamePasskeyDto, VerifyPasskeyLoginDto } from './auth.dto.js';
import { env } from '../../config/env.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';

interface MfaTokenPayload {
  mfaPending: true;
  userId: number;
}

export const getRegistrationOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const options = await webAuthnService.generateRegistrationOptions(req.user!.id);
    res.json({ success: true, data: options });
  } catch (error) {
    req.log.error({ err: error }, 'getRegistrationOptions failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const verifyRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = RegisterPasskeyDto.parse(req.body);
    const { deviceName, ...body } = req.body as Record<string, unknown>;
    const authenticator = await webAuthnService.verifyRegistration(
      req.user!.id,
      body,
      dto.deviceName,
    );
    await recordAuditEvent({
      category: AuditCategory.AUTH,
      action:   'AUTH_PASSKEY_ENROLL',
      actor:    { userId: req.user!.id, email: req.user!.email },
      severity: AuditSeverity.WARN,
      details:  { passkeyId: authenticator.id, deviceName: authenticator.deviceName },
    });

    res.status(201).json({
      success: true,
      data: {
        id: authenticator.id,
        deviceName: authenticator.deviceName,
        createdAt: authenticator.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'no_challenge') {
      res.status(400).json({ success: false, error: 'no_challenge' });
      return;
    }
    if (error instanceof Error && error.message === 'verification_failed') {
      res.status(400).json({ success: false, error: 'verification_failed' });
      return;
    }
    req.log.error({ err: error }, 'verifyRegistration failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mfaToken } = req.body as { mfaToken?: string };
    if (!mfaToken) {
      res.status(400).json({ success: false, error: 'mfaToken is required' });
      return;
    }

    let payload: MfaTokenPayload;
    try {
      payload = jwt.verify(mfaToken, env.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as MfaTokenPayload;
    } catch {
      res.status(401).json({ success: false, error: 'mfa_token_invalid' });
      return;
    }

    if (!payload.mfaPending) {
      res.status(401).json({ success: false, error: 'mfa_token_invalid' });
      return;
    }

    const options = await webAuthnService.generateAuthenticationOptions(payload.userId);
    res.json({ success: true, data: options });
  } catch (error) {
    req.log.error({ err: error }, 'getAuthenticationOptions failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const listPasskeys = async (req: Request, res: Response): Promise<void> => {
  try {
    const passkeys = await webAuthnService.listAuthenticators(req.user!.id);
    res.json({ success: true, data: passkeys });
  } catch (error) {
    req.log.error({ err: error }, 'listPasskeys failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const removePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const passkeyId = req.params.id as string;
    await webAuthnService.removeAuthenticator(req.user!.id, passkeyId);
    await recordAuditEvent({
      category: AuditCategory.AUTH,
      action:   'AUTH_PASSKEY_REMOVE',
      actor:    { userId: req.user!.id, email: req.user!.email },
      severity: AuditSeverity.WARN,
      details:  { passkeyId },
    });
    res.json({ success: true, data: { message: 'Passkey removed' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      res.status(404).json({ success: false, error: 'Passkey not found' });
      return;
    }
    req.log.error({ err: error }, 'removePasskey failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const renamePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = RenamePasskeyDto.parse(req.body);
    const updated = await webAuthnService.renameAuthenticator(
      req.user!.id,
      req.params.id as string,
      dto.deviceName,
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'not_found') {
      res.status(404).json({ success: false, error: 'Passkey not found' });
      return;
    }
    req.log.error({ err: error }, 'renamePasskey failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── Usernameless passkey login (public endpoints) ─────────────────────────────

function isAlreadyAuthenticated(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const token = authHeader.slice(7);
    jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export const getLoginOptions = async (req: Request, res: Response): Promise<void> => {
  // Reject if the caller already has a valid session — prevents session hijacking
  // (authenticated user A using another user's passkey to replace their session)
  if (isAlreadyAuthenticated(req)) {
    res.status(403).json({ success: false, error: 'already_authenticated' });
    return;
  }
  try {
    const { options, passkeyLoginToken } = await webAuthnService.generateLoginOptions();
    res.json({ success: true, data: { options, passkeyLoginToken } });
  } catch (error) {
    req.log.error({ err: error }, 'getLoginOptions failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const verifyLogin = async (req: Request, res: Response): Promise<void> => {
  // Same guard on the verify step
  if (isAlreadyAuthenticated(req)) {
    res.status(403).json({ success: false, error: 'already_authenticated' });
    return;
  }
  try {
    const dto = VerifyPasskeyLoginDto.parse(req.body);
    const result = await authService.passkeyLogin(dto.webauthnResponse, dto.passkeyLoginToken);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'passkey_challenge_expired') {
      res.status(401).json({ success: false, error: 'passkey_challenge_expired' });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'passkey_not_found' || error.message === 'passkey_verification_failed')
    ) {
      res.status(401).json({ success: false, error: 'webauthn_invalid' });
      return;
    }
    req.log.error({ err: error }, 'verifyLogin failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
