import { prisma } from '../config/database.js';

/**
 * Generate the next sequential order number for a given series.
 * Format: {SERIES}{NUMBER} — e.g., BGR315861
 *
 * Finds the highest existing number for the series and increments by 1.
 * Starting number: 300000
 */
export async function generateOrderNumber(series = 'BGR'): Promise<string> {
  const lastOrder = await prisma.order.findFirst({
    where: { orderSeries: series },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  const START = 300000;

  if (!lastOrder) {
    return `${series}${START}`;
  }

  const lastNumberStr = lastOrder.orderNumber.replace(series, '');
  const lastNumber = parseInt(lastNumberStr, 10);

  if (isNaN(lastNumber)) {
    return `${series}${START}`;
  }

  return `${series}${lastNumber + 1}`;
}
