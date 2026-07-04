import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

vi.mock('../../modules/settings/settings.service', () => ({
  settingsService: {
    get: vi.fn(),
  },
}));

import nodemailer from 'nodemailer';
import { settingsService } from '../../modules/settings/settings.service.js';
import { mailerService } from '../mailer.service.js';
import { buildAppSettings } from '../../__tests__/helpers/factories.js';

const nodemailerMock = nodemailer as unknown as { createTransport: ReturnType<typeof vi.fn> };
const settingsMock = settingsService as { get: ReturnType<typeof vi.fn> };

const pdfBuffer = Buffer.from('fake-pdf-content');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mailerService.sendOrderEmail()', () => {
  it('sends email successfully when SMTP is configured', async () => {
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
    nodemailerMock.createTransport.mockReturnValue({ sendMail: mockSendMail } as never);
    settingsMock.get.mockResolvedValue(
      buildAppSettings({
        smtpEnabled: true,
        smtpHost: 'smtp.example.com',
        smtpEmail: 'noreply@example.com',
        smtpPassword: 'smtp_pass',
        smtpPort: 587,
        smtpSecure: false,
      }),
    );

    await expect(
      mailerService.sendOrderEmail('recipient@example.com', 'BGR100', pdfBuffer),
    ).resolves.toBeUndefined();

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'noreply@example.com', pass: 'smtp_pass' },
      }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Comanda BGR100',
      }),
    );
  });

  it('throws when SMTP is disabled', async () => {
    settingsMock.get.mockResolvedValue(buildAppSettings({ smtpEnabled: false }));

    await expect(
      mailerService.sendOrderEmail('recipient@example.com', 'BGR100', pdfBuffer),
    ).rejects.toThrow('SMTP is not configured or is disabled in Settings');
  });

  it('throws when SMTP host is missing', async () => {
    settingsMock.get.mockResolvedValue(
      buildAppSettings({ smtpEnabled: true, smtpHost: '', smtpEmail: 'noreply@example.com' }),
    );

    await expect(
      mailerService.sendOrderEmail('recipient@example.com', 'BGR100', pdfBuffer),
    ).rejects.toThrow('SMTP is not configured or is disabled in Settings');
  });

  it('appends vehicle and driver lines to body when meta is provided', async () => {
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
    nodemailerMock.createTransport.mockReturnValue({ sendMail: mockSendMail } as never);
    settingsMock.get.mockResolvedValue(
      buildAppSettings({
        smtpEnabled: true,
        smtpHost: 'smtp.example.com',
        smtpEmail: 'noreply@example.com',
        smtpPassword: 'smtp_pass',
        smtpPort: 587,
        smtpSecure: false,
      }),
    );

    await mailerService.sendOrderEmail('recipient@example.com', 'BGR100', pdfBuffer, {
      vehiclePlate: 'TM01ABC',
      driverName: 'Ion Popescu',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Vehicul: TM01ABC'),
      }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Șofer: Ion Popescu'),
      }),
    );
  });

  it('uses secure:true when port is 465', async () => {
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
    nodemailerMock.createTransport.mockReturnValue({ sendMail: mockSendMail } as never);
    settingsMock.get.mockResolvedValue(
      buildAppSettings({
        smtpEnabled: true,
        smtpHost: 'smtp.example.com',
        smtpEmail: 'noreply@example.com',
        smtpPassword: 'smtp_pass',
        smtpPort: 465,
        smtpSecure: true,
      }),
    );

    await mailerService.sendOrderEmail('recipient@example.com', 'BGR100', pdfBuffer);

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });
});
