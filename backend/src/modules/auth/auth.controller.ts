import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  LoginDto,
  VerifyMfaDto,
  EnableMfaStep1Dto,
  EnableMfaStep2Dto,
  DisableMfaDto,
  RegenerateRecoveryCodesDto,
  RequestEmailOtpDto,
  ToggleEmailOtpDto,
} from './auth.dto.js';
import { authService } from './auth.service.js';
import { blacklistToken } from '../../config/token-blacklist.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = LoginDto.parse(req.body);
    const result = await authService.login(dto.email, dto.password);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'account_locked') {
      const remainingMin = (error as Error & { remainingMin?: number }).remainingMin ?? 15;
      res.status(429).json({ success: false, error: 'account_locked', remainingMin });
      return;
    }
    if (error instanceof Error && error.message === 'maintenance_active') {
      res.status(503).json({
        success: false,
        error: 'Service under maintenance',
        maintenance: true,
      });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'User not found' || error.message === 'Invalid credentials')
    ) {
      res.status(401).json({ success: false, error: 'invalid_credentials' });
      return;
    }
    req.log.error({ err: error }, 'login failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const verifyMfa = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = VerifyMfaDto.parse(req.body);
    const result = await authService.verifyMfa(
      dto.mfaToken,
      dto.totpCode,
      dto.recoveryCode,
      dto.webauthnResponse,
      dto.emailOtpCode,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'mfa_token_invalid') {
      res.status(401).json({ success: false, error: 'mfa_token_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'totp_invalid') {
      res.status(401).json({ success: false, error: 'totp_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'totp_already_used') {
      res.status(401).json({ success: false, error: 'totp_already_used' });
      return;
    }
    if (error instanceof Error && error.message === 'recovery_code_invalid') {
      res.status(401).json({ success: false, error: 'recovery_code_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'webauthn_invalid') {
      res.status(401).json({ success: false, error: 'webauthn_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'email_otp_invalid') {
      res.status(401).json({ success: false, error: 'email_otp_invalid' });
      return;
    }
    req.log.error({ err: error }, 'verifyMfa failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const requestEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = RequestEmailOtpDto.parse(req.body);
    const result = await authService.requestEmailOtp(dto.mfaToken);
    res.json({ success: true, data: { expiresAt: result.expiresAt.toISOString() } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'mfa_token_invalid') {
      res.status(401).json({ success: false, error: 'mfa_token_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'smtp_not_configured') {
      res.status(503).json({ success: false, error: 'smtp_not_configured' });
      return;
    }
    req.log.error({ err: error }, 'requestEmailOtp failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getMfaStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.getMfaStatus(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    req.log.error({ err: error }, 'getMfaStatus failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const toggleEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = ToggleEmailOtpDto.parse(req.body);
    const result = await authService.toggleEmailOtp(req.user!.id, dto.enable, dto.password);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'wrong_password') {
      res.status(401).json({ success: false, error: 'wrong_password' });
      return;
    }
    req.log.error({ err: error }, 'toggleEmailOtp failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const setupMfa = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = EnableMfaStep1Dto.parse(req.body);
    const result = await authService.setupMfa(req.user!.id, dto.password);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'wrong_password') {
      res.status(401).json({ success: false, error: 'wrong_password' });
      return;
    }
    req.log.error({ err: error }, 'setupMfa failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const confirmMfa = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = EnableMfaStep2Dto.parse(req.body);
    const { recoveryCodes } = await authService.confirmMfaSetup(req.user!.id, dto.totpCode);
    res.json({ success: true, data: { recoveryCodes } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'totp_invalid') {
      res.status(400).json({ success: false, error: 'totp_invalid' });
      return;
    }
    if (error instanceof Error && error.message === 'mfa_setup_not_started') {
      res.status(400).json({ success: false, error: 'mfa_setup_not_started' });
      return;
    }
    req.log.error({ err: error }, 'confirmMfa failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const disableMfa = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = DisableMfaDto.parse(req.body);
    await authService.disableMfa(req.user!.id, dto.password);
    res.json({ success: true, data: { message: 'MFA disabled successfully' } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'wrong_password') {
      res.status(401).json({ success: false, error: 'wrong_password' });
      return;
    }
    req.log.error({ err: error }, 'disableMfa failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getRecoveryCodeCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const remaining = await authService.getRecoveryCodeCount(req.user!.id);
    res.json({ success: true, data: { remaining } });
  } catch (error) {
    req.log.error({ err: error }, 'getRecoveryCodeCount failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const regenerateRecoveryCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = RegenerateRecoveryCodesDto.parse(req.body);
    const { recoveryCodes } = await authService.regenerateRecoveryCodes(req.user!.id, dto.password);
    res.json({ success: true, data: { recoveryCodes } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'wrong_password') {
      res.status(401).json({ success: false, error: 'wrong_password' });
      return;
    }
    req.log.error({ err: error }, 'regenerateRecoveryCodes failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const logout = (req: Request, res: Response): void => {
  const { jti, exp } = req.user!;
  if (jti && exp) {
    blacklistToken(jti, exp);
  }
  res.json({ success: true, data: 'Logged out' });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    req.log.error({ err: error }, 'me failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
