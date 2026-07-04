import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

import { settingsService } from '../settings.service.js';
import { buildAppSettings } from '../../../__tests__/helpers/factories.js';

beforeEach(() => {
  mockReset(prismaMock);
});

describe('settingsService.get()', () => {
  it('upserts and returns the singleton AppSettings row (id=1)', async () => {
    const settings = buildAppSettings();
    prismaMock.appSettings.upsert.mockResolvedValue(settings);

    const result = await settingsService.get();

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    expect(result).toEqual(settings);
  });
});

describe('settingsService.update()', () => {
  it('upserts with the provided DTO and returns updated settings', async () => {
    const dto = { companyName: 'New Company SRL', companyCity: 'Cluj' };
    const updated = buildAppSettings({ companyName: 'New Company SRL', companyCity: 'Cluj' });
    prismaMock.appSettings.upsert.mockResolvedValue(updated);

    const result = await settingsService.update(dto);

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
    expect(result.companyName).toBe('New Company SRL');
  });
});

describe('settingsService.updateLogoPath()', () => {
  it('sets a new logo path', async () => {
    const settings = buildAppSettings({ companyLogoPath: 'uploads/logos/company-logo.png' });
    prismaMock.appSettings.upsert.mockResolvedValue(settings);

    await settingsService.updateLogoPath('uploads/logos/company-logo.png');

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { companyLogoPath: 'uploads/logos/company-logo.png' },
      create: { id: 1, companyLogoPath: 'uploads/logos/company-logo.png' },
    });
  });

  it('clears the logo path when null is passed', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    prismaMock.appSettings.upsert.mockResolvedValue(settings);

    await settingsService.updateLogoPath(null);

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { companyLogoPath: null },
      create: { id: 1, companyLogoPath: null },
    });
  });
});

describe('settingsService.updateStampPath()', () => {
  it('sets a new stamp path', async () => {
    const settings = buildAppSettings({ companyStampPath: 'uploads/stamps/company-stamp.png' });
    prismaMock.appSettings.upsert.mockResolvedValue(settings);

    await settingsService.updateStampPath('uploads/stamps/company-stamp.png');

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { companyStampPath: 'uploads/stamps/company-stamp.png' },
      create: { id: 1, companyStampPath: 'uploads/stamps/company-stamp.png' },
    });
  });

  it('clears the stamp path when null is passed', async () => {
    const settings = buildAppSettings({ companyStampPath: null });
    prismaMock.appSettings.upsert.mockResolvedValue(settings);

    await settingsService.updateStampPath(null);

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { companyStampPath: null },
      create: { id: 1, companyStampPath: null },
    });
  });
});
