import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCreateVehicle, useUpdateVehicle } from '@/hooks/useVehicles';
import { usePartnersList } from '@/hooks/usePartners';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle } from '@/types/vehicle.types';

const EMISSIONS_OPTIONS = [
  'Non Euro',
  'Euro 1',
  'Euro 2',
  'Euro 3',
  'Euro 4',
  'Euro 5',
  'Euro 6',
  'Euro 7',
] as const;

const schema = z.object({
  licensePlate: z.string().min(1, 'License plate is required'),
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  yearOfManufacture: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal('')),
  emissionsStandard: z.string().optional(),
  axles: z.coerce.number().int().min(1).optional().or(z.literal('')),
  category: z.string().optional(),
  fuelType: z.enum(['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID', 'LPG', 'CNG'] as const).optional(),
  tankCapacityLitres: z.coerce.number().min(0).optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'ON_ROUTE', 'MAINTENANCE', 'INACTIVE'] as const).optional(),
  notes: z.string().optional(),
  partnerId: z.coerce.number().int().optional().or(z.literal('')),
  // Right column — loading capacity & consumption
  lengthCm: z.coerce.number().min(0).optional().or(z.literal('')),
  widthCm: z.coerce.number().min(0).optional().or(z.literal('')),
  heightCm: z.coerce.number().min(0).optional().or(z.literal('')),
  maxLoadingCapacityKg: z.coerce.number().min(0).optional().or(z.literal('')),
  consumptionRecording: z.enum(['MANUAL', 'AUTOMATIC'] as const).optional(),
  consumptionPer100km: z.coerce.number().min(0).optional().or(z.literal('')),
  ratePerKm: z.coerce.number().min(0).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface VehicleFormProps {
  vehicle?: Vehicle;
  onClose: () => void;
}

const EMPTY_DEFAULTS: FormValues = {
  licensePlate: '',
  vin: '',
  make: '',
  model: '',
  yearOfManufacture: '',
  emissionsStandard: '',
  axles: '',
  category: '',
  fuelType: undefined,
  tankCapacityLitres: '',
  status: 'AVAILABLE',
  notes: '',
  partnerId: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  maxLoadingCapacityKg: '',
  consumptionRecording: undefined,
  consumptionPer100km: '',
  ratePerKm: '',
};

function toFormValues(vehicle: Vehicle): FormValues {
  return {
    licensePlate: vehicle.licensePlate,
    vin: vehicle.vin ?? '',
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    yearOfManufacture: vehicle.yearOfManufacture ?? '',
    emissionsStandard: vehicle.emissionsStandard ?? '',
    axles: vehicle.axles ?? '',
    category: vehicle.category ?? '',
    fuelType: vehicle.fuelType ?? undefined,
    tankCapacityLitres: vehicle.tankCapacityLitres ? Number(vehicle.tankCapacityLitres) : '',
    status: vehicle.status,
    notes: vehicle.notes ?? '',
    partnerId: vehicle.partnerId ?? '',
    lengthCm: vehicle.lengthCm ? Number(vehicle.lengthCm) : '',
    widthCm: vehicle.widthCm ? Number(vehicle.widthCm) : '',
    heightCm: vehicle.heightCm ? Number(vehicle.heightCm) : '',
    maxLoadingCapacityKg: vehicle.maxLoadingCapacityKg ? Number(vehicle.maxLoadingCapacityKg) : '',
    consumptionRecording: vehicle.consumptionRecording ?? undefined,
    consumptionPer100km: vehicle.consumptionPer100km ? Number(vehicle.consumptionPer100km) : '',
    ratePerKm: vehicle.ratePerKm ? Number(vehicle.ratePerKm) : '',
  };
}

export function VehicleForm({ vehicle, onClose }: VehicleFormProps) {
  const { toast } = useToast();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const isEditing = vehicle !== undefined;
  const isPending = isEditing ? updateVehicle.isPending : createVehicle.isPending;
  const [partnerOpen, setPartnerOpen] = useState(false);

  const { data: partnersData } = usePartnersList(1, 200);
  const partners = partnersData?.items ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: vehicle ? toFormValues(vehicle) : EMPTY_DEFAULTS,
  });

  useEffect(() => {
    const values = vehicle ? toFormValues(vehicle) : EMPTY_DEFAULTS;
    form.reset(values);
  }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values: FormValues) => {
    // Build the payload: strip empty strings, only send defined values
    const payload = {
      licensePlate: values.licensePlate,
      ...(values.vin ? { vin: values.vin } : {}),
      ...(values.make ? { make: values.make } : {}),
      ...(values.model ? { model: values.model } : {}),
      ...(values.yearOfManufacture !== '' && values.yearOfManufacture !== undefined ? { yearOfManufacture: Number(values.yearOfManufacture) } : {}),
      ...(values.emissionsStandard ? { emissionsStandard: values.emissionsStandard } : {}),
      ...(values.axles !== '' && values.axles !== undefined ? { axles: Number(values.axles) } : {}),
      ...(values.category ? { category: values.category } : {}),
      ...(values.fuelType ? { fuelType: values.fuelType } : {}),
      ...(values.tankCapacityLitres !== '' && values.tankCapacityLitres !== undefined ? { tankCapacityLitres: Number(values.tankCapacityLitres) } : {}),
      ...(values.status ? { status: values.status } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
      ...(values.partnerId && Number(values.partnerId) > 0 ? { partnerId: Number(values.partnerId) } : {}),
      ...(values.lengthCm !== '' && values.lengthCm !== undefined ? { lengthCm: Number(values.lengthCm) } : {}),
      ...(values.widthCm !== '' && values.widthCm !== undefined ? { widthCm: Number(values.widthCm) } : {}),
      ...(values.heightCm !== '' && values.heightCm !== undefined ? { heightCm: Number(values.heightCm) } : {}),
      ...(values.maxLoadingCapacityKg !== '' && values.maxLoadingCapacityKg !== undefined ? { maxLoadingCapacityKg: Number(values.maxLoadingCapacityKg) } : {}),
      ...(values.consumptionRecording ? { consumptionRecording: values.consumptionRecording } : {}),
      ...(values.consumptionPer100km !== '' && values.consumptionPer100km !== undefined ? { consumptionPer100km: Number(values.consumptionPer100km) } : {}),
      ...(values.ratePerKm !== '' && values.ratePerKm !== undefined ? { ratePerKm: Number(values.ratePerKm) } : {}),
    };

    try {
      if (isEditing) {
        await updateVehicle.mutateAsync({ id: vehicle.id, dto: payload });
        toast({ title: 'Vehicle updated successfully' });
      } else {
        await createVehicle.mutateAsync(payload);
        toast({ title: 'Vehicle created successfully' });
      }
      onClose();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data.error as string)
          : isEditing
            ? 'Failed to update vehicle'
            : 'Failed to create vehicle';
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

              {/* ── Left column: Vehicle Details ── */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
                  Vehicle Details
                </h3>

                {/* License Plate */}
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. B 123 TMS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? 'AVAILABLE'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AVAILABLE">Available</SelectItem>
                          <SelectItem value="ON_ROUTE">On Route</SelectItem>
                          <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Make */}
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Mercedes, Volvo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Model */}
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Actros, FH" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* VIN */}
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Identification Number</FormLabel>
                      <FormControl>
                        <Input placeholder="VIN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Emissions Standard */}
                <FormField
                  control={form.control}
                  name="emissionsStandard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emissions Standard</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select standard" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMISSIONS_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Axles */}
                <FormField
                  control={form.control}
                  name="axles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Axles</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 3"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Year of Manufacture */}
                <FormField
                  control={form.control}
                  name="yearOfManufacture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Manufacture</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1900}
                          max={2100}
                          placeholder="e.g. 2020"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Vehicle category" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional notes..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Right column: Loading Capacity & Consumption ── */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
                  Loading Capacity and Consumption
                </h3>

                {/* Partner — searchable combobox */}
                <FormField
                  control={form.control}
                  name="partnerId"
                  render={({ field }) => {
                    const selectedPartner = partners.find(
                      (p) => p.id === (field.value !== '' && field.value !== undefined ? Number(field.value) : undefined)
                    );
                    return (
                      <FormItem>
                        <FormLabel>Partner</FormLabel>
                        <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={partnerOpen}
                                className="w-full justify-between font-normal"
                              >
                                {selectedPartner ? (
                                  <span>{selectedPartner.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Select partner</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search partner..." />
                              <CommandList>
                                <CommandEmpty>No partner found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none__"
                                    onSelect={() => {
                                      field.onChange('');
                                      setPartnerOpen(false);
                                    }}
                                  >
                                    — None —
                                    <Check
                                      className={cn(
                                        'ml-auto h-4 w-4',
                                        field.value === '' || field.value === undefined ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                  </CommandItem>
                                  {partners.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        field.onChange(p.id);
                                        setPartnerOpen(false);
                                      }}
                                    >
                                      {p.name}
                                      <Check
                                        className={cn(
                                          'ml-auto h-4 w-4',
                                          Number(field.value) === p.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Dimensions: Length */}
                <FormField
                  control={form.control}
                  name="lengthCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dimensions: Length (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dimensions: Width */}
                <FormField
                  control={form.control}
                  name="widthCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dimensions: Width (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dimensions: Height */}
                <FormField
                  control={form.control}
                  name="heightCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dimensions: Height (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Max Loading Capacity */}
                <FormField
                  control={form.control}
                  name="maxLoadingCapacityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Loading Capacity (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fuel Type */}
                <FormField
                  control={form.control}
                  name="fuelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fuel type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DIESEL">Diesel</SelectItem>
                          <SelectItem value="PETROL">Petrol</SelectItem>
                          <SelectItem value="ELECTRIC">Electric</SelectItem>
                          <SelectItem value="HYBRID">Hybrid</SelectItem>
                          <SelectItem value="LPG">LPG</SelectItem>
                          <SelectItem value="CNG">CNG</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tank Capacity */}
                <FormField
                  control={form.control}
                  name="tankCapacityLitres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tank Capacity (litres)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Consumption Recording */}
                <FormField
                  control={form.control}
                  name="consumptionRecording"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumption recording</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MANUAL">Manual</SelectItem>
                          <SelectItem value="AUTOMATIC">Automatic</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Consumption per 100km */}
                <FormField
                  control={form.control}
                  name="consumptionPer100km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumption (l/100km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          placeholder="0.0"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rate per km */}
                <FormField
                  control={form.control}
                  name="ratePerKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate per Kilometer</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            placeholder="0.0000"
                            className="flex-1"
                            {...field}
                            value={field.value ?? ''}
                          />
                          <span className="text-sm text-muted-foreground shrink-0">EUR</span>
                        </div>
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
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Vehicle'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
