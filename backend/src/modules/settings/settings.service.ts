import { prisma } from '../../config/database.js';
import type { UpdateSettingsDtoType } from './settings.dto.js';

export const settingsService = {
  async get() {
    // AppSettings is a singleton row with id=1
    // upsert ensures the row exists even on a fresh database
    return prisma.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  },

  async update(dto: UpdateSettingsDtoType) {
    return prisma.appSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  },

  async updateLogoPath(logoPath: string | null) {
    return prisma.appSettings.upsert({
      where: { id: 1 },
      update: { companyLogoPath: logoPath },
      create: { id: 1, companyLogoPath: logoPath },
    });
  },

  async updateStampPath(stampPath: string | null) {
    return prisma.appSettings.upsert({
      where: { id: 1 },
      update: { companyStampPath: stampPath },
      create: { id: 1, companyStampPath: stampPath },
    });
  },
};
