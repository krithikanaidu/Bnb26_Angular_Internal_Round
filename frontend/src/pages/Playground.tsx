import { useRef } from 'react';
import { motion } from 'framer-motion';
import { SectionLabel } from '@/components/PosterTitle';
import { BlurReveal } from '@/components/BlurReveal';
import { FloatingFolder } from '@/components/FloatingFolder';
import { StatusDot } from '@/components/StatusDot';
import { OSDialog } from '@/components/OSDialog';
import { ToastQueue } from '@/components/ToastQueue';
import { InkAvatar, type AvatarVariant } from '@/components/InkAvatar';
import { PosterTitle, ExtrudedTitle } from '@/components/PosterTitle';
import { DoodleOutline, AsteriskBurst } from '@/components/DoodleOutline';
import { StickerLabel, StickerCutout, ParallaxLayer } from '@/components/StickerLabel';
import { SkyBackground, GridPaperBg } from '@/components/SkyBackground';
import { AmbientFloatLayers } from '@/components/AmbientFloatLayers';
import { PostFrame } from '@/components/PostFrame';
import { SpillBin, ParachuteDrop } from '@/components/SpillBin';
import { GradientSlider } from '@/components/GradientSlider';
import { PipelineMeter } from '@/components/PipelineMeter';
import { useUIStore } from '@/store/uiStore';

export function Playground() {
  const { pushDialog, pushToast } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="relative min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-20">
        <BlurReveal>
          <SectionLabel number="00" label="Playground" className="text-ink/70" />
        </BlurReveal>

        {/* FloatingFolder */}
        <DemoSection title="FloatingFolder">
          <FloatingFolder
            label="SCRIPTED"
            statusColor="orange"
            stageNumber="02"
            onClick={() => pushToast({ message: 'Folder clicked!', variant: 'info' })}
          />
        </DemoSection>

        {/* OSDialog */}
        <DemoSection title="OSDialog + ToastQueue">
          <button
            onClick={() =>
              pushDialog({
                headline: 'Transcription complete',
                accentWord: 'complete',
                subline: 'your audio is now text, magic',
                actions: [
                  { label: 'Done', variant: 'primary', onClick: () => pushToast({ message: 'Transcript saved', variant: 'success' }) },
                  { label: 'Later', variant: 'secondary' },
                ],
              })
            }
            className="px-6 py-3 rounded-2xl font-display font-bold text-white active:scale-95"
            style={{ background: 'var(--hot-pink)' }}
          >
            OPEN DIALOG
          </button>
          <button
            onClick={() => pushToast({ message: 'Toast notification!', variant: 'success' })}
            className="px-6 py-3 rounded-2xl font-display font-bold text-ink ml-3 active:scale-95"
            style={{ background: 'var(--sticker-yellow)' }}
          >
            PUSH TOAST
          </button>
        </DemoSection>

        {/* InkAvatar */}
        <DemoSection title="InkAvatar (12 variants)">
          <div className="flex flex-wrap gap-4">
            {(['bob', 'glasses', 'ponytail', 'braids', 'buzz', 'sidepart', 'curly', 'topknot', 'afro', 'mohawk', 'waves', 'beanie'] as AvatarVariant[]).map((v) => (
              <div key={v} className="flex flex-col items-center gap-1">
                <InkAvatar variant={v} size={60} name={v} />
                <span className="font-mono text-[8px] text-ink/40">{v}</span>
              </div>
            ))}
          </div>
        </DemoSection>

        {/* PosterTitle */}
        <DemoSection title="PosterTitle + ExtrudedTitle">
          <PosterTitle
            boldText="INSIGHTS"
            scriptText="loop"
            boldClassName="text-4xl text-ink"
            scriptClassName="text-3xl text-hot-pink"
            extruded
            extrudedColor="blue"
          />
          <div className="mt-4">
            <ExtrudedTitle text="2x" className="text-5xl text-ink" color="pink" />
          </div>
        </DemoSection>

        {/* DoodleOutline */}
        <DemoSection title="DoodleOutline + AsteriskBurst">
          <div className="flex flex-wrap gap-6 items-center">
            <DoodleOutline type="circle" width={120} height={80} />
            <DoodleOutline type="underline" width={120} height={80} />
            <DoodleOutline type="arrow" width={120} height={80} />
            <DoodleOutline type="sunglasses" width={120} height={80} />
            <AsteriskBurst size={50} />
          </div>
        </DemoSection>

        {/* StickerLabel + StickerCutout */}
        <DemoSection title="StickerLabel + StickerCutout">
          <div className="flex flex-wrap gap-3 items-center">
            <StickerLabel variant="pill" color="var(--hot-pink)" textColor="white" rotate={-2}>
              PILL TAG
            </StickerLabel>
            <StickerLabel variant="ticket" color="var(--sticker-yellow)" rotate={3}>
              TICKET
            </StickerLabel>
            <StickerLabel variant="tag" color="var(--hot-pink)" rotate={-1}>
              HANDLE
            </StickerLabel>
            <StickerCutout outlineColor="white" rotate={5}>
              <div className="bg-cream rounded-xl px-3 py-2">
                <span className="font-mono text-xs">CUTOUT</span>
              </div>
            </StickerCutout>
          </div>
        </DemoSection>

        {/* StatusDot */}
        <DemoSection title="StatusDot">
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2"><StatusDot color="green" /><span className="font-mono text-xs">Done</span></div>
            <div className="flex items-center gap-2"><StatusDot color="red" /><span className="font-mono text-xs">Needs attention</span></div>
            <div className="flex items-center gap-2"><StatusDot color="purple" /><span className="font-mono text-xs">In review</span></div>
            <div className="flex items-center gap-2"><StatusDot color="orange" /><span className="font-mono text-xs">Scheduled</span></div>
          </div>
        </DemoSection>

        {/* PostFrame */}
        <DemoSection title="PostFrame">
          <PostFrame
            caption="These 5 AI tools feel illegal to know about..."
            spillElements={
              <>
                <StickerLabel className="absolute -top-4 -right-6" variant="pill" color="var(--sticker-yellow)" rotate={12}>
                  #viral
                </StickerLabel>
                <StickerLabel className="absolute -bottom-2 -left-4" variant="tag" color="var(--hot-pink)" rotate={-8}>
                  #ai
                </StickerLabel>
              </>
            }
          >
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-soft-pink to-blush">
              <ExtrudedTitle text="5 AI" className="text-4xl text-ink" color="pink" />
            </div>
          </PostFrame>
        </DemoSection>

        {/* SpillBin */}
        <DemoSection title="SpillBin + ParachuteDrop">
          <SpillBin
            items={[
              { id: 'f1', label: 'clip1', color: 'var(--folder-blue-deep)' },
              { id: 'f2', label: 'clip2', color: 'var(--sticker-purple)' },
              { id: 'f3', label: 'clip3', color: 'var(--brand-orange)' },
              { id: 'f4', label: 'clip4', color: 'var(--status-green)' },
            ]}
          />
          <div className="mt-12 flex gap-4">
            <ParachuteDrop delay={0.2}>
              <StickerLabel variant="ticket" color="var(--sticker-yellow)">DROP 1</StickerLabel>
            </ParachuteDrop>
            <ParachuteDrop delay={0.5}>
              <StickerLabel variant="ticket" color="var(--soft-pink)">DROP 2</StickerLabel>
            </ParachuteDrop>
          </div>
        </DemoSection>

        {/* GradientSlider */}
        <DemoSection title="GradientSlider">
          <GradientSlider stackCount={3} />
        </DemoSection>

        {/* Backgrounds */}
        <DemoSection title="SkyBackground + GridPaperBg">
          <div className="relative h-32 rounded-xl overflow-hidden">
            <SkyBackground />
          </div>
          <div className="relative h-32 rounded-xl overflow-hidden mt-4">
            <GridPaperBg />
          </div>
        </DemoSection>

        {/* AmbientFloatLayers */}
        <DemoSection title="AmbientFloatLayers">
          <div className="relative h-48 rounded-xl overflow-hidden bg-cream">
            <AmbientFloatLayers />
          </div>
        </DemoSection>

        {/* PipelineMeter */}
        <DemoSection title="PipelineMeter">
          <p className="font-mono text-xs text-ink/50">Look at the bottom-left corner.</p>
        </DemoSection>
      </div>
    </div>
  );
}

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BlurReveal>
      <div className="relative">
        <h3 className="font-display font-bold text-lg text-ink mb-4 flex items-center gap-2">
          <AsteriskBurst size={16} animate={false} />
          {title}
        </h3>
        <div className="bg-white/60 rounded-2xl p-6" style={{ boxShadow: 'var(--paper-shadow)' }}>
          {children}
        </div>
      </div>
    </BlurReveal>
  );
}
