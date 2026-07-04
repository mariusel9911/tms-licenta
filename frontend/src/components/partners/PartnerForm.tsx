import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Button } from '@/components/ui/button';
import { CountryDropdown } from '@/components/ui/country-dropdown';
import { ViesLookup } from './ViesLookup';
import { useCreatePartner, useUpdatePartner } from '@/hooks/usePartners';
import { useToast } from '@/hooks/use-toast';
import { countries } from 'country-data-list';
import type { Partner, ViesResult } from '@/types/partner.types';

const schema = z.object({
  partnerType: z.enum(['CLIENT', 'TRANSPORTER', 'BOTH'] as const, {
    required_error: 'Partner type is required',
  }),
  fiscalCode: z.string().min(1, 'Fiscal code is required'),
  name: z.string().min(1, 'Name is required'),
  country: z.string().min(1, 'Country is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  // Optional fields
  registrationNumber: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  paymentTermDays: z.coerce.number().int().min(0).optional(),
  pricePerKm: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface PartnerFormProps {
  partner?: Partner;
  onClose: () => void;
}

const EMPTY_DEFAULTS: FormValues = {
  partnerType: undefined as unknown as 'CLIENT',
  fiscalCode: '',
  name: '',
  country: '',
  addressLine1: '',
  phone: '+40',
  email: '',
  contactPerson: '',
  registrationNumber: '',
  addressLine2: '',
  city: '',
  zipCode: '',
  paymentTermDays: undefined,
  pricePerKm: undefined,
};

function toFormValues(partner: Partner): FormValues {
  return {
    partnerType: partner.partnerType,
    fiscalCode: partner.fiscalCode ?? '',
    name: partner.name,
    country: partner.country,
    addressLine1: partner.addressLine1 ?? '',
    phone: partner.phone || '+40',
    email: partner.email ?? '',
    contactPerson: partner.contactPerson ?? '',
    registrationNumber: partner.registrationNumber ?? '',
    addressLine2: partner.addressLine2 ?? '',
    city: partner.city ?? '',
    zipCode: partner.zipCode ?? '',
    paymentTermDays: partner.paymentTermDays ?? undefined,
    pricePerKm: partner.pricePerKm ? Number(partner.pricePerKm) : undefined,
  };
}

export function PartnerForm({ partner, onClose }: PartnerFormProps) {
  const { toast } = useToast();
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const isEditing = partner !== undefined;
  const isPending = isEditing ? updatePartner.isPending : createPartner.isPending;
  const [viesLocked, setViesLocked] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: partner ? toFormValues(partner) : EMPTY_DEFAULTS,
  });

  useEffect(() => {
    const values = partner ? toFormValues(partner) : EMPTY_DEFAULTS;
    form.reset(values);
    setViesLocked(false);
  }, [partner]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViesResult = (result: ViesResult) => {
    form.setValue('name', result.name, { shouldValidate: true });
    form.setValue('addressLine1', result.address, { shouldValidate: true });
    // Extract country from first 2 chars of the fiscal code via country-data-list
    const vatCode = form.getValues('fiscalCode') ?? '';
    const alpha2 = vatCode.slice(0, 2).toUpperCase();
    const found = countries.all.find((c) => c.alpha2 === alpha2 && c.status === 'assigned');
    if (found) {
      form.setValue('country', found.name, { shouldValidate: true });
      setViesLocked(true);
    }
  };

  const onSubmit = async (values: FormValues) => {
    // Strip empty optional strings before sending
    const payload = {
      ...values,
      registrationNumber: values.registrationNumber || undefined,
      addressLine2: values.addressLine2 || undefined,
      city: values.city || undefined,
      zipCode: values.zipCode || undefined,
    };

    try {
      if (isEditing) {
        await updatePartner.mutateAsync({ id: partner.id, dto: payload });
        toast({ title: 'Partner updated successfully' });
      } else {
        await createPartner.mutateAsync(payload);
        toast({ title: 'Partner created successfully' });
      }
      onClose();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data.error as string)
          : isEditing
            ? 'Failed to update partner'
            : 'Failed to create partner';
      toast({ title: message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-lg">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="px-8 pt-8">
            <p className="text-xs text-muted-foreground text-right mb-4">* Required fields</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0">

              {/* ── Left column: Partner Details ── */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
                  Partner Details
                </h3>

                {/* Partner Type */}
                <FormField
                  control={form.control}
                  name="partnerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partner Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CLIENT">Client</SelectItem>
                          <SelectItem value="TRANSPORTER">Transporter</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fiscal Code + VIES */}
                <FormField
                  control={form.control}
                  name="fiscalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal code *</FormLabel>
                      <FormControl>
                        <ViesLookup
                          vatValue={field.value ?? ''}
                          onVatChange={(val) => {
                            field.onChange(val);
                            setViesLocked(false);
                          }}
                          onResult={handleViesResult}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Partner Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partner name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Partner name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <CountryDropdown
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select country"
                          disabled={viesLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address */}
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="Address line 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <PhoneInput
                          international
                          defaultCountry="RO"
                          placeholder="+40 757 249 331"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contact Person */}
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact person *</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Right column: Commercial Relations ── */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
                  Commercial Relations
                </h3>

                {/* Price/km */}
                <FormField
                  control={form.control}
                  name="pricePerKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price / km</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            className="flex-1"
                            {...field}
                            value={field.value ?? ''}
                          />
                          <span className="text-sm text-muted-foreground shrink-0">EUR / km</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Term */}
                <FormField
                  control={form.control}
                  name="paymentTermDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment term</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            className="w-32"
                            {...field}
                            value={field.value ?? ''}
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Registration Number */}
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. J02/1234/2020" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address Line 2 */}
                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Building, floor, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* City */}
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Zip Code */}
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip / postal code</FormLabel>
                      <FormControl>
                        <Input placeholder="Postal code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </div>
          </div>

          {/* ─── Footer ─── */}
          <div className="px-8 pb-8 flex justify-end gap-3 border-t mt-8 pt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Partner'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
