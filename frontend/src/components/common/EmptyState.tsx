import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <Inbox className="mb-4 h-12 w-12 text-gray-300" />
      <h3 className="mb-1 text-base font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
