import { prisma } from '../../config/database.js';

export const activityService = {
  async log(
    orderId: number,
    userId: number | null,
    action: string,
    details?: string,
  ) {
    return prisma.activityLog.create({
      data: {
        orderId,
        userId,
        action,
        details,
      },
    });
  },

  async findByOrder(orderId: number) {
    return prisma.activityLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });
  },
};
