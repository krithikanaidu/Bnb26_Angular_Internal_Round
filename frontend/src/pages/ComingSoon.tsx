import { motion } from 'framer-motion';
import { SectionLabel } from '@/components/PosterTitle';
import { InkAvatar } from '@/components/InkAvatar';
import { StickerLabel } from '@/components/StickerLabel';
import { AsteriskBurst, DoodleOutline } from '@/components/DoodleOutline';
import { BlurReveal } from '@/components/BlurReveal';

/**
 * Placeholder page for tabs not yet built.
 * Shows an ink avatar shrugging with a doodle arrow.
 */
export function ComingSoon({ number, label, description }: { number: string; label: string; description: string }) {
  return (
    <div className="relative min-h-screen bg-grid-paper" style={{ background: 'var(--cream)' }}>
      <div className="max-w-2xl mx-auto pt-32 px-6 text-center">
        <BlurReveal>
          <SectionLabel number={number} label={label} className="text-ink/70 mb-12 justify-center" />
        </BlurReveal>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="inline-block relative"
        >
          <div className="bg-white rounded-3xl p-8 inline-block" style={{ boxShadow: 'var(--sticker-shadow)' }}>
            <InkAvatar variant="sidepart" size={120} />
          </div>
          {/* Doodle arrow pointing up */}
          <div className="absolute -top-8 -right-12">
            <DoodleOutline type="arrow" width={60} height={60} />
          </div>
          {/* Asterisk */}
          <AsteriskBurst className="absolute -bottom-4 -left-4" size={36} />
        </motion.div>

        <BlurReveal delay={0.2}>
          <h2 className="font-display font-black text-3xl text-ink mt-8 mb-3">
            Coming Soon
          </h2>
        </BlurReveal>
        <BlurReveal delay={0.3}>
          <p className="font-body text-ink/60 mb-8 max-w-md mx-auto">{description}</p>
        </BlurReveal>

        <StickerLabel variant="ticket" color="var(--sticker-yellow)" rotate={-2}>
          IN PROGRESS
        </StickerLabel>
      </div>
    </div>
  );
}
