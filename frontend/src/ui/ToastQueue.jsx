import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUIStore } from './uiStore';

const variantColors = {
  success: 'var(--status-green)',
  error: 'var(--status-red)',
  info: 'var(--folder-blue-deep)',
};

const variantLabels = {
  success: 'OK',
  error: 'ERR',
  info: 'INFO',
};

/**
 * ToastQueue — transient confirmations stacked bottom-right, auto-dismissing
 * after 3.4s. Announced politely so screen readers hear the outcome of an
 * action they cannot see.
 */
export function ToastQueue() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <div aria-live="polite" aria-atomic="false">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3400);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const variant = toast.variant ?? 'info';
  const color = variantColors[variant] ?? variantColors.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="pointer-events-auto rounded-xl bg-surface px-4 py-3 shadow-lg flex items-center gap-2 max-w-xs"
    >
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: color }} />
      <span className="mono-xs" style={{ color: color }}>
        {variantLabels[variant] ?? 'INFO'}
      </span>
      <span className="font-mono text-xs text-ink">{toast.message}</span>
    </motion.div>
  );
}
