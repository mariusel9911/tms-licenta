/**
 * seed-demo.ts — inserts demo partners + orders for statistics/prediction testing.
 * Run: npm run seed:demo
 *
 * Safe to run multiple times (idempotent on fiscalCode).
 */
import 'dotenv/config';
import { PrismaClient, OrderStatus } from '../src/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

const CLIENTS = [
  { name: 'Cargomax SRL', fiscalCode: 'RO12345678', country: 'Romania', city: 'Bucharest' },
  { name: 'TransLogic GmbH', fiscalCode: 'DE987654321', country: 'Germany', city: 'Munich' },
  { name: 'EuroFreight SA', fiscalCode: 'FR11223344', country: 'France', city: 'Lyon' },
];

const TRANSPORTERS = [
  { name: 'FastTruck SRL', fiscalCode: 'RO87654321', country: 'Romania', city: 'Cluj-Napoca' },
  { name: 'SpeedCargo SRL', fiscalCode: 'RO11112222', country: 'Romania', city: 'Timisoara' },
];

const ROUTES = [
  { from: 'Bucharest, RO', to: 'Munich, DE', fromCountry: 'Romania', toCountry: 'Germany', km: 1850 },
  { from: 'Cluj-Napoca, RO', to: 'Vienna, AT', fromCountry: 'Romania', toCountry: 'Austria', km: 920 },
  { from: 'Timisoara, RO', to: 'Lyon, FR', fromCountry: 'Romania', toCountry: 'France', km: 1650 },
  { from: 'Bucharest, RO', to: 'Warsaw, PL', fromCountry: 'Romania', toCountry: 'Poland', km: 1300 },
  { from: 'Sibiu, RO', to: 'Berlin, DE', fromCountry: 'Romania', toCountry: 'Germany', km: 1700 },
  { from: 'Constanta, RO', to: 'Hamburg, DE', fromCountry: 'Romania', toCountry: 'Germany', km: 2100 },
  { from: 'Brasov, RO', to: 'Prague, CZ', fromCountry: 'Romania', toCountry: 'Czech Republic', km: 1100 },
  { from: 'Iasi, RO', to: 'Brussels, BE', fromCountry: 'Romania', toCountry: 'Belgium', km: 2300 },
];

const CARGO_TYPES = [
  'General cargo',
  'Palletized goods',
  'Electronics',
  'Automotive parts',
  'Food products',
  'Construction materials',
  'Textile goods',
  'Industrial equipment',
];

// Orders per month index 0=oldest (12 months ago) to 11=current month
// Slightly rising trend so the prediction graph looks interesting
const MONTHLY_COUNTS = [3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 5];

async function main() {
  console.log('🌱 Seeding demo data...\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin user found — run the main seed first (npx prisma db seed)');

  // ── Create client partners ──────────────────────────────────────────────────
  const clientPartners: { id: number; name: string }[] = [];
  for (const c of CLIENTS) {
    const existing = await prisma.partner.findFirst({ where: { fiscalCode: c.fiscalCode } });
    if (existing) {
      clientPartners.push({ id: existing.id, name: existing.name });
      console.log(`  ↩  Client already exists: ${c.name}`);
    } else {
      const p = await prisma.partner.create({
        data: {
          name: c.name,
          fiscalCode: c.fiscalCode,
          registrationNumber: c.fiscalCode.replace(/[A-Z]/g, '') + '/2020',
          partnerType: 'CLIENT',
          country: c.country,
          city: c.city,
          addressLine1: `${c.city} Business Center`,
          phone: '+40700100200',
          email: `contact@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
          isActive: true,
        },
      });
      clientPartners.push({ id: p.id, name: p.name });
      console.log(`  ✅ Created client: ${p.name}`);
    }
  }

  // ── Create transporter partners ─────────────────────────────────────────────
  const transporterPartners: { id: number; name: string }[] = [];
  for (const t of TRANSPORTERS) {
    const existing = await prisma.partner.findFirst({ where: { fiscalCode: t.fiscalCode } });
    if (existing) {
      transporterPartners.push({ id: existing.id, name: existing.name });
      console.log(`  ↩  Transporter already exists: ${t.name}`);
    } else {
      const p = await prisma.partner.create({
        data: {
          name: t.name,
          fiscalCode: t.fiscalCode,
          registrationNumber: t.fiscalCode.replace(/[A-Z]/g, '') + '/2019',
          partnerType: 'TRANSPORTER',
          country: t.country,
          city: t.city,
          addressLine1: `${t.city} Logistics Park`,
          phone: '+40700200300',
          email: `office@${t.name.toLowerCase().replace(/\s+/g, '')}.com`,
          isActive: true,
        },
      });
      transporterPartners.push({ id: p.id, name: p.name });
      console.log(`  ✅ Created transporter: ${p.name}`);
    }
  }

  // ── Delete any existing demo orders (so re-runs are clean) ────────────────
  const demoClientIds = clientPartners.map((p) => p.id);
  const deleted = await prisma.order.deleteMany({ where: { clientId: { in: demoClientIds } } });
  if (deleted.count > 0) console.log(`\n  🗑  Removed ${deleted.count} old demo orders`);

  // ── Determine next order number ─────────────────────────────────────────────
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const startNum = settings?.orderNumberStart ?? 1;

  const lastOrder = await prisma.order.findFirst({
    orderBy: { id: 'desc' },
    select: { orderNumber: true },
  });

  let nextNum = startNum;
  if (lastOrder) {
    const match = lastOrder.orderNumber.match(/(\d+)$/);
    if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
  }

  // ── Create orders spread over 12 months ────────────────────────────────────
  console.log('\n  Creating orders...');
  let totalCreated = 0;
  const now = new Date();

  for (let m = 0; m < 12; m++) {
    const count = MONTHLY_COUNTS[m] ?? 4;
    // m=0 is 11 months ago, m=11 is current month
    const monthsAgo = 11 - m;

    for (let i = 0; i < count; i++) {
      const docDate = new Date(now);
      docDate.setMonth(docDate.getMonth() - monthsAgo);
      docDate.setDate(1 + Math.floor((i / count) * 26)); // spread within month

      const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
      const client = clientPartners[Math.floor(Math.random() * clientPartners.length)];
      const transporter = transporterPartners[Math.floor(Math.random() * transporterPartners.length)];
      const cargo = CARGO_TYPES[Math.floor(Math.random() * CARGO_TYPES.length)];

      // clientPrice = revenue from client (bigger number)
      // transporterPrice = cost paid to transporter (62–78% of clientPrice → 22–38% profit margin)
      const clientPrice = randomBetween(800, 3200);
      const transporterPrice = Math.round(clientPrice * randomBetween(0.62, 0.78) * 100) / 100;

      const pickupBegin = new Date(docDate);
      pickupBegin.setDate(pickupBegin.getDate() + 1);
      const deliveryEnd = new Date(pickupBegin);
      deliveryEnd.setDate(deliveryEnd.getDate() + Math.ceil(route.km / 700));

      // Recent orders get mixed statuses; older ones are COMPLETED
      let status: OrderStatus;
      if (monthsAgo === 0) {
        const r = i % 4;
        status = r === 0 ? OrderStatus.IN_PROGRESS : r === 1 ? OrderStatus.CONFIRMED : OrderStatus.COMPLETED;
      } else {
        status = OrderStatus.COMPLETED;
      }

      const orderNumber = `BGR${String(nextNum++).padStart(6, '0')}`;

      await prisma.order.create({
        data: {
          orderNumber,
          orderSeries: 'BGR',
          clientId: client.id,
          transporterId: transporter.id,
          createdById: admin.id,
          status,
          documentDate: docDate,
          pickupAddress: route.from,
          pickupCountry: route.fromCountry,
          pickupDateBegin: pickupBegin,
          pickupDateEnd: pickupBegin,
          deliveryAddress: route.to,
          deliveryCountry: route.toCountry,
          deliveryDateBegin: deliveryEnd,
          deliveryDateEnd: deliveryEnd,
          distanceKm: route.km,
          cargoDescription: cargo,
          cargoWeightKg: randomBetween(5000, 24000),
          transporterPrice,
          transporterCurrency: 'EUR',
          clientPrice,
          clientCurrency: 'EUR',
          isSent: status === OrderStatus.COMPLETED,
          sentAt: status === OrderStatus.COMPLETED ? new Date(deliveryEnd.getTime() + 86400000) : null,
          cargoItemsJson: JSON.stringify([
            { description: cargo, weight: randomBetween(500, 22000), volume: randomBetween(5, 80), unit: 'pallet' },
          ]),
        },
      });

      totalCreated++;
    }
  }

  // Bump ordersVersion to invalidate AI prediction cache
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { ordersVersion: { increment: 1 } },
  });

  console.log(`\n✅ Created ${totalCreated} demo orders across 12 months`);
  console.log('🎉 Demo seed complete — open Statistics page to see the graphs!\n');
}

main()
  .catch((err) => {
    console.error('❌ Demo seed failed:', err);
      process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
