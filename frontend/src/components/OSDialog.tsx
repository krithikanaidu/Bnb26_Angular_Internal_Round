import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * OSDialog — iOS-style dialog card with bold two-tone headline, olive pill subline,
 * and split buttons. Spring pop-in with slight rotation. Hands at edges.
 */
export function OSDialog() {
  const { dialogs, dismissDialog } = useUIStore();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {dialogs.map((dialog) => (
        <DialogCard key={dialog.id} dialog={dialog} onDismiss={dismissDialog} reduced={reduced} />
      ))}
    </AnimatePresence>
  );
}

function DialogCard({
  dialog,
  onDismiss,
  reduced,
}: {
  dialog: import('@/store/uiStore').DialogData;
  onDismiss: (id: string) => void;
  reduced: boolean;
}) {
  const { id, headline, accentWord, subline, actions } = dialog;

  // Keyboard: Escape dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss(id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, onDismiss]);

  const renderHeadline = () => {
    if (!accentWord || !headline.includes(accentWord)) {
      return <span>{headline}</span>;
    }
    const parts = headline.split(accentWord);
    return (
      <>
        {parts[0]}
        <span style={{ color: 'var(--hot-pink)' }}>{accentWord}</span>
        {parts[1]}
      </>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={() => onDismiss(id)}
    >
      <motion.div
        role="dialog"
        aria-label={headline}
        className="relative"
        initial={reduced ? { opacity: 0, scale: 0.95 } : { opacity: 0, scale: 0.8, rotate: -3, y: 20 }}
        animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, rotate: 0, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, rotate: 3, y: 20 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 20 }}
        style={{ transformOrigin: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hands holding the dialog */}
        <HandSVG className="absolute -left-8 bottom-2 w-10 h-10 text-ink/80 z-0" side="left" />
        <HandSVG className="absolute -right-8 bottom-2 w-10 h-10 text-ink/80 z-0" side="right" />

        {/* Dialog card */}
        <div
          className="relative z-10 rounded-3xl bg-white px-8 py-7 text-center"
          style={{
            width: 340,
            boxShadow: 'var(--sticker-shadow), 0 24px 60px rgba(0,0,0,0.25)',
          }}
        >
          {/* Headline */}
          <h2 className="font-display font-black text-2xl leading-tight text-ink tracking-tight">
            {renderHeadline()}
          </h2>

          {/* Olive pill subline */}
          {subline && (
            <div className="mt-3 inline-block">
              <span
                className="inline-block rounded-full px-4 py-1 font-italic italic text-sm font-medium"
                style={{ background: 'var(--olive)', color: '#f5f5f0' }}
              >
                ({subline})
              </span>
            </div>
          )}

          {/* Split buttons */}
          <div className="mt-6 flex gap-3">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  action.onClick?.();
                  onDismiss(id);
                }}
                className="flex-1 rounded-2xl py-3.5 font-display font-bold text-base transition-all active:scale-95"
                style={{
                  background:
                    action.variant === 'primary'
                      ? 'var(--hot-pink)'
                      : 'var(--cream)',
                  color: action.variant === 'primary' ? 'white' : 'var(--ink)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function HandSVG({ className, side }: { className: string; side: 'left' | 'right' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      <path
        d="M5 35 L5 20 Q5 15 10 15 L15 15 L15 10 Q15 5 20 5 Q25 5 25 10 L25 20 L30 20 Q35 20 35 25 L35 35 Z"
        fill="#F4C2A0"
        stroke="#141414"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
