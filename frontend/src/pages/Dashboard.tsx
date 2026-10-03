import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FloatingFolder } from '@/components/FloatingFolder';
import { SkyBackground } from '@/components/SkyBackground';
import { PosterTitle, ExtrudedTitle, SectionLabel } from '@/components/PosterTitle';
import { StatusDot } from '@/components/StatusDot';
import { AsteriskBurst } from '@/components/DoodleOutline';
import { StickerLabel, StickerCutout } from '@/components/StickerLabel';
import { InkAvatar } from '@/components/InkAvatar';
import { BlurReveal } from '@/components/BlurReveal';
import { useAppStore, type PipelineStatus } from '@/store/appStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useUIStore } from '@/store/uiStore';

const STATUS_COLORS: Record<PipelineStatus, 'green' | 'red' | 'purple' | 'orange'> = {
  idea: 'red',
  scripted: 'orange',
  recorded: 'orange',
  editing: 'purple',
  review: 'purple',
  scheduled: 'orange',
  published: 'green',
};

const STAGE_TABS: Record<PipelineStatus, string> = {
  idea: '/scripts',
  scripted: '/scripts',
  recorded: '/assets',
  editing: '/studio',
  review: '/review',
  scheduled: '/publish',
  published: '/insights',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, advanceProject, setCurrentStage } = useAppStore();
  const { pushDialog, pushToast } = useUIStore();
  const reduced = useReducedMotion();

  return (
    <div className="relative min-h-screen">
      {/* Sky background */}
      <SkyBackground />

      {/* Hero section */}
      <section className="relative pt-24 pb-16 px-6 md:px-12 z-10">
        <div className="max-w-6xl mx-auto">
          <BlurReveal>
            <SectionLabel number="01" label="Dashboard" className="text-ink/70 mb-6" />
          </BlurReveal>

          {/* 3D extruded hero title with script overlay */}
          <div className="relative mb-4">
            <PosterTitle
              boldText="YOUR CONTENT"
              scriptText="Studio"
              boldClassName="text-5xl md:text-7xl lg:text-8xl text-ink"
              scriptClassName="text-4xl md:text-6xl lg:text-7xl text-hot-pink"
              animate
              extruded
              extrudedColor="blue"
            />
          </div>
          <div className="relative mt-[-10px] mb-8">
            <PosterTitle
              boldText="FROM IDEA TO"
              scriptText="everywhere"
              boldClassName="text-5xl md:text-7xl lg:text-8xl text-ink"
              scriptClassName="text-4xl md:text-6xl lg:text-7xl text-brand-orange"
              animate
              delay={0.8}
              extruded
              extrudedColor="pink"
            />
          </div>

          <BlurReveal delay={0.3}>
            <p className="font-body text-base md:text-lg text-ink/70 max-w-xl leading-relaxed">
              One workspace for the whole creator pipeline. AI does the repetitive work,
              you keep control. Every AI edit is a versioned, editable operation you can
              accept, reject, or tweak.
            </p>
          </BlurReveal>

          {/* CTA stickers */}
          <div className="flex flex-wrap gap-3 mt-6">
            <StickerLabel variant="ticket" color="var(--sticker-yellow)" rotate={-2} onClick={() => navigate('/scripts')}>
              START A PROJECT
            </StickerLabel>
            <StickerLabel variant="pill" color="var(--hot-pink)" textColor="white" rotate={2} onClick={() => navigate('/insights')}>
              VIEW INSIGHTS
            </StickerLabel>
          </div>
        </div>
      </section>

      {/* Floating pipeline folders */}
      <section className="relative z-10 px-6 md:px-12 pb-16">
        <div className="max-w-6xl mx-auto">
          <BlurReveal>
            <SectionLabel number="02" label="Pipeline" className="text-ink/70 mb-8" />
          </BlurReveal>

          {/* Asymmetric staggered folder layout */}
          <div className="flex flex-wrap gap-x-6 gap-y-12 justify-center md:justify-between">
            {projects.map((project, i) => {
              const stageIdx = ['idea', 'scripted', 'recorded', 'editing', 'review', 'scheduled', 'published'].indexOf(project.status);
              const marginTop = [0, 30, 0, 50, 15, 40, 10][i] ?? 0;

              return (
                <div key={project.id} style={{ marginTop }}>
                  <FloatingFolder
                    label={project.status.toUpperCase()}
                    statusColor={STATUS_COLORS[project.status]}
                    stageNumber={`0${stageIdx + 1}`}
                    delay={i * 0.1}
                    bobDuration={3.5 + i * 0.5}
                    onClick={() => {
                      setCurrentStage(stageIdx + 1);
                      navigate(STAGE_TABS[project.status]);
                    }}
                  >
                    {/* Mini preview inside folder */}
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                      <div
                        className="w-full h-16 rounded-md flex items-center justify-center"
                        style={{ background: project.thumbnailColor + '40' }}
                      >
                        <ExtrudedTitle text={`0${i + 1}`} className="text-2xl text-ink/60" color="blue" />
                      </div>
                      <p className="font-mono text-[8px] text-ink/60 text-center leading-tight line-clamp-2 px-1">
                        {project.title}
                      </p>
                    </div>
                  </FloatingFolder>

                  {/* Label under folder */}
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <StatusDot color={STATUS_COLORS[project.status]} size={7} />
                    <span className="font-mono text-[9px] font-bold text-ink/60 uppercase tracking-wide">
                      {project.title.slice(0, 18)}
                      {project.title.length > 18 ? '…' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drag-to-advance hint */}
          <BlurReveal delay={0.5}>
            <div className="mt-12 text-center">
              <StickerLabel variant="tag" color="var(--hot-pink)" rotate={-1}>
                CLICK A FOLDER TO OPEN
              </StickerLabel>
            </div>
          </BlurReveal>
        </div>
      </section>

      {/* Creator cutout peeking from behind a folder */}
      <section className="relative z-10 px-6 md:px-12 pb-20">
        <div className="max-w-6xl mx-auto relative">
          <BlurReveal>
            <SectionLabel number="03" label="Who's Creating" className="text-ink/70 mb-8" />
          </BlurReveal>

          <div className="flex flex-wrap gap-8 justify-center">
            {[
              { name: 'Riya', variant: 'bob' as const, role: 'Solo short-form creator' },
              { name: 'Arjun', variant: 'glasses' as const, role: 'Podcaster' },
              { name: 'Meera', variant: 'braids' as const, role: 'Educator & entrepreneur' },
              { name: 'Sam', variant: 'sidepart' as const, role: 'Freelance editor' },
            ].map((person, i) => (
              <motion.div
                key={person.name}
                className="flex flex-col items-center gap-3"
                initial={reduced ? {} : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              >
                <StickerCutout outlineColor="white" rotate={i % 2 === 0 ? -3 : 3}>
                  <div className="bg-cream rounded-2xl p-4">
                    <InkAvatar variant={person.variant} size={90} name={person.name} />
                  </div>
                </StickerCutout>
                <div className="text-center">
                  <p className="font-display font-bold text-ink">{person.name}</p>
                  <p className="font-mono text-[10px] text-ink/50 uppercase tracking-wide">{person.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Finale: mountain-free footer with CTA + profile card */}
      <section className="relative z-10 px-6 md:px-12 pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl bg-white/80 backdrop-blur-sm p-8 md:p-12 paper-grain" style={{ boxShadow: 'var(--sticker-shadow)' }}>
            {/* Asterisk decorations */}
            <AsteriskBurst className="absolute -top-4 -left-4" size={40} />
            <AsteriskBurst className="absolute -bottom-4 -right-4" size={32} />

            <BlurReveal>
              <ExtrudedTitle text="READY?" className="text-4xl md:text-5xl text-ink mb-4" color="pink" />
            </BlurReveal>
            <BlurReveal delay={0.2}>
              <p className="font-body text-ink/70 mb-6 max-w-md">
                Pick up where you left off, or start something new. Your pipeline is waiting.
              </p>
            </BlurReveal>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  pushDialog({
                    headline: 'New project started',
                    accentWord: 'started',
                    subline: 'your next big idea is one click away',
                    actions: [
                      { label: 'Done', variant: 'primary', onClick: () => pushToast({ message: 'Project created', variant: 'success' }) },
                      { label: 'Later', variant: 'secondary' },
                    ],
                  });
                }}
                className="px-6 py-3 rounded-2xl font-display font-bold text-white transition-all active:scale-95"
                style={{ background: 'var(--hot-pink)', boxShadow: 'var(--sticker-shadow)' }}
              >
                NEW PROJECT
              </button>
              <button
                onClick={() => navigate('/studio')}
                className="px-6 py-3 rounded-2xl font-display font-bold text-ink transition-all active:scale-95"
                style={{ background: 'var(--cream)', boxShadow: 'var(--sticker-shadow)' }}
              >
                OPEN STUDIO
              </button>
            </div>

            {/* Barcode strip */}
            <div className="mt-8 flex items-end gap-px h-8">
              {Array.from({ length: 50 }, (_, i) => (
                <div
                  key={i}
                  className="bg-ink"
                  style={{ width: 2, height: 20 + Math.sin(i * 7) * 8 + (i % 3) * 4 }}
                />
              ))}
              <span className="ml-3 font-mono text-[10px] text-ink/50">CREATORAI v1.0</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
