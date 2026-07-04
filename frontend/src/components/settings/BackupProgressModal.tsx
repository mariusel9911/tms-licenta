import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';
import type { BackupStorage } from '@/types/backup.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface Step {
  id:    string;
  label: string;
}

export interface BackupProgressModalProps {
  open:          boolean;
  mode:          'backup' | 'restore';
  /** For backup mode — controls whether "Upload to remote" step is shown */
  destination?:  BackupStorage;
  /** For restore mode — controls whether "Downloading from remote" step is shown */
  isRemoteOnly?: boolean;
  /** The in-flight API promise. Must be stable for the duration of the operation. */
  apiPromise:    Promise<unknown> | null;
  onComplete:    () => void;
  onError:       (message: string) => void;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

function buildBackupSteps(destination: BackupStorage): Step[] {
  const steps: Step[] = [
    { id: 'init',     label: 'Initializing...' },
    { id: 'connect',  label: 'Connecting to database...' },
    { id: 'dump',     label: 'Dumping tables...' },
    { id: 'compress', label: 'Compressing backup...' },
    { id: 'save',     label: 'Saving backup file...' },
  ];
  if (destination === 'remote' || destination === 'both') {
    steps.push({ id: 'upload', label: 'Uploading to remote storage...' });
  }
  return steps;
}

function buildRestoreSteps(isRemoteOnly: boolean): Step[] {
  const steps: Step[] = [{ id: 'init', label: 'Initializing restore...' }];
  if (isRemoteOnly) steps.push({ id: 'download', label: 'Downloading from remote storage...' });
  steps.push(
    { id: 'decompress', label: 'Decompressing backup...' },
    { id: 'restore',    label: 'Restoring database...' },
    { id: 'verify',     label: 'Verifying integrity...' },
  );
  return steps;
}

// Auto-advance duration per step id (ms)
const STEP_MS: Record<string, number> = {
  init: 350, connect: 450, compress: 400,
  save: 300, upload: 500, download: 600,
  decompress: 400, verify: 450,
};

// The step id that blocks until apiPromise resolves
const HEAVY: Record<'backup' | 'restore', string> = { backup: 'dump', restore: 'restore' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
        strokeDasharray="20 60" strokeLinecap="round" />
    </svg>
  );
}

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 py-1"
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {status === 'done' && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100"
          >
            <Check className="h-3 w-3 text-green-600" strokeWidth={3} />
          </motion.span>
        )}
        {status === 'active' && <Spinner />}
        {status === 'error' && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100">
            <X className="h-3 w-3 text-red-600" strokeWidth={3} />
          </span>
        )}
        {status === 'pending' && (
          <span className="w-4 h-4 rounded-full border-2 border-gray-200" />
        )}
      </span>

      <span className={`text-sm ${
        status === 'done'   ? 'text-gray-400 line-through decoration-gray-300' :
        status === 'active' ? 'text-gray-900 font-medium' :
        status === 'error'  ? 'text-red-600 font-medium' :
        'text-gray-400'
      }`}>
        {label}
      </span>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BackupProgressModal({
  open,
  mode,
  destination = 'both',
  isRemoteOnly = false,
  apiPromise,
  onComplete,
  onError,
}: BackupProgressModalProps) {
  const steps = mode === 'backup'
    ? buildBackupSteps(destination)
    : buildRestoreSteps(isRemoteOnly);

  // Render state
  const [activeIdx, setActiveIdx] = useState(0);
  const [finished,  setFinished]  = useState(false);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [pct,       setPct]       = useState(0);

  // Mutable refs — safe to read inside timer callbacks
  const resolvedRef = useRef(false);
  const errorRef    = useRef<string | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset on open
  useEffect(() => {
    if (!open) return;
    resolvedRef.current = false;
    errorRef.current    = null;
    setActiveIdx(0);
    setFinished(false);
    setErrMsg(null);
    setPct(0);
  }, [open, apiPromise]); // re-run when a new promise arrives

  // Attach to apiPromise
  useEffect(() => {
    if (!open || !apiPromise) return;
    apiPromise
      .then(()              => { resolvedRef.current = true; })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Operation failed';
        errorRef.current    = msg;
        resolvedRef.current = true;
      });
  }, [open, apiPromise]);

  // Step-advancement engine
  useEffect(() => {
    if (!open) return;

    const heavyId    = HEAVY[mode];
    let   currentIdx = 0;

    function tick() {
      // Error during heavy step — show error state, then report to parent after animation
      if (errorRef.current !== null) {
        setErrMsg(errorRef.current);
        timerRef.current = setTimeout(() => onError(errorRef.current!), 800);
        return;
      }

      const step = steps[currentIdx];

      // If this is the heavy step, poll until resolved
      if (step?.id === heavyId && !resolvedRef.current) {
        // Slow-drip the bar up to ~65% while waiting
        setPct((p) => Math.min(p + 1.5, 65));
        timerRef.current = setTimeout(tick, 180);
        return;
      }

      // Mark current step done, move to next
      const nextIdx = currentIdx + 1;
      currentIdx = nextIdx;
      setActiveIdx(nextIdx);
      setPct(Math.round((nextIdx / steps.length) * 100));

      if (nextIdx >= steps.length) {
        setFinished(true);
        timerRef.current = setTimeout(() => onComplete(), 700);
        return;
      }

      const delay = STEP_MS[steps[nextIdx]?.id ?? ''] ?? 400;
      timerRef.current = setTimeout(tick, delay);
    }

    // Kick off after the first step's duration
    const firstDelay = STEP_MS[steps[0]?.id ?? ''] ?? 400;
    timerRef.current = setTimeout(tick, firstDelay);

    return clearTimer;
  // steps array identity changes when mode/destination/isRemoteOnly change,
  // but we only want this to run when open/apiPromise change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apiPromise]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                errMsg   ? 'bg-red-100'   :
                finished ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                {errMsg ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : finished ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Check className="h-5 w-5 text-green-600" strokeWidth={2.5} />
                  </motion.span>
                ) : (
                  <Spinner />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {mode === 'backup' ? 'Creating Backup' : 'Restoring Database'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {errMsg   ? 'An error occurred'       :
                   finished ? 'Completed successfully'  : 'Please wait…'}
                </p>
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-0.5">
              {steps.map((step, idx) => {
                let status: StepStatus = 'pending';
                if (errMsg && idx === activeIdx)  status = 'error';
                else if (idx < activeIdx)         status = 'done';
                else if (idx === activeIdx)       status = 'active';
                return <StepRow key={step.id} label={step.label} status={status} />;
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${errMsg ? 'bg-red-500' : finished ? 'bg-green-500' : 'bg-blue-500'}`}
                  animate={{ width: `${errMsg ? Math.round(activeIdx / steps.length * 100) : pct}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              <p className="text-right text-xs text-gray-400 tabular-nums">
                {errMsg ? 'Failed' : finished ? '100%' : `${pct}%`}
              </p>
            </div>

            {/* Error details */}
            {errMsg && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-md p-3"
              >
                <p className="text-xs text-red-700 font-mono break-all">{errMsg}</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
