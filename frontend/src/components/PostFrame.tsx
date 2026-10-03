import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * PostFrame — real-looking social post frame with like/comment/share/save icons, caption bar.
 * Objects can spill out and cross the frame boundary (overflow visible, deliberate z-index overlap).
 */
export function PostFrame({
  children,
  caption,
  username = '@creatorai',
  className = '',
  spillElements,
}: {
  children?: React.ReactNode;
  caption?: string;
  username?: string;
  className?: string;
  spillElements?: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      {/* Spill elements that break the frame */}
      {spillElements && (
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: 20 }}>
          {spillElements}
        </div>
      )}

      {/* Post frame */}
      <motion.div
        className="relative bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 10 }}
        initial={reduced ? {} : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-ink/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hot-pink to-brand-orange" />
          <span className="font-mono text-xs font-bold text-ink">{username}</span>
          <MoreHorizontal className="ml-auto w-4 h-4 text-ink/40" />
        </div>

        {/* Content area */}
        <div className="relative aspect-[9/16] bg-gradient-to-br from-soft-pink to-blush overflow-hidden">
          {children}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-4 p-3">
          <Heart className="w-5 h-5 text-ink/70" />
          <MessageCircle className="w-5 h-5 text-ink/70" />
          <Share2 className="w-5 h-5 text-ink/70" />
          <Bookmark className="w-5 h-5 text-ink/70 ml-auto" />
        </div>

        {/* Caption bar */}
        {caption && (
          <div className="px-3 pb-3">
            <span className="font-mono text-xs font-bold text-ink">{username}</span>{' '}
            <span className="text-xs text-ink/80">{caption}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
