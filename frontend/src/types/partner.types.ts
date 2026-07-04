export type PartnerType = 'CLIENT' | 'TRANSPORTER' | 'BOTH';

export interface Partner {
  id: number;
  partnerType: PartnerType;
  fiscalCode: string;
  registrationNumber?: string | null;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  zipCode?: string | null;
  country: string;
  phone: string;
  email: string;
  contactPerson: string | null;
  pricePerKm?: string | null; // Prisma Decimal comes as string over JSON
  paymentTermDays?: number | null;
  delegateName?: string | null;
  poReference?: string | null;
  specialConditions?: string | null;
  additionalHeader?: string | null;
  bankName?: string | null;
  iban?: string | null;
  receiveAllSms: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPartners {
  items: Partner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ViesResult {
  name: string;
  address: string;
}

export interface CreatePartnerDto {
  partnerType: PartnerType;
  fiscalCode: string;
  name: string;
  country: string;
  addressLine1: string;
  phone: string;
  email: string;
  contactPerson: string;
  // Optional fields
  registrationNumber?: string;
  addressLine2?: string;
  city?: string;
  zipCode?: string;
  pricePerKm?: number;
  paymentTermDays?: number;
  delegateName?: string;
  poReference?: string;
  specialConditions?: string;
  additionalHeader?: string;
  bankName?: string;
  iban?: string;
  receiveAllSms?: boolean;
}

export type UpdatePartnerDto = Partial<CreatePartnerDto>;
