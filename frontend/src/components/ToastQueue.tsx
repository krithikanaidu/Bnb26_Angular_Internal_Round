import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

const variantColors: Record<string, string> = {
  success: 'var(--status-green)',
  error: 'var(--status-red)',
  info: 'var(--folder-blue-deep)',
};

export function ToastQueue() {
  const { toasts, dismissToast } = useUIStore();

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: { id: string; message: string; variant?: string };
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const color = variantColors[toast.variant ?? 'info'] ?? variantColors.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="pointer-events-auto rounded-xl bg-white px-4 py-3 shadow-lg flex items-center gap-2 max-w-xs"
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-xs text-ink">{toast.message}</span>
    </motion.div>
  );
}
