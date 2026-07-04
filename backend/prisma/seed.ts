import 'dotenv/config';
import { PrismaClient } from '../src/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ──────────────────────────────────────────────────────────────
  const seedEmail = process.env.SEED_USER_EMAIL;
  const seedPassword = process.env.SEED_USER_PASSWORD;
  const seedName = process.env.SEED_USER_NAME || 'Admin TMS';

  if (!seedEmail || !seedPassword) {
    throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set in .env');
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      email: seedEmail,
      passwordHash,
      name: seedName,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Admin user: ${admin.email} (id: ${admin.id})`);

  // ─── Default AppSettings (singleton id=1) ────────────────────────────────────
  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: '',
      companyVatCode: '',
      companyRegNumber: '',
      companyAddress: '',
      companyCity: '',
      companyCounty: '',
      companyIban: '',
      companyBank: '',
      companySwift: '',
      smartbillEmail: '',
      smartbillApiToken: '',
      smartbillSeriesName: 'BGR',
      smartbillVatCode: '',
      defaultVatPercent: 0,
      defaultCurrency: 'EUR',
      defaultPaymentDays: 30,
      // AI toggles — chatbot OFF by default (Ollama not running), predictions ON
      aiChatbotEnabled: false,
      aiPredictionEnabled: true,
      // Pre-configure SMTP from env if provided — avoids manual Settings UI step on first deploy
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpSecure: process.env.SMTP_SECURE === 'true',
      smtpEmail: process.env.SMTP_USER || '',
      smtpPassword: process.env.SMTP_PASS || '',
      smtpEnabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
  });

  console.log(`✅ AppSettings created (id: ${settings.id})`);
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('  Login credentials:');
  console.log(`    Email:    ${seedEmail}`);
  console.log(`    Password: (from SEED_USER_PASSWORD env var)`);
  console.log('');
  console.log('  ⚠️  Change the password in production!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
