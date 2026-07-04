import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useViesLookup } from '@/hooks/usePartners';
import type { ViesResult } from '@/types/partner.types';

interface ViesLookupProps {
  vatValue: string;
  onVatChange: (val: string) => void;
  onResult: (data: ViesResult) => void;
}

export function ViesLookup({ vatValue, onVatChange, onResult }: ViesLookupProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const viesLookup = useViesLookup();

  const handleLookup = async () => {
    setFeedback(null);
    if (!vatValue || vatValue.length < 3) {
      setFeedback('Enter a valid EU VAT number (e.g. RO35813871)');
      return;
    }

    const result = await viesLookup.mutateAsync(vatValue).catch(() => null);

    if (result) {
      setFeedback('Yes, valid VAT number.');
      onResult(result);
    } else {
      setFeedback('VAT number not found or VIES is unavailable.');
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder="Fiscal code (e.g. RO35813871)"
          value={vatValue}
          onChange={(e) => {
            onVatChange(e.target.value);
            setFeedback(null);
          }}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleLookup}
          disabled={viesLookup.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          {viesLookup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Get info from Vies'
          )}
        </Button>
      </div>
      {feedback && (
        <p
          className={
            feedback.startsWith('Yes')
              ? 'text-sm text-green-600'
              : 'text-sm text-red-500'
          }
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
