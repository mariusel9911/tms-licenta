import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAiChat } from '@/hooks/useAiChat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ChatMessage } from './ChatMessage';

// ── Panel animation ───────────────────────────────────────────────────────────

function buildContainerVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }
  return {
    hidden: { opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', damping: 25, stiffness: 300 },
    },
    exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, error, sendMessage, cancelRequest } = useAiChat();
  const prefersReduced = useReducedMotion();
  const containerVariants = buildContainerVariants(prefersReduced);

  // Slow response indicator — show after 10s of loading
  const [showSlowHint, setShowSlowHint] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowSlowHint(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowHint(true), 10_000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      const msg = input.trim();
      setInput('');
      await sendMessage(msg);
    },
    [input, isLoading, sendMessage],
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[380px] overflow-hidden rounded-2xl border border-border/40 bg-background/60 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
          >
            {/* Header */}
            <div className="relative overflow-hidden border-b border-border/40 bg-muted/30 p-4">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 to-gray-600/10 opacity-50" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-gray-800 text-white">
                        <Sparkles className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Sparky</h3>
                    <span className="text-xs text-muted-foreground">TMS Assistant · Online</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-background/50"
                  onClick={() => {
                    cancelRequest();
                    setIsOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex h-[320px] flex-col gap-4 overflow-y-auto bg-gradient-to-b from-background/20 to-background/40 p-4">
              {/* Welcome */}
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 border border-border/40 shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary">S</AvatarFallback>
                </Avatar>
                <div className="flex max-w-[85%] flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Sparky</span>
                  <div className="rounded-2xl rounded-tl-none border border-border/20 bg-muted/50 px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm">
                    <p>
                      Hi! I'm <strong>Sparky</strong>, your TMS Assistant. Ask me anything about
                      orders, partners, vehicles, or settings — in Romanian or English!
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversation messages */}
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 border border-border/40 shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-primary">S</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-tl-none border border-border/20 bg-muted/50 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
                    </div>
                    {showSlowHint && (
                      <p className="text-[11px] text-muted-foreground/70 pl-1">
                        This is taking longer than usual…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-center text-xs text-destructive">{error}</p>}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/40 bg-background/60 p-3 backdrop-blur-md">
              <form className="flex items-center gap-2" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(e);
                  }}
                  placeholder="Message Sparky…"
                  maxLength={2000}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-border/40 bg-background/50 px-4 py-2.5 text-sm outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                />
                <Button
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="h-10 w-10 rounded-full shadow-lg transition-transform hover:scale-105"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Glowing Bot FAB ── */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggleOpen}
        aria-label={isOpen ? 'Close chat' : 'Open AI chat'}
        className={cn(
          'ai-fab-button relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-white/20 transition-transform duration-200 ease-out-expo',
          isOpen ? 'rotate-90' : 'rotate-0',
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(71,85,105,0.9) 0%, rgba(30,41,59,0.95) 100%)',
          boxShadow:
            '0 0 20px rgba(100,116,139,0.7), 0 0 40px rgba(71,85,105,0.5), 0 0 60px rgba(51,65,85,0.3)',
        }}
      >
        {/* 3D top-light sheen */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
        {/* Inner ring */}
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        {/* Icon */}
        <div className="relative z-10">
          {isOpen ? <X className="h-7 w-7 text-white" /> : <Bot className="h-7 w-7 text-white" />}
        </div>
      </motion.button>
    </div>
  );
}
