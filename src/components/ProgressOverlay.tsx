import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { GenerationState } from '../types';

interface ProgressOverlayProps {
  state: GenerationState;
}

export default function ProgressOverlay({ state }: ProgressOverlayProps) {
  const { stage, progress, message, error } = state;

  if (stage === 'idle' || stage === 'completed') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="glass-panel rounded-3xl p-8 w-full max-w-sm mx-4 text-center"
      >
        {stage === 'error' ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4"
            >
              <AlertCircle className="w-8 h-8 text-red-400" />
            </motion.div>
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              Generation Failed
            </h3>
            <p className="text-sm text-surface-200/60">{error}</p>
          </>
        ) : (
          <>
            {/* Pulsing loader orb */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/20 blur-xl"
              />
              <motion.div
                animate={{
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-2 rounded-full bg-gradient-to-br from-primary-600/40 to-accent-600/30 blur-md"
              />
              <div className="absolute inset-4 rounded-full bg-surface-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-surface-200/50 uppercase tracking-wider font-medium">
                  {stage === 'uploading'
                    ? 'Uploading'
                    : stage === 'processing'
                      ? 'Processing'
                      : 'Generating'}
                </span>
                <span className="text-sm font-mono font-bold text-primary-400">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full progress-shimmer"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>

            <motion.p
              key={message}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-surface-200/70"
            >
              {message}
            </motion.p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export function CompletionBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium"
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
      Model Ready
    </motion.div>
  );
}
