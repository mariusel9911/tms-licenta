import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Code2, Database, Eye, EyeOff, FileText, Mail, Save, ScrollText, Shield, Trash2, Upload, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UsersManagementPanel } from '@/components/users/UsersManagementPanel';
import { SecurityTabContent } from '@/components/security/SecurityTabContent';
import { ArchiveSettingsCard } from '@/components/settings/ArchiveSettingsCard';
import { AiSettingsCard } from '@/components/settings/AiSettingsCard';
import { BackupManagementPanel } from '@/components/settings/BackupManagementPanel';
import { SystemLogsPanel } from '@/components/settings/SystemLogsPanel';
import { DeveloperSettingsPanel } from '@/components/settings/DeveloperSettingsPanel';
import { useSettings, useUpdateSettings, useUploadLogo, useDeleteLogo, useUploadStamp, useDeleteStamp } from '@/hooks/useSettings';
import { testSmtpConnection } from '@/api/settings.api';
import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth.store';

type Tab = 'general' | 'invoicing' | 'security' | 'users' | 'database' | 'auditlogs' | 'developer';

const TABS: { id: Tab; label: string; Icon: React.ElementType; description: string; adminOnly?: boolean; dispatcherAllowed?: boolean; systemAdminOnly?: boolean }[] = [
  { id: 'general', label: 'General', Icon: Building2, description: 'Company identity and contact details.' },
  // TODO: { id: 'banking', label: 'Banking', Icon: Landmark, description: 'Bank account information for invoices.' },
  { id: 'invoicing', label: 'Invoicing', Icon: FileText, description: 'Invoice defaults and terms of service.' },
  // TODO: { id: 'integrations', label: 'Integrations', Icon: Zap, description: 'Third-party API credentials.' },
  { id: 'security', label: 'Security', Icon: Shield, description: 'Account security settings.', dispatcherAllowed: true },
  { id: 'users', label: 'Users', Icon: Users2, description: '', adminOnly: true },
  { id: 'database', label: 'Database', Icon: Database, description: 'Backup and restore the application database.', adminOnly: true },
  { id: 'auditlogs', label: 'System Logs', Icon: ScrollText, description: 'System-wide audit event log.', adminOnly: true },
  { id: 'developer', label: 'Developer', Icon: Code2, description: 'System maintenance and developer tools.', systemAdminOnly: true },
];

const settingsFormSchema = z.object({
  companyName: z.string().optional(),
  companyVatCode: z.string().optional(),
  companyRegNumber: z.string().optional(),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyCounty: z.string().optional(),
  companyIban: z.string().optional(),
  companyBank: z.string().optional(),
  companySwift: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().optional(),
  termsAndConditions: z.string().optional(),
  smartbillEmail: z.string().optional(),
  smartbillApiToken: z.string().optional(),
  smartbillSeriesName: z.string().optional(),
  smartbillVatCode: z.string().optional(),
  defaultVatPercent: z.coerce.number().min(0).max(100).optional(),
  defaultCurrency: z.string().optional(),
  defaultPaymentDays: z.coerce.number().int().min(0).optional(),
  orderNumberStart: z.coerce.number().int().min(1).optional(),
  smtpEmail: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpEnabled: z.boolean().optional(),
  autoArchiveAfterMonths: z.coerce.number().int().min(1).max(120).optional(),
  autoArchiveFrequency: z.string().optional(),
  autoArchiveDay: z.number().int().nullable().optional(),
  autoArchiveTime: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function SettingsPage() {
  useEffect(() => { document.title = 'Settings'; }, []);
  const { toast } = useToast();
  const { user: authUser } = useAuthStore();
  const isAdmin = authUser?.role === 'ADMIN';

  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const uploadLogoMutation = useUploadLogo();
  const deleteLogoMutation = useDeleteLogo();
  const uploadStampMutation = useUploadStamp();
  const deleteStampMutation = useDeleteStamp();
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => (authUser?.role === 'ADMIN' ? 'general' : 'security'));
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  type SmtpStatusState = { status: 'degraded' | 'offline' | 'online' | 'maintenance'; message: string };
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusState>(() => {
    try {
      const raw = localStorage.getItem('tms_smtp_status');
      if (raw) return JSON.parse(raw) as SmtpStatusState;
    } catch { }
    return { status: 'degraded', message: 'Not configured' };
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const smtpSavingRef = useRef(false);
  // Guards useEffect from overriding manually-set status on subsequent settings refetches
  const smtpInitialized = useRef(false);
  // Only mark offline after 2 consecutive failures — ignores single transient hiccups
  const smtpFailures = useRef(0);

  // Clamp active tab to 'security' if the user is a DISPATCHER
  useEffect(() => {
    if (!isAdmin && activeTab !== 'security') {
      setActiveTab('security');
    }
  }, [isAdmin, activeTab]);

  const updateSmtpStatus = useCallback((next: SmtpStatusState) => {
    setSmtpStatus(next);
    try { localStorage.setItem('tms_smtp_status', JSON.stringify(next)); } catch { }
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogoMutation.mutate(file, {
      onSuccess: () => toast({ title: 'Logo uploaded successfully' }),
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: 'Upload failed', description: msg ?? 'An unexpected error occurred.', variant: 'destructive' });
      },
    });
    e.target.value = '';
  };

  const handleDeleteLogo = () => {
    deleteLogoMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'Logo removed' }),
      onError: () => toast({ title: 'Remove failed', variant: 'destructive' }),
    });
  };

  const handleStampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadStampMutation.mutate(file, {
      onSuccess: () => toast({ title: 'Stamp uploaded successfully' }),
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: 'Upload failed', description: msg ?? 'An unexpected error occurred.', variant: 'destructive' });
      },
    });
    e.target.value = '';
  };

  const handleDeleteStamp = () => {
    deleteStampMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'Stamp removed' }),
      onError: () => toast({ title: 'Remove failed', variant: 'destructive' }),
    });
  };

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      companyName: '', companyVatCode: '', companyRegNumber: '',
      companyAddress: '', companyCity: '', companyCounty: '',
      companyIban: '', companyBank: '', companySwift: '',
      companyPhone: '+40', companyEmail: '', termsAndConditions: '',
      smartbillEmail: '', smartbillApiToken: '', smartbillSeriesName: '', smartbillVatCode: '',
      defaultVatPercent: 0, defaultCurrency: 'EUR', defaultPaymentDays: 30,
      orderNumberStart: 1,
      smtpEmail: '', smtpPassword: '', smtpHost: '', smtpPort: 587, smtpEnabled: false,
      autoArchiveAfterMonths: 3, autoArchiveFrequency: 'DAILY', autoArchiveDay: null, autoArchiveTime: '02:00',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName,
        companyVatCode: settings.companyVatCode,
        companyRegNumber: settings.companyRegNumber,
        companyAddress: settings.companyAddress,
        companyCity: settings.companyCity,
        companyCounty: settings.companyCounty,
        companyIban: settings.companyIban,
        companyBank: settings.companyBank,
        companySwift: settings.companySwift,
        companyPhone: settings.companyPhone || '+40',
        companyEmail: settings.companyEmail,
        termsAndConditions: settings.termsAndConditions,
        smartbillEmail: settings.smartbillEmail,
        smartbillApiToken: settings.smartbillApiToken,
        smartbillSeriesName: settings.smartbillSeriesName,
        smartbillVatCode: settings.smartbillVatCode,
        defaultVatPercent: parseFloat(settings.defaultVatPercent) || 0,
        defaultCurrency: settings.defaultCurrency,
        defaultPaymentDays: settings.defaultPaymentDays,
        orderNumberStart: settings.orderNumberStart ?? 1,
        smtpEmail: settings.smtpEmail,
        smtpPassword: settings.smtpPassword,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort ?? 587,
        smtpEnabled: settings.smtpEnabled ?? false,
        autoArchiveAfterMonths: settings.autoArchiveAfterMonths ?? 3,
        autoArchiveFrequency: settings.autoArchiveFrequency ?? 'DAILY',
        autoArchiveDay: settings.autoArchiveDay ?? null,
        autoArchiveTime: settings.autoArchiveTime ?? '02:00',
      });
      // Only set initial status once — don't override on subsequent settings refetches
      if (!smtpInitialized.current) {
        smtpInitialized.current = true;
        // If localStorage has a saved status, keep it; otherwise derive from server data
        if (!localStorage.getItem('tms_smtp_status')) {
          const hasConfig = !!(settings.smtpHost && settings.smtpEmail && settings.smtpPassword);
          updateSmtpStatus(hasConfig
            ? { status: 'maintenance', message: 'Not tested' }
            : { status: 'degraded', message: 'Not configured' });
        }
      }
    }
  }, [settings]);

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    smtpSavingRef.current = true;
    const values = form.getValues();
    try {
      await updateMutation.mutateAsync({
        smtpEmail: values.smtpEmail,
        smtpPassword: values.smtpPassword,
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        smtpEnabled: true,
        companyEmail: values.smtpEmail,
      });
      try {
        await testSmtpConnection();
        smtpFailures.current = 0;
        updateSmtpStatus({ status: 'online', message: 'Running' });
        toast({ title: 'SMTP saved & verified' });
      } catch (testErr) {
        const msg = (testErr as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Connection failed';
        updateSmtpStatus({ status: 'offline', message: msg });
        toast({ title: 'SMTP saved but connection failed', description: msg, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to save SMTP config', variant: 'destructive' });
    } finally {
      setSmtpSaving(false);
      smtpSavingRef.current = false;
    }
  };

  const handleClearSmtp = async () => {
    form.setValue('smtpEmail', '');
    form.setValue('smtpPassword', '');
    form.setValue('smtpHost', '');
    form.setValue('smtpPort', 587);
    try {
      await updateMutation.mutateAsync({
        smtpEmail: '', smtpPassword: '', smtpHost: '', smtpPort: 587,
        smtpEnabled: false, companyEmail: '',
      });
      updateSmtpStatus({ status: 'degraded', message: 'Not configured' });
      toast({ title: 'SMTP configuration cleared' });
    } catch {
      toast({ title: 'Failed to clear SMTP config', variant: 'destructive' });
    }
  };

  // Poll SMTP status every 60 s — only while the General tab is visible and SMTP is configured.
  // Only flip to offline after 2 consecutive failures — ignores single transient hiccups.
  useEffect(() => {
    if (smtpStatus.status === 'degraded') return;
    if (activeTab !== 'general') return;
    const interval = setInterval(async () => {
      if (smtpSavingRef.current) return;
      try {
        await testSmtpConnection();
        smtpFailures.current = 0;
        updateSmtpStatus({ status: 'online', message: 'Running' });
      } catch (err) {
        smtpFailures.current += 1;
        if (smtpFailures.current >= 2) {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Connection failed';
          updateSmtpStatus({ status: 'offline', message: msg });
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [smtpStatus.status, updateSmtpStatus, activeTab]);

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      // smtpEmail is the single email source — keep companyEmail in sync
      await updateMutation.mutateAsync({ ...values, companyEmail: values.smtpEmail });
      toast({ title: 'Settings saved', description: 'Your changes have been saved successfully.' });
    } catch {
      toast({ title: 'Error saving settings', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  const SaveButton = ({ align = 'end' }: { align?: 'start' | 'end' }) => (
    <div className={`flex ${align === 'start' ? 'justify-start' : 'justify-end'} pt-6 border-t border-gray-100 mt-8`}>
      <Button
        type="submit"
        disabled={updateMutation.isPending}
        className="bg-green-600 hover:bg-green-700 text-white active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
      >
        <Save className="w-4 h-4 mr-2" />
        {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );

  return (
    <div className="pb-24">

      {/* Page title */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Horizontal tab bar — full width */}
      <div className="flex border-b border-gray-200 mb-8 -mx-6 px-6">
        {TABS.filter((t) => {
          if (t.systemAdminOnly) return authUser?.isSystemAdmin === true;
          if (isAdmin) return true;
          return t.dispatcherAllowed === true;
        }).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-[transform,color,border-color] duration-150 ease-out-expo border-b-2 -mb-px active:scale-[0.98] ${activeTab === id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Security tab — separate from the settings form */}
      {activeTab === 'security' && <SecurityTabContent />}

      {/* Database tab — separate from the settings form */}
      {activeTab === 'database' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                <Database className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">Database</h2>
                <p className="text-sm text-gray-500">Backup and restore the application database.</p>
              </div>
            </div>
          </div>
          <BackupManagementPanel />
        </div>
      )}

      {/* System Logs tab — admin only */}
      {activeTab === 'auditlogs' && <SystemLogsPanel />}

      {/* Developer tab — system admin only */}
      {activeTab === 'developer' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                <Code2 className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">Developer</h2>
                <p className="text-sm text-gray-500">System maintenance and developer tools.</p>
              </div>
            </div>
          </div>
          <DeveloperSettingsPanel />
        </div>
      )}

      {/* Users tab — separate from the settings form */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                <Users2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Users</h2>
                <p className="text-sm text-gray-500">
                  Manage system accounts. Each user can be assigned the <strong>Admin</strong> or <strong>Dispatcher</strong> role. Admins have full access; Dispatchers can manage orders and partners.
                </p>
              </div>
            </div>
          </div>
          <UsersManagementPanel />
        </div>
      )}

      {/* Content — general renders its own cards; banking + invoicing use one white panel */}
      {activeTab !== 'users' && activeTab !== 'security' && activeTab !== 'database' && activeTab !== 'auditlogs' && activeTab !== 'developer' && (
        <div className={activeTab === 'general' ? 'space-y-4' : 'bg-white rounded-lg border border-gray-200 p-6'}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>

              {/* Section header — shown for banking + invoicing only */}
              {activeTab !== 'general' && (
                <div className="flex items-center gap-4 pb-6 border-b border-gray-200 mb-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                    <activeTabMeta.Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{activeTabMeta.label}</h2>
                    <p className="text-sm text-gray-500">{activeTabMeta.description}</p>
                  </div>
                </div>
              )}

              {/* ── GENERAL ─────────────────────────────────────── */}
              {activeTab === 'general' && (
                <div className="space-y-4">

                  {/* Card 1 — Company Identity */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <Building2 className="h-4 w-4 text-gray-900" />
                      <p className="text-sm font-semibold text-gray-800">Company Identity</p>
                    </div>

                    {/* Logo */}
                    <div className="mb-6">
                      <label className="text-sm font-medium leading-none text-gray-700">Company Logo</label>
                      <p className="text-xs text-gray-500 mt-1 mb-3">
                        Replaces the company name on the PDF header. Accepts JPG, PNG, WebP — max 5 MB.
                      </p>
                      <div className="flex items-center gap-4">
                        {settings?.companyLogoPath ? (
                          <img
                            src={`/api/${settings.companyLogoPath}?v=${new Date(settings.updatedAt).getTime()}`}
                            alt="Company logo"
                            className="h-14 max-w-[160px] object-contain border border-gray-200 rounded p-1 bg-white"
                          />
                        ) : (
                          <div className="h-14 w-32 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors duration-150">
                            No logo
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handleLogoChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadLogoMutation.isPending}
                            onClick={() => logoInputRef.current?.click()}
                            className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            {uploadLogoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
                          </Button>
                          {settings?.companyLogoPath && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={deleteLogoMutation.isPending}
                              onClick={handleDeleteLogo}
                              className="text-red-600 hover:text-red-700 hover:border-red-300 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Company Stamp */}
                    <div className="mb-6">
                      <label className="text-sm font-medium leading-none text-gray-700">Company Stamp</label>
                      <p className="text-xs text-gray-500 mt-1 mb-3">
                        Applied on PDF when &apos;Apply stamp&apos; is selected on an order. Accepts JPG, PNG, WebP — max 5 MB.
                      </p>
                      <div className="flex items-center gap-4">
                        {settings?.companyStampPath ? (
                          <img
                            src={`/api/${settings.companyStampPath}?v=${new Date(settings.updatedAt).getTime()}`}
                            alt="Company stamp"
                            className="h-14 max-w-[160px] object-contain border border-gray-200 rounded p-1 bg-white"
                          />
                        ) : (
                          <div className="h-14 w-32 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors duration-150">
                            No stamp
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            ref={stampInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handleStampChange}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadStampMutation.isPending}
                            onClick={() => stampInputRef.current?.click()}
                            className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            {uploadStampMutation.isPending ? 'Uploading…' : 'Upload Stamp'}
                          </Button>
                          {settings?.companyStampPath && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={deleteStampMutation.isPending}
                              onClick={handleDeleteStamp}
                              className="text-red-600 hover:text-red-700 hover:border-red-300 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                      <FormField control={form.control} name="companyName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl><Input placeholder="S.C. Example S.R.L." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="companyVatCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT Code (CIF)</FormLabel>
                          <FormControl><Input placeholder="RO12345678" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="companyRegNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number</FormLabel>
                          <FormControl><Input placeholder="J40/1234/2020" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="companyCounty" render={({ field }) => (
                        <FormItem>
                          <FormLabel>County / Region</FormLabel>
                          <FormControl><Input placeholder="București" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="col-span-2">
                        <FormField control={form.control} name="companyAddress" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl><Input placeholder="Str. Exemplu nr. 10, sector 1" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="companyCity" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input placeholder="București" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="companyPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <PhoneInput
                              international
                              defaultCountry="RO"
                              placeholder="+40 721 000 000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="orderNumberStart" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Number Start</FormLabel>
                          <FormControl><Input type="number" min={1} step={1} placeholder="1" {...field} /></FormControl>
                          <p className="text-xs text-gray-500 mt-1">The numbering of orders starts from this number.</p>
                          <FormMessage />
                        </FormItem>
                      )} />

                    </div>
                  </div>

                  {/* Card 2 — SMTP */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Mail className="h-4 w-4 text-gray-900" />
                        <p className="text-sm font-semibold text-gray-800">SMTP</p>
                      </div>
                      <Status status={smtpStatus.status}>
                        <StatusIndicator />
                        <StatusLabel>{smtpStatus.message}</StatusLabel>
                      </Status>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Used to send Chartering Agreements by email.
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                      <div className="col-span-2">
                        <FormField control={form.control} name="smtpEmail" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Email</FormLabel>
                            <FormControl><Input type="email" placeholder="office@example.ro" {...field} /></FormControl>
                            <p className="text-xs text-gray-500 mt-1">Used as the sender address and displayed on the Chartering Agreement PDF.</p>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="col-span-2">
                        <FormField control={form.control} name="smtpPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email account password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showSmtpPassword ? 'text' : 'password'}
                                  placeholder="••••••••••••••••"
                                  className="pr-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSmtpPassword((v) => !v)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  tabIndex={-1}
                                >
                                  {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="smtpHost" render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP host</FormLabel>
                          <FormControl><Input placeholder="smtp.gmail.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="smtpPort" render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP port</FormLabel>
                          <FormControl><Input type="number" min={1} max={65535} placeholder="587" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                    </div>

                    <div className="flex justify-end items-center gap-2 pt-4 mt-4 border-t border-gray-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearSmtp}
                        disabled={smtpSaving || updateMutation.isPending}
                        className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear Config
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveSmtp}
                        disabled={smtpSaving || updateMutation.isPending}
                        className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {smtpSaving ? 'Saving…' : 'Save Configuration'}
                      </Button>
                    </div>
                  </div>

                  <ArchiveSettingsCard form={form} />
                  <AiSettingsCard />

                  <SaveButton />
                </div>
              )}

              {/* ── BANKING ──────────────────────────────────────── */}
              {/* FOR NOW DISABLED */}

              {/* ── INVOICING ────────────────────────────────────── */}
              {activeTab === 'invoicing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                    <FormField control={form.control} name="defaultVatPercent" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default VAT %</FormLabel>
                        <FormControl><Input type="number" min={0} max={100} step={0.01} placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="defaultCurrency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Currency</FormLabel>
                        <FormControl><Input placeholder="EUR" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="defaultPaymentDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Payment Days</FormLabel>
                        <FormControl><Input type="number" min={0} placeholder="30" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                  </div>

                  <hr className="border-gray-100" />

                  <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms &amp; Conditions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the terms and conditions that will appear on page 2 of the Chartering Agreement PDF..."
                          className="min-h-[200px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">Appears on page 2 of the Chartering Agreement PDF.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <SaveButton />
                </div>
              )}

              {/* ── INTEGRATIONS ─────────────────────────────────── */}
              {/* FOR NOW DISABLED */}

            </form>
          </Form>
        </div>
      )}
    </div>
  );
}