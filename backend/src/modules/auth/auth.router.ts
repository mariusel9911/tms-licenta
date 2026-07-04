import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { authLoginLimiter, authMfaLimiter } from '../../middleware/rate-limit.middleware.js';
import {
  login,
  logout,
  me,
  verifyMfa,
  getMfaStatus,
  toggleEmailOtp,
  setupMfa,
  confirmMfa,
  disableMfa,
  getRecoveryCodeCount,
  regenerateRecoveryCodes,
  requestEmailOtp,
} from './auth.controller.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  listPasskeys,
  removePasskey,
  renamePasskey,
  getLoginOptions,
  verifyLogin,
} from './webauthn.controller.js';

export const authRouter = Router();

authRouter.post('/login', authLoginLimiter, login);
authRouter.post('/mfa/verify', authMfaLimiter, verifyMfa);  // public — uses mfaToken in body, not Authorization header
authRouter.post('/mfa/email-otp/request', authMfaLimiter, requestEmailOtp);  // public — rate-limited

authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/me', authMiddleware, me);
authRouter.get('/mfa/status', authMiddleware, getMfaStatus);
authRouter.patch('/mfa/email-otp/toggle', authMiddleware, toggleEmailOtp);
authRouter.post('/mfa/setup', authMiddleware, setupMfa);
authRouter.post('/mfa/confirm', authMiddleware, confirmMfa);
authRouter.post('/mfa/disable', authMiddleware, disableMfa);
authRouter.get('/mfa/recovery-codes/count', authMiddleware, getRecoveryCodeCount);
authRouter.post('/mfa/recovery-codes/regenerate', authMiddleware, authMfaLimiter, regenerateRecoveryCodes);

// Passkeys / WebAuthn (M20)
authRouter.get('/mfa/passkey/register/options', authMiddleware, getRegistrationOptions);
authRouter.post('/mfa/passkey/register/verify', authMiddleware, verifyRegistration);
authRouter.post('/mfa/passkey/authenticate/options', authMfaLimiter, getAuthenticationOptions);  // public — mfaToken in body
authRouter.get('/mfa/passkeys', authMiddleware, listPasskeys);
authRouter.delete('/mfa/passkeys/:id', authMiddleware, removePasskey);
authRouter.patch('/mfa/passkeys/:id', authMiddleware, renamePasskey);

// Usernameless passkey login — no credentials required (public)
authRouter.get('/passkey/login/options', authMfaLimiter, getLoginOptions);
authRouter.post('/passkey/login/verify', authMfaLimiter, verifyLogin);
