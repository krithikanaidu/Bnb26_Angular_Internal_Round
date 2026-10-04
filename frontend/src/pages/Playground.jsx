import { useState } from 'react';

import { PaperPage, PageHead, Panel, StatTile, EmptyState, ErrorNote, Bar, TagRow, DataRow, NO_VALUE } from '../ui/AppKit';
import { DoodleOutline, AsteriskBurst } from '../ui/DoodleOutline';
import { BlurReveal, StaggerIn } from '../ui/BlurReveal';
import { StatusDot, StatusDotLabel } from '../ui/StatusDot';
import { StickerLabel, StickerCutout, TapeStrip, WobbleHover, ParallaxLayer } from '../ui/StickerLabel';
import { InkAvatar, AVATAR_VARIANTS } from '../ui/InkAvatar';
import { FloatingFolder } from '../ui/FloatingFolder';
import { GradientSlider } from '../ui/GradientSlider';
import { PosterTitle, ExtrudedTitle, SectionLabel } from '../ui/PosterTitle';
import { PostFrame } from '../ui/PostFrame';
import { SpillBin, ParachuteDrop } from '../ui/SpillBin';
import { SkyBackground, GridPaperBg } from '../ui/SkyBackground';
import { AmbientFloatLayers } from '../ui/AmbientFloatLayers';
import { StageTrail, PIPELINE_STAGES } from '../ui/PipelineMeter';
import { useUIStore } from '../ui/uiStore';

/**
 * Playground — the full component gallery.
 *
 * Nothing on this page reads from the API and nothing here represents real
 * account data; the numbers are fixed literals so the components can be
 * reviewed in isolation without implying we know anything about your content.
 */
export default function Playground() {
  const pushDialog = useUIStore((s) => s.pushDialog);
  const pushToast = useUIStore((s) => s.pushToast);
  const [slider, setSlider] = useState(35);

  return (
    <PaperPage>
      <PageHead
        number="PG"
        title="Playground"
        script="the whole kit"
        description="Every component in the Bit & Build paper-studio system, on one sheet. Nothing here is wired to your account — the numbers are fixed literals so the components can be judged on their own."
      />

      {/* ---- Typography ------------------------------------------------- */}
      <Panel title="Typography" subtitle="font-display · font-script · font-serif · font-italic · font-mono" taped>
        <div className="bb-grid bb-g2">
          <div>
            <SectionLabel number="01" label="Display" className="mut mb-2" />
            <PosterTitle
              boldText="SHIP IT"
              scriptText="properly"
              animate
              extruded
              boldClassName="text-[clamp(38px,7vw,64px)]"
              scriptClassName="text-[clamp(24px,5vw,40px)] text-hot-pink"
            />
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <ExtrudedTitle text="INSIGHTS" className="text-3xl" />
            <ExtrudedTitle text="INSIGHTS" className="text-3xl" color="pink" />
            <ExtrudedTitle text="INSIGHTS" className="text-3xl" color="orange" />
          </div>
        </div>
        <hr className="sep" />
        <div className="bb-row">
          <span className="pill">pill</span>
          <span className="pill pill-pink">pill-pink</span>
          <span className="pill pill-yellow">pill-yellow</span>
          <span className="pill pill-blue">pill-blue</span>
          <span className="pill pill-olive">pill-olive</span>
          <span className="mono-xs">MONO / 10PX / 0.14EM</span>
          <span className="ex">ex — the small italic aside</span>
        </div>
      </Panel>

      {/* ---- Doodles ---------------------------------------------------- */}
      <Panel title="DoodleOutline" subtitle="hand-drawn keylines that animate on">
        <div className="bb-row items-end gap-6">
          {['circle', 'underline', 'arrow', 'scribble', 'sunglasses'].map((t) => (
            <figure key={t} className="m-0 text-center">
              <DoodleOutline type={t} width={120} height={80} />
              <figcaption className="mono-xs muted mt-1">{t}</figcaption>
            </figure>
          ))}
          <figure className="m-0 text-center">
            <AsteriskBurst size={80} />
            <figcaption className="mono-xs muted mt-1">asterisk</figcaption>
          </figure>
        </div>
      </Panel>

      {/* ---- Labels & stickers ------------------------------------------ */}
      <Panel title="StickerLabel & friends">
        <div className="bb-row items-center gap-5 mb-5">
          <StickerLabel rotate={-3}>pill sticker</StickerLabel>
          <StickerLabel variant="ticket" rotate={2}>
            ticket
          </StickerLabel>
          <StickerLabel variant="tag" color="var(--sticker-purple)" textColor="var(--sticker-purple)">
            tag
          </StickerLabel>
          <StickerLabel color="var(--hot-pink)" textColor="#fff">
            pink
          </StickerLabel>
          <StickerLabel color="var(--folder-blue)">
            blue
          </StickerLabel>
        </div>
        <div className="bb-row items-center gap-5">
          <StickerCutout>
            <span className="px-4 py-2 rounded-lg bg-cream font-mono text-xs font-bold">cutout</span>
          </StickerCutout>
          <StickerCutout outlineColor="pink">
            <span className="px-4 py-2 rounded-lg bg-hot-pink text-white font-mono text-xs font-bold">pink</span>
          </StickerCutout>
          <WobbleHover>
            <span className="pill pill-yellow">hover me</span>
          </WobbleHover>
          <div className="relative h-10 w-40">
            <TapeStrip left={4} rotate={-5} />
          </div>
        </div>
      </Panel>

      {/* ---- Status ----------------------------------------------------- */}
      <Panel title="StatusDot" subtitle="colour is never the only signal — pair it with a label">
        <div className="bb-row items-center gap-5">
          {['green', 'red', 'purple', 'orange'].map((c) => (
            <StatusDotLabel key={c} color={c}>
              {c}
            </StatusDotLabel>
          ))}
          <StatusDotLabel color="red" pulse={false}>
            red · static
          </StatusDotLabel>
          <StatusDot size={22} color="purple" />
        </div>
      </Panel>

      {/* ---- Stats & surfaces ------------------------------------------- */}
      <Panel title="StatTile · Panel · EmptyState · ErrorNote" subtitle="the honest-data surfaces">
        <div className="bb-grid bb-g4 mb-4">
          <StatTile label="Views" value="48,210" hint="from insights totals" />
          <StatTile label="Likes" value="3,904" />
          <StatTile label="Comments" value={NO_VALUE} hint="not returned by the API" accent />
          <StatTile label="Shares" value={0} hint="a real zero, not a gap" />
        </div>
        <div className="bb-grid bb-g2">
          <EmptyState title="Nothing here yet">
            This is what an empty table looks like — it explains itself instead of showing an empty box.
          </EmptyState>
          <div className="flex flex-col gap-3">
            <ErrorNote label="Network">
              Could not load projects — is the backend running?
            </ErrorNote>
            <Bar value={62} />
            <Bar value={18} color="var(--color-status-green)" />
            <TagRow items={['evergreen', 'talking head', 'b-roll', 'trending', 'timed', 'extra', 'more']} />
            <TagRow items={[]} />
            <DataRow label="Copy engine">Heuristic fallback (no LLM key)</DataRow>
            <DataRow label="Asset id" mono>
              a_0f9c2e1b
            </DataRow>
          </div>
        </div>
      </Panel>

      {/* ---- Folders ---------------------------------------------------- */}
      <Panel title="FloatingFolder" subtitle="bobs, tilts to the pointer, opens on hover">
        <div className="bb-row items-start gap-6">
          {PIPELINE_STAGES.slice(0, 4).map((s, i) => (
            <FloatingFolder key={s.key} label={s.label} stageNumber={String(s.index).padStart(2, '0')} statusColor={i < 2 ? 'green' : 'orange'} delay={i * 0.08} />
          ))}
        </div>
      </Panel>

      {/* ---- Slider ----------------------------------------------------- */}
      <Panel title="GradientSlider" subtitle="controlled · arrow keys · shift for bigger steps">
        <div className="max-w-md pt-16">
          <GradientSlider value={slider} onIntensityChange={setSlider} stackCount={slider / 20} label="Demo AI edit intensity" />
        </div>
      </Panel>

      {/* ---- Avatars ---------------------------------------------------- */}
      <Panel title="InkAvatar" subtitle="12 variants · blinks on a 4s loop · tilts on hover">
        <div className="flex flex-wrap gap-3">
          {AVATAR_VARIANTS.map((v) => (
            <div key={v} className="text-center">
              <InkAvatar variant={v} size={64} name={v} />
              <div className="mono-xs muted mt-1">{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ---- Spill & parachute ------------------------------------------ */}
      <Panel title="SpillBin & ParachuteDrop">
        <div className="bb-row items-start gap-10 pt-20">
          <SpillBin
            items={[
              { id: '1', label: 'clip-one.mp4', color: 'var(--sticker-purple)' },
              { id: '2', label: 'clip-two.mp4', color: 'var(--hot-pink)' },
              { id: '3', label: 'clip-three.mp4', color: 'var(--folder-blue-deep)' },
              { id: '4', label: 'thumb.png', color: 'var(--olive)' },
            ]}
          />
          <ParachuteDrop>
            <div className="card card-taped relative" style={{ width: 180 }}>
              <h3>parachute drop</h3>
              <p className="ex mt-1">falls in, settles, bounces</p>
            </div>
          </ParachuteDrop>
          <ParachuteDrop delay={0.2}>
            <StickerLabel rotate={6} color="var(--sticker-yellow)">
              landed
            </StickerLabel>
          </ParachuteDrop>
        </div>
      </Panel>

      {/* ---- Social frame ----------------------------------------------- */}
      <Panel title="PostFrame" subtitle="9:16 preview chrome — icons are decorative, never live numbers">
        <div className="bb-grid bb-g3">
          <PostFrame caption="Everything we shipped this week, in one thread." username="@bitandbuild">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[10px] text-ink/40">PREVIEW</span>
            </div>
          </PostFrame>
          <PostFrame platform="Shorts" username="@studio" className="scale-95 origin-top">
            <div className="absolute inset-0 bg-linear-to-br from-folder-blue to-cream" />
          </PostFrame>
        </div>
      </Panel>

      {/* ---- Backdrops --------------------------------------------------- */}
      <Panel title="SkyBackground · GridPaperBg · AmbientFloatLayers" subtitle="the three backdrops" className="!overflow-hidden">
        <div className="bb-grid bb-g3">
          <div className="relative h-44 rounded-xl overflow-hidden border border-ink/10">
            <SkyBackground />
            <span className="absolute bottom-2 left-3 mono-xs">sky</span>
          </div>
          <div className="relative h-44 rounded-xl overflow-hidden border border-ink/10">
            <GridPaperBg />
            <span className="absolute bottom-2 left-3 mono-xs">grid</span>
          </div>
          <div className="relative h-44 rounded-xl overflow-hidden border border-ink/10" style={{ background: 'var(--cream)' }}>
            <AmbientFloatLayers />
            <span className="absolute bottom-2 left-3 mono-xs">ambient</span>
          </div>
        </div>
      </Panel>

      {/* ---- Overlays ---------------------------------------------------- */}
      <Panel title="OSDialog & ToastQueue" subtitle="Escape and backdrop click both dismiss the dialog">
        <div className="bb-row">
          <button
            className="ghost"
            onClick={() =>
              pushDialog({
                headline: 'Discard this script?',
                accentWord: 'Discard',
                subline: 'this cannot be undone',
                actions: [
                  { label: 'Keep it', variant: 'secondary' },
                  { label: 'Discard', variant: 'primary' },
                ],
              })
            }
          >
            Open dialog
          </button>
          <button className="ghost" onClick={() => pushToast({ message: 'Project saved.', variant: 'success' })}>
            Toast · success
          </button>
          <button className="ghost" onClick={() => pushToast({ message: 'Upload failed.', variant: 'error' })}>
            Toast · error
          </button>
          <button className="ghost" onClick={() => pushToast({ message: 'Clip job queued.', variant: 'info' })}>
            Toast · info
          </button>
        </div>
      </Panel>

      {/* ---- Motion ------------------------------------------------------ */}
      <Panel title="BlurReveal & StaggerIn" subtitle="scroll-triggered; both no-op under prefers-reduced-motion">
        <StaggerIn className="bb-grid bb-g3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card">
              <h3>Staggered card {n}</h3>
              <p className="ex mt-1">Assembled in sequence, not dumped.</p>
            </div>
          ))}
        </StaggerIn>
        <div className="mt-6">
          <BlurReveal delay={0.1}>
            <div className="card">
              <h3>BlurReveal</h3>
              <p className="ex mt-1">Arrives out of focus and snaps sharp as it enters the viewport.</p>
            </div>
          </BlurReveal>
        </div>
      </Panel>

      <Panel title="ParallaxLayer">
        <ParallaxLayer speed={0.6}>
          <StickerLabel rotate={-4} color="var(--folder-blue)">
            drifts with the pointer
          </StickerLabel>
        </ParallaxLayer>
      </Panel>

      <Panel title="StageTrail" subtitle="seven stages, no completion state">
        <StageTrail />
      </Panel>
    </PaperPage>
  );
}
