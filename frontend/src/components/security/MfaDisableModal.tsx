import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useDisableMfa } from '@/hooks/useAuth';

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

interface MfaDisableModalProps {
  open: boolean;
  onClose: () => void;
}

export function MfaDisableModal({ open, onClose }: MfaDisableModalProps) {
  const { toast } = useToast();
  const disableMutation = useDisableMfa();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });

  const handleClose = () => {
    form.reset();
    setShowPassword(false);
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    disableMutation.mutate(values.password, {
      onSuccess: () => {
        toast({ title: 'MFA Disabled', description: 'Two-factor authentication has been removed.' });
        handleClose();
      },
      onError: (err) => {
        const code = (err as Error).message;
        if (code === 'wrong_password') {
          form.setError('password', { message: 'Incorrect password' });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to disable MFA. Please try again.',
            variant: 'destructive',
          });
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-red-600" />
            Disable Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-gray-600">
              Disabling MFA will make your account less secure. Enter your password to confirm.
            </p>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={disableMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={disableMutation.isPending}
              >
                {disableMutation.isPending ? 'Disabling…' : 'Disable MFA'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
