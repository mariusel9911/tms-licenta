import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value?: string;
  className?: string;
}

function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      if (value) await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard write failed silently
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={copied}
      onClick={handleCopy}
      className={cn(
        'relative h-7 gap-1.5 text-xs transition-all duration-100 active:scale-[0.97] disabled:opacity-100',
        className,
      )}
    >
      <span className={cn('transition-all', copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0')}>
        <CheckIcon size={14} className="stroke-green-600" />
      </span>
      <span className={cn('absolute left-3 transition-all', copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100')}>
        <CopyIcon size={14} />
      </span>
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

CopyButton.displayName = 'CopyButton';

export { CopyButton };
export type { CopyButtonProps };
