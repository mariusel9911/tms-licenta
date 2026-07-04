import { PrismaClient } from '../../generated/client.js';

/**
 * Generates the next sequential order number for a given series.
 * Format: {SERIES}{NUMBER} e.g., BGR315861
 * Call inside a prisma.$transaction to avoid race conditions.
 */
export async function generateOrderNumber(
  prisma: PrismaClient,
  series: string,
  startNumber: number = 1,
): Promise<string> {
  // Enforce series format before embedding in raw query (CRIT-5 / ReDoS guard)
  if (!/^[A-Z]{2,6}$/.test(series)) {
    throw new Error(`Invalid order series format: "${series}"`);
  }

  const result = await prisma.$queryRaw<Array<{ max_num: bigint | null }>>`
    SELECT MAX(
      CAST(
        SUBSTRING("orderNumber" FROM ${series.length + 1}::int)
        AS BIGINT
      )
    ) AS max_num
    FROM orders
    WHERE "orderNumber" LIKE ${series + '%'}
    AND "orderNumber" ~ ${'^' + series + '[0-9]+$'}
  `;

  const maxNum = result[0]?.max_num ?? null;
  const nextNum = maxNum !== null ? Math.max(Number(maxNum) + 1, startNumber) : startNumber;

  return `${series}${nextNum}`;
}
