import { z } from 'zod';

export const CreatePartnerDto = z.object({
  partnerType: z.enum(['CLIENT', 'TRANSPORTER', 'BOTH'] as const),
  // Required fields (client-confirmed)
  fiscalCode: z.string().min(1, 'Fiscal code is required').max(20),
  name: z.string().min(1, 'Name is required').max(200),
  country: z.string().min(1, 'Country is required').max(100),
  addressLine1: z.string().min(1, 'Address is required').max(300),
  phone: z.string().min(1, 'Phone is required').max(30),
  email: z.email('Invalid email'),
  contactPerson: z.string().min(1, 'Contact person is required').max(200),
  // Optional fields
  registrationNumber: z.string().max(50).optional(),
  addressLine2: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  pricePerKm: z.number().min(0).optional(),
  paymentTermDays: z.number().int().min(0).optional(),
  delegateName: z.string().max(200).optional(),
  poReference: z.string().max(100).optional(),
  specialConditions: z.string().max(2000).optional(),
  additionalHeader: z.string().max(500).optional(),
  bankName: z.string().max(200).optional(),
  iban: z.string().max(34).optional(),
  receiveAllSms: z.boolean().optional().default(false),
});

export type CreatePartnerDtoType = z.infer<typeof CreatePartnerDto>;

export const UpdatePartnerDto = CreatePartnerDto.partial();

export type UpdatePartnerDtoType = z.infer<typeof UpdatePartnerDto>;

export const FindAllPartnersDto = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  search: z.string().max(200).optional(),
  partnerType: z.enum(['CLIENT', 'TRANSPORTER', 'BOTH'] as const).optional(),
});

export type FindAllPartnersDtoType = z.infer<typeof FindAllPartnersDto>;
