import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { webAuthnService } from './webauthn.service.js';
import { emailOtpService } from './email-otp.service.js';
import { settingsService } from '../settings/settings.service.js';
import { isMaintenanceActive } from '../../middleware/maintenance.middleware.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';

// Pre-computed bcrypt hash used for timing equalization when the email is not
// found — prevents measurable timing differences that enable email enumeration.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ---------------------------------------------------------------------------
// TOTP-REPLAY prevention — tracks used codes per user for 90 seconds.
// A 6-digit TOTP code is valid for ±1 window (~60s); this 90s TTL covers the
// full window plus a small buffer so the same code cannot be verified twice.
// ---------------------------------------------------------------------------
const usedTotpCodes = new Set<string>();

function isTotpCodeUsed(userId: number, code: string): boolean {
  return usedTotpCodes.has(`${userId}:${code}`);
}

function markTotpCodeUsed(userId: number, code: string): void {
  const key = `${userId}:${code}`;
  usedTotpCodes.add(key);
  setTimeout(() => usedTotpCodes.delete(key), 90_000).unref();
}

// ---------------------------------------------------------------------------
// Recovery code generator — produces XXXX-XXXX-XXXX format (12 hex chars)
// ---------------------------------------------------------------------------
function generatePlaintextCode(): string {
  const hex = randomBytes(6).toString('hex'); // 12 hex chars
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`.toUpperCase();
}

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER';
  isSystemAdmin: boolean;
}

interface LoginResult {
  token: string;
  user: AuthUser;
}

interface MfaPendingResult {
  mfaRequired: true;
  mfaToken: string;
  methods: string[];
  maskedEmail: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }

  const maskedLocal =
    local[0] +
    '*'.repeat(local.length - 2) +
    local[local.length - 1];

  return `${maskedLocal}@${domain}`;
}

interface MfaTokenPayload {
  mfaPending: true;
  userId: number;
  jti: string;
}

const LOCKOUT_MAX_FAILURES = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const authService = {
  async login(email: string, password: string): Promise<LoginResult | MfaPendingResult> {
    logger.info({ email }, 'Login attempt');

    const user = await prisma.user.findUnique({
      where: { email, isActive: true },
    });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      logger.warn({ email }, 'Login failed: user not found');
      throw new Error('User not found');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw Object.assign(new Error('account_locked'), { remainingMin });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const failures = user.loginFailures + 1;
      const willLock = failures >= LOCKOUT_MAX_FAILURES;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginFailures: failures,
          lockedUntil: willLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
        },
      });
      logger.warn({ userId: user.id }, 'Login failed: invalid credentials');
      await recordAuditEvent({
        category: AuditCategory.AUTH,
        action:   'AUTH_LOGIN_FAIL',
        actor:    { userId: user.id, email: user.email },
        severity: AuditSeverity.WARN,
        details:  { failures, locked: willLock },
      });
      if (willLock) {
        await recordAuditEvent({
          category: AuditCategory.AUTH,
          action:   'AUTH_LOCKOUT',
          actor:    { userId: user.id, email: user.email },
          severity: AuditSeverity.ERROR,
          details:  { lockedUntilMs: Date.now() + LOCKOUT_DURATION_MS },
        });
      }
      throw new Error('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginFailures: 0, lockedUntil: null },
    });

    // Maintenance mode: block non-system-admin login
    if (user.email !== env.SEED_USER_EMAIL && await isMaintenanceActive()) {
      throw new Error('maintenance_active');
    }

    // Only TOTP triggers step 2 — passkeys can also be used as a 2FA method
    if (user.totpEnabled) {
      const jti = randomUUID();
      const mfaPayload: MfaTokenPayload = { mfaPending: true, userId: user.id, jti };
      const mfaToken = jwt.sign(mfaPayload, env.JWT_SECRET, { expiresIn: '5m' });
      const mfaExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const [authenticatorCount, settings] = await Promise.all([
        prisma.authenticator.count({ where: { userId: user.id } }),
        settingsService.get(),
        prisma.mfaPendingToken.create({ data: { jti, userId: user.id, expiresAt: mfaExpiresAt } }),
      ]);
      logger.info({ userId: user.id }, 'MFA required');

      const methods = ['totp', 'recovery_code'];
      if (authenticatorCount > 0) methods.unshift('passkey');
      if (user.emailOtpEnabled && settings.smtpEnabled && settings.smtpHost && settings.smtpEmail) {
        methods.push('email_otp');
      }

      return { mfaRequired: true, mfaToken, methods, maskedEmail: maskEmail(user.email) };
    }

    const signOptions = { expiresIn: env.JWT_EXPIRES_IN } as unknown as SignOptions;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, jti: randomUUID() },
      env.JWT_SECRET,
      signOptions,
    );

    logger.info({ userId: user.id, role: user.role }, 'Login success');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.email === env.SEED_USER_EMAIL,
      },
    };
  },

  async requestEmailOtp(mfaToken: string): Promise<{ expiresAt: Date }> {
    let payload: MfaTokenPayload;
    try {
      payload = jwt.verify(mfaToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as MfaTokenPayload;
    } catch {
      throw new Error('mfa_token_invalid');
    }
    if (!payload.mfaPending) throw new Error('mfa_token_invalid');
    return emailOtpService.sendEmailOtp(payload.userId);
  },

  async verifyMfa(
    mfaToken: string,
    totpCode?: string,
    recoveryCode?: string,
    webauthnResponse?: Record<string, unknown>,
    emailOtpCode?: string,
  ): Promise<LoginResult> {
    let payload: MfaTokenPayload;
    try {
      payload = jwt.verify(mfaToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as MfaTokenPayload;
    } catch {
      throw new Error('mfa_token_invalid');
    }

    if (!payload.mfaPending || !payload.jti) {
      throw new Error('mfa_token_invalid');
    }

    const pendingToken = await prisma.mfaPendingToken.findUnique({ where: { jti: payload.jti } });
    if (!pendingToken || pendingToken.expiresAt < new Date()) {
      throw new Error('mfa_token_invalid');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true },
      include: { _count: { select: { authenticators: true } } },
    });

    if (!user) {
      throw new Error('mfa_token_invalid');
    }

    const hasMfa = user.totpEnabled || user._count.authenticators > 0;
    if (!hasMfa) {
      throw new Error('mfa_token_invalid');
    }

    if (totpCode) {
      // TOTP path — requires totpSecret
      if (!user.totpSecret) throw new Error('mfa_token_invalid');

      const isValid = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: totpCode,
        window: 1,
      });

      if (!isValid) {
        throw new Error('totp_invalid');
      }

      if (isTotpCodeUsed(user.id, totpCode)) {
        throw new Error('totp_already_used');
      }
      markTotpCodeUsed(user.id, totpCode);
    } else if (recoveryCode) {
      // Recovery code path
      const used = await authService.verifyRecoveryCode(user.id, recoveryCode);
      if (!used) {
        throw new Error('recovery_code_invalid');
      }
    } else if (webauthnResponse) {
      // Passkey path
      const ok = await webAuthnService.verifyAuthentication(user.id, webauthnResponse);
      if (!ok) {
        throw new Error('webauthn_invalid');
      }
    } else if (emailOtpCode) {
      // Email OTP path
      const ok = await emailOtpService.verifyEmailOtp(user.id, emailOtpCode);
      if (!ok) {
        throw new Error('email_otp_invalid');
      }
    } else {
      throw new Error('mfa_token_invalid');
    }

    await prisma.mfaPendingToken.delete({ where: { jti: payload.jti } });

    const signOptions = { expiresIn: env.JWT_EXPIRES_IN } as unknown as SignOptions;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, jti: randomUUID() },
      env.JWT_SECRET,
      signOptions,
    );

    logger.info({ userId: user.id }, 'MFA verified');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.email === env.SEED_USER_EMAIL,
      },
    };
  },

  async getMfaStatus(userId: number): Promise<{ totpEnabled: boolean; emailOtpEnabled: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, emailOtpEnabled: true },
    });
    if (!user) throw new Error('User not found');
    return { totpEnabled: user.totpEnabled, emailOtpEnabled: user.emailOtpEnabled };
  },

  async toggleEmailOtp(userId: number, enable: boolean, password?: string): Promise<{ emailOtpEnabled: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new Error('User not found');

    if (!enable) {
      if (!password) throw new Error('password_required');
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) throw new Error('wrong_password');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { emailOtpEnabled: enable },
      select: { emailOtpEnabled: true },
    });
    return { emailOtpEnabled: updatedUser.emailOtpEnabled };
  },

  async setupMfa(userId: number, password: string): Promise<{ qrCodeDataUrl: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new Error('wrong_password');

    const secretObj = speakeasy.generateSecret({
      name: `TMS (${user.email})`,
      issuer: 'TMS Transport',
      length: 20,
    });

    // Store secret immediately; totpEnabled stays false until first successful verification
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secretObj.base32 },
    });

    const otpauthUrl = secretObj.otpauth_url!;
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    // LOW-A: Do not return the raw secret — QR code alone is sufficient for setup.
    // Returning the secret in the response would allow a single intercepted response
    // to permanently compromise 2FA.
    return { qrCodeDataUrl };
  },

  async confirmMfaSetup(
    userId: number,
    totpCode: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user || !user.totpSecret) throw new Error('mfa_setup_not_started');

    const isValid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!isValid) throw new Error('totp_invalid');

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
      select: { email: true },
    });

    await recordAuditEvent({
      category: AuditCategory.AUTH,
      action:   'AUTH_TOTP_ENABLE',
      actor:    { userId, email: updatedUser.email },
      severity: AuditSeverity.WARN,
      details:  {},
    });

    const recoveryCodes = await authService._generateRecoveryCodes(userId);
    return { recoveryCodes };
  },

  async disableMfa(userId: number, password: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new Error('wrong_password');

    await prisma.$transaction([
      prisma.recoveryCode.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabled: false },
      }),
    ]);

    await recordAuditEvent({
      category: AuditCategory.AUTH,
      action:   'AUTH_TOTP_DISABLE',
      actor:    { userId, email: user.email },
      severity: AuditSeverity.WARN,
      details:  {},
    });
  },

  async regenerateRecoveryCodes(userId: number, password: string): Promise<{ recoveryCodes: string[] }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new Error('wrong_password');

    const recoveryCodes = await authService._generateRecoveryCodes(userId);
    return { recoveryCodes };
  },

  async verifyRecoveryCode(userId: number, code: string): Promise<boolean> {
    const unusedCodes = await prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    });

    for (const row of unusedCodes) {
      const matches = await bcrypt.compare(code.toUpperCase(), row.codeHash);
      if (matches) {
        await prisma.recoveryCode.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        });
        logger.info({ userId }, 'Recovery code used');
        return true;
      }
    }

    return false;
  },

  async getRecoveryCodeCount(userId: number): Promise<number> {
    return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
  },

  async getUserById(id: number): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { id, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return null;
    return { ...user, isSystemAdmin: user.email === env.SEED_USER_EMAIL };
  },

  /** Internal: generates 10 recovery codes, deletes old ones, stores hashed. */
  async _generateRecoveryCodes(userId: number): Promise<string[]> {
    const plaintextCodes = Array.from({ length: 10 }, generatePlaintextCode);
    const hashes = await Promise.all(plaintextCodes.map((c) => bcrypt.hash(c, 10)));

    await prisma.$transaction([
      prisma.recoveryCode.deleteMany({ where: { userId } }),
      prisma.recoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);

    return plaintextCodes;
  },

  async passkeyLogin(webauthnResponse: unknown, passkeyLoginToken: string): Promise<LoginResult> {
    const userId = await webAuthnService.verifyLoginAuthentication(webauthnResponse, passkeyLoginToken);

    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });

    if (!user) throw new Error('passkey_not_found');

    const signOptions = { expiresIn: env.JWT_EXPIRES_IN } as unknown as SignOptions;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, jti: randomUUID() },
      env.JWT_SECRET,
      signOptions,
    );

    logger.info({ userId: user.id }, 'Passkey login success');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.email === env.SEED_USER_EMAIL,
      },
    };
  },

  /** Clears the TOTP replay-prevention set. For test isolation only. */
  _clearUsedTotpCodes(): void {
    usedTotpCodes.clear();
  },
};
