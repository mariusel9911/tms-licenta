import { prisma } from '../../config/database.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.util.js';
import { PartnerType } from '../../generated/client.js';
import type { CreatePartnerDtoType, UpdatePartnerDtoType } from './partners.dto.js';

export const partnersService = {
  async findAll(
    page: number,
    limit: number,
    search?: string,
    partnerType?: PartnerType,
  ) {
    const { skip, take } = paginate(page, limit);

    const where = {
      isActive: true,
      ...(partnerType && { partnerType }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { fiscalCode: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.partner.count({ where }),
    ]);

    return {
      items,
      ...buildPaginationMeta(total, page, limit),
    };
  },

  async findOne(id: number) {
    const partner = await prisma.partner.findFirst({
      where: { id, isActive: true },
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    return partner;
  },

  async create(dto: CreatePartnerDtoType) {
    if (dto.fiscalCode) {
      const existing = await prisma.partner.findUnique({
        where: { fiscalCode: dto.fiscalCode },
      });
      if (existing) {
        if (!existing.isActive) {
          // Soft-deleted record holds the unique slot — free it so the new partner can use it
          await prisma.partner.update({
            where: { id: existing.id },
            data: { fiscalCode: null },
          });
        } else {
          throw new Error('A partner with this fiscal code already exists');
        }
      }
    }

    return prisma.partner.create({
      data: {
        ...dto,
        email: dto.email || null,
        country: dto.country ?? 'Romania',
        receiveAllSms: dto.receiveAllSms ?? false,
      },
    });
  },

  async update(id: number, dto: UpdatePartnerDtoType) {
    await partnersService.findOne(id);

    if (dto.fiscalCode) {
      const existing = await prisma.partner.findUnique({
        where: { fiscalCode: dto.fiscalCode },
      });
      if (existing && existing.id !== id) {
        if (!existing.isActive) {
          // Soft-deleted record holds the unique slot — free it
          await prisma.partner.update({
            where: { id: existing.id },
            data: { fiscalCode: null },
          });
        } else {
          throw new Error('A partner with this fiscal code already exists');
        }
      }
    }

    return prisma.partner.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email === '' ? null : dto.email,
      },
    });
  },

  async remove(id: number) {
    await partnersService.findOne(id);

    return prisma.partner.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
