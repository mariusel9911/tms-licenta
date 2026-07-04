import type { ReactNode } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types/ai.types';

// ── Inline markdown: **bold**, *italic*, `code` ──────────────────────────────

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ── Block renderer ────────────────────────────────────────────────────────────

function renderContent(text: string): ReactNode {
  // Split on \n or \r\n (Ollama may return either)
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let ulItems: string[] = [];
  let olItems: string[] = [];

  const flushUl = () => {
    if (!ulItems.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-1 list-disc space-y-0.5 pl-4">
        {ulItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </ul>,
    );
    ulItems = [];
  };

  const flushOl = () => {
    if (!olItems.length) return;
    nodes.push(
      <ol key={`ol-${nodes.length}`} className="my-1 list-decimal space-y-0.5 pl-4">
        {olItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </ol>,
    );
    olItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    // trimStart() handles indented list items like "   * item" or "   1. item"
    const t = lines[i].trimStart();

    // Ordered list: "1. " or "1) "
    const olMatch = t.match(/^\d+[.)]\s+(.+)/);
    if (olMatch) { flushUl(); olItems.push(olMatch[1].trim()); continue; }

    // Unordered list: "- ", "* ", "+ ", "• "
    const ulMatch = t.match(/^[-*+•]\s+(.+)/);
    if (ulMatch) { flushOl(); ulItems.push(ulMatch[1].trim()); continue; }

    flushUl(); flushOl();

    if (t === '') {
      if (i > 0 && lines[i - 1].trim() !== '') {
        nodes.push(<div key={`sp-${nodes.length}`} className="h-1" />);
      }
    } else {
      nodes.push(
        <p key={`p-${nodes.length}`} className="leading-relaxed">{renderInline(t)}</p>,
      );
    }
  }
  flushUl(); flushOl();
  return nodes;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse self-end')}>
      <Avatar className="h-8 w-8 border border-border/40 shadow-sm">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {isUser ? 'ME' : 'S'}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
          isUser
            ? 'rounded-tr-none bg-primary text-primary-foreground'
            : 'rounded-tl-none border border-border/20 bg-muted/50 backdrop-blur-sm',
        )}
      >
        <div className="space-y-0.5">{renderContent(message.content)}</div>
      </div>
    </div>
  );
}
