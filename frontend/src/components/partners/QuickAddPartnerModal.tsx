import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { countries } from 'country-data-list';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { CountryDropdown } from '@/components/ui/country-dropdown';
import { PhoneInput } from '@/components/ui/phone-input';
import { ViesLookup } from './ViesLookup';
import { useCreatePartner } from '@/hooks/usePartners';
import { useToast } from '@/hooks/use-toast';
import type { Partner, PartnerType, ViesResult } from '@/types/partner.types';

const schema = z.object({
  country: z.string().min(1, 'Country is required'),
  fiscalCode: z.string().min(1, 'Fiscal code is required'),
  name: z.string().min(1, 'Name is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  paymentTermDays: z.coerce.number().int().min(0).optional(),
  pricePerKm: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface QuickAddPartnerModalProps {
  open: boolean;
  onClose: () => void;
  defaultPartnerType?: PartnerType;
  onCreated: (partner: Partner) => void;
}

const EMPTY_DEFAULTS: FormValues = {
  country: '',
  fiscalCode: '',
  name: '',
  addressLine1: '',
  phone: '+40',
  email: '',
  paymentTermDays: undefined,
  pricePerKm: undefined,
};

export function QuickAddPartnerModal({
  open,
  onClose,
  defaultPartnerType = 'TRANSPORTER',
  onCreated,
}: QuickAddPartnerModalProps) {
  const { toast } = useToast();
  const createPartner = useCreatePartner();
  const [fiscalCode, setFiscalCode] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const handleViesResult = (result: ViesResult) => {
    form.setValue('name', result.name, { shouldValidate: true });
    form.setValue('addressLine1', result.address, { shouldValidate: true });
    const alpha2 = fiscalCode.slice(0, 2).toUpperCase();
    const found = countries.all.find((c) => c.alpha2 === alpha2 && c.status === 'assigned');
    if (found) {
      form.setValue('country', found.name, { shouldValidate: true });
    }
  };

  const handleClose = () => {
    form.reset(EMPTY_DEFAULTS);
    setFiscalCode('');
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createPartner.mutateAsync({
        partnerType: defaultPartnerType,
        fiscalCode: values.fiscalCode,
        name: values.name,
        country: values.country,
        addressLine1: values.addressLine1,
        phone: values.phone,
        email: values.email,
        contactPerson: values.name, // silently default to name
        paymentTermDays: values.paymentTermDays,
        pricePerKm: values.pricePerKm,
      });
      toast({ title: `Partner "${result.name}" created` });
      onCreated(result);
      handleClose();
    } catch {
      toast({ title: 'Failed to create partner', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Quick Add Partner</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(onSubmit)(e); }} className="space-y-3">

            {/* Country */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <CountryDropdown value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fiscal code + VIES */}
            <FormField
              control={form.control}
              name="fiscalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiscal code <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <ViesLookup
                      vatValue={field.value}
                      onVatChange={(val) => {
                        field.onChange(val);
                        setFiscalCode(val);
                      }}
                      onResult={handleViesResult}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Company name" />
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
                  <FormLabel>Address <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Street address" />
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
                  <FormLabel>Phone <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <PhoneInput
                      international
                      defaultCountry="RO"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="+40 757 000 000"
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
                  <FormLabel>Email <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contact@company.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment term + Price/km — two columns */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="paymentTermDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment term</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1">
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          placeholder="0"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">Days</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pricePerKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price/km</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={createPartner.isPending}
              >
                {createPartner.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Submit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
