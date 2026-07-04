import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { usePartnersList } from '@/hooks/usePartners';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle } from '@/types/vehicle.types';

const schema = z.object({
  partnerId: z.coerce.number().int().min(0).optional(),
  licensePlate: z.string().min(1, 'License plate is required'),
  status: z.enum(['AVAILABLE', 'ON_ROUTE', 'MAINTENANCE', 'INACTIVE'] as const),
});

type FormValues = z.infer<typeof schema>;

interface QuickAddVehicleModalProps {
  open: boolean;
  onClose: () => void;
  transporterId?: number;
  transporterName?: string;
  onCreated: (vehicle: Vehicle) => void;
}

export function QuickAddVehicleModal({
  open,
  onClose,
  transporterId,
  onCreated,
}: QuickAddVehicleModalProps) {
  const { toast } = useToast();
  const createVehicle = useCreateVehicle();
  const { data: partnersData } = usePartnersList(1, 500);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partnerId: transporterId ?? undefined,
      licensePlate: '',
      status: 'AVAILABLE',
    },
  });

  // When the modal opens, reset with the current transporterId
  const handleClose = () => {
    form.reset({ partnerId: transporterId ?? undefined, licensePlate: '', status: 'AVAILABLE' });
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    const partnerIdToSend = values.partnerId && values.partnerId > 0 ? values.partnerId : undefined;
    try {
      const result = await createVehicle.mutateAsync({
        licensePlate: values.licensePlate,
        status: values.status,
        partnerId: partnerIdToSend,
      });
      toast({ title: `Vehicle "${result.licensePlate}" created` });
      onCreated(result);
      handleClose();
    } catch {
      toast({ title: 'Failed to create vehicle', variant: 'destructive' });
    }
  };

  const partnerOptions = (partnersData?.items ?? []).map((p) => ({
    id: p.id,
    label: p.name,
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Quick Add Vehicle</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(onSubmit)(e); }} className="space-y-3">

            {/* Partner — selectable dropdown */}
            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(val) => field.onChange(val ? Number(val) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">— No partner —</SelectItem>
                      {partnerOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* License plate */}
            <FormField
              control={form.control}
              name="licensePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License plate <span className="text-destructive">★</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. B 123 ABC" />
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={createVehicle.isPending}
              >
                {createVehicle.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
