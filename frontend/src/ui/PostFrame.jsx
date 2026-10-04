import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { useReducedMotion } from './useReducedMotion';

/**
 * PostFrame — a 9:16 social post mock used as a *preview frame* in Publish and
 * Playground. It is chrome only: the icons are decorative and non-interactive,
 * because we do not have live engagement data and inventing it would be worse
 * than showing nothing. Pass real content in as `children`.
 */
export function PostFrame({
  children,
  caption,
  username,
  platform = 'Post',
  className = '',
  spillElements,
}) {
  const reduced = useReducedMotion();

  return (
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      {/* Elements deliberately breaking the frame */}
      {spillElements && (
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: 20 }}>
          {spillElements}
        </div>
      )}

      <motion.div
        className="relative bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 10 }}
        initial={reduced ? {} : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-ink/5">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-hot-pink to-brand-orange flex-none" />
          <span className="font-mono text-xs font-bold text-ink truncate">{username || platform}</span>
          <MoreHorizontal className="ml-auto w-4 h-4 text-ink/40 flex-none" />
        </div>

        {/* Content area */}
        <div className="relative aspect-[9/16] bg-linear-to-br from-soft-pink to-blush overflow-hidden">
          {children ?? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[10px] text-ink/40">PREVIEW</span>
            </div>
          )}
        </div>

        {/* Action bar — decorative only */}
        <div className="flex items-center gap-4 p-3" aria-hidden="true">
          <Heart className="w-5 h-5 text-ink/70" />
          <MessageCircle className="w-5 h-5 text-ink/70" />
          <Share2 className="w-5 h-5 text-ink/70" />
          <Bookmark className="w-5 h-5 text-ink/70 ml-auto" />
        </div>

        {caption && (
          <div className="px-3 pb-3">
            <span className="font-mono text-xs font-bold text-ink">{username || platform}</span>{' '}
            <span className="text-xs text-ink/80">{caption}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
