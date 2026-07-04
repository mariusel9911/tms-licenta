export interface AppSettings {
  id: number;
  companyName: string;
  companyVatCode: string;
  companyRegNumber: string;
  companyAddress: string;
  companyCity: string;
  companyCounty: string;
  companyIban: string;
  companyBank: string;
  companySwift: string;
  companyLogoPath: string | null;
  companyStampPath: string | null;
  companyPhone: string;
  companyEmail: string;
  termsAndConditions: string;
  smartbillEmail: string;
  smartbillApiToken: string;
  smartbillSeriesName: string;
  smartbillVatCode: string;
  // Prisma Decimal fields come as strings over JSON
  defaultVatPercent: string;
  defaultCurrency: string;
  defaultPaymentDays: number;
  // Order numbering
  orderNumberStart: number;
  // Order Auto-Archive (M34+)
  autoArchiveEnabled: boolean;
  autoArchiveAfterMonths: number;
  autoArchiveFrequency: string;
  autoArchiveDay: number | null;
  autoArchiveTime: string;
  // Database Auto-Backup (M35 + Phase D tiered retention)
  autoBackupEnabled: boolean;
  autoBackupFrequency: string;
  autoBackupDay: number | null;
  autoBackupTime: string;
  autoBackupDestination: 'local' | 'remote' | 'both';
  autoBackupRetainCount: number;
  // AI Feature Toggles (diploma branch)
  aiChatbotEnabled: boolean;
  aiPredictionEnabled: boolean;
  // SMTP (for Send Order feature)
  smtpEmail: string;
  smtpPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpEnabled: boolean;
  smtpSecure: boolean;
  // Maintenance mode (M41)
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  // Rate limit configuration (M41)
  rateLimitPerUser: number;
  rateLimitEnabled: boolean;
  // Audit log category toggles
  auditBackupEnabled: boolean;
  auditAuthEnabled: boolean;
  auditUserMgmtEnabled: boolean;
  auditSettingsEnabled: boolean;
  updatedAt: string;
}
