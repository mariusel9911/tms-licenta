import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { settingsService } from '../settings/settings.service.js';
import { mailerService } from '../../config/mailer.service.js';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const emailOtpService = {
  async sendEmailOtp(userId: number): Promise<{ expiresAt: Date }> {
    // Check SMTP configured before doing any work
    const settings = await settingsService.get();
    if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpEmail) {
      throw new Error('smtp_not_configured');
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new Error('User not found');

    const code = String(randomInt(100000, 999999 + 1)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    const { expiresAt } = await prisma.$transaction(async (tx) => {
      await tx.emailOtpChallenge.deleteMany({
        where: { userId, expiresAt: { lt: new Date() } },
      });
      await tx.emailOtpChallenge.deleteMany({ where: { userId, usedAt: null } });
      return tx.emailOtpChallenge.create({
        data: { userId, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      });
    });

    await mailerService.sendOtpEmail(user.email, code);

    return { expiresAt };
  },

  async verifyEmailOtp(userId: number, code: string): Promise<boolean> {
    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) return false;

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) return false;

    await prisma.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });

    return true;
  },

  async cleanupExpiredChallenges(userId?: number): Promise<void> {
    await prisma.emailOtpChallenge.deleteMany({
      where: {
        ...(userId !== undefined ? { userId } : {}),
        expiresAt: { lt: new Date() },
      },
    });
  },
};
