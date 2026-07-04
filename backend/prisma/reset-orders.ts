/**
 * reset-orders.ts — deletes all orders and related data (activity logs, invoice items).
 * Partners, vehicles, users, and settings are untouched.
 *
 * Run: npm run reset:orders
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑  Resetting orders...\n');

  const [activityLogs, invoiceItems, orders, cache] = await prisma.$transaction([
    prisma.activityLog.deleteMany({}),
    prisma.invoiceItem.deleteMany({}),
    prisma.order.deleteMany({}),
    prisma.aiPredictionCache.deleteMany({}),
  ]);

  // Bump ordersVersion so any surviving cache entries are invalidated on next request
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { ordersVersion: { increment: 1 } },
  });

  console.log(`  ✅ Deleted ${orders.count} orders`);
  console.log(`  ✅ Deleted ${activityLogs.count} activity log entries`);
  console.log(`  ✅ Deleted ${invoiceItems.count} invoice items`);
  console.log(`  ✅ Cleared ${cache.count} AI prediction cache entries`);
  console.log('\n🎉 Done — run npm run seed:demo to reseed orders.');
}

main()
  .catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
