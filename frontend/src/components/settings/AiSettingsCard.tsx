import { useState } from 'react';
import { Bot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function ToggleRow({ label, description, checked, disabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-green-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function AiSettingsCard() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  // Local state for immediate toggle feedback (reverts on failure)
  const [chatbotLocal, setChatbotLocal] = useState<boolean | null>(null);
  const [predictionLocal, setPredictionLocal] = useState<boolean | null>(null);

  const chatbotEnabled = chatbotLocal ?? settings?.aiChatbotEnabled ?? true;
  const predictionEnabled = predictionLocal ?? settings?.aiPredictionEnabled ?? true;

  const handleToggleChatbot = async () => {
    const newValue = !chatbotEnabled;
    setChatbotLocal(newValue);
    try {
      await updateMutation.mutateAsync({ aiChatbotEnabled: newValue });
      toast({ title: newValue ? 'AI Chatbot enabled' : 'AI Chatbot disabled' });
    } catch {
      setChatbotLocal(null);
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleTogglePrediction = async () => {
    const newValue = !predictionEnabled;
    setPredictionLocal(newValue);
    try {
      await updateMutation.mutateAsync({ aiPredictionEnabled: newValue });
      toast({ title: newValue ? 'AI Predictions enabled' : 'AI Predictions disabled' });
    } catch {
      setPredictionLocal(null);
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-72 mb-5" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-1">
        <Bot className="h-4 w-4 text-gray-900" />
        <p className="text-sm font-semibold text-gray-800">AI Features</p>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Control AI-powered features globally. Changes take effect immediately for all users.
      </p>

      <div className="space-y-4">
        <ToggleRow
          label="AI Chatbot"
          description={chatbotEnabled ? 'Sparky assistant is available to all users' : 'Chatbot is hidden for all users'}
          checked={chatbotEnabled}
          disabled={updateMutation.isPending}
          onToggle={() => { void handleToggleChatbot(); }}
        />
        <ToggleRow
          label="AI Prediction Model"
          description={predictionEnabled ? 'Profit predictions visible in Statistics' : 'AI Forecast section hidden in Statistics'}
          checked={predictionEnabled}
          disabled={updateMutation.isPending}
          onToggle={() => { void handleTogglePrediction(); }}
        />
      </div>
    </div>
  );
}
