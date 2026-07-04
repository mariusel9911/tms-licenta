import nodemailer from 'nodemailer';
import { settingsService } from '../modules/settings/settings.service.js';

export const mailerService = {
  async sendOtpEmail(to: string, code: string): Promise<void> {
    const settings = await settingsService.get();

    if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpEmail) {
      throw new Error('SMTP is not configured or is disabled in Settings');
    }

    const port = settings.smtpPort || 587;

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port,
      secure: settings.smtpSecure,
      tls: { rejectUnauthorized: true },
      auth: {
        user: settings.smtpEmail,
        pass: settings.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: settings.smtpEmail,
      to,
      subject: 'Your TMS verification code',
      text: `Your TMS verification code is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      html: `<p>Your TMS verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes. Do not share it with anyone.</p>`,
    });
  },

  async sendOrderEmail(
    to: string,
    orderNumber: string,
    pdfBuffer: Buffer,
    meta?: { vehiclePlate?: string | null; driverName?: string | null },
  ): Promise<void> {
    const settings = await settingsService.get();

    if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpEmail) {
      throw new Error('SMTP is not configured or is disabled in Settings');
    }

    const port = settings.smtpPort || 587;

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port,
      secure: settings.smtpSecure,
      tls: { rejectUnauthorized: true },
      auth: {
        user: settings.smtpEmail,
        pass: settings.smtpPassword,
      },
    });

    const lines: string[] = [`Am atașat PDF-ul pentru comanda cu seria ${orderNumber}.`];
    if (meta?.vehiclePlate || meta?.driverName) {
      const vehicle = meta.vehiclePlate ?? '—';
      const driver = meta.driverName ?? '—';
      lines.push('', `Vehicul: ${vehicle}`, `Șofer: ${driver}`);
    }
    const text = lines.join('\n');

    await transporter.sendMail({
      from: settings.smtpEmail,
      to,
      subject: `Comanda ${orderNumber}`,
      text,
      attachments: [
        {
          filename: `${orderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  },
};
