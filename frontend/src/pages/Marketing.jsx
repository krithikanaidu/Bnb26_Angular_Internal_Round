import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  FileText,
  FolderOpen,
  Layers,
  LineChart,
  Mic,
  Scissors,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { PIPELINE_STAGES } from '../ui/PipelineMeter';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AsteriskBurst } from '../ui/DoodleOutline';
import { GridPaperBg } from '../ui/SkyBackground';
import { AmbientFloatLayers } from '../ui/AmbientFloatLayers';
import { BlurReveal, StaggerIn } from '../ui/BlurReveal';
import { useReducedMotion } from '../ui/useReducedMotion';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * The nine numbered stages of the real product, described by what they actually
 * do. Nothing here is a promise the backend cannot keep: every line maps to a
 * route that exists, and AI-dependent lines say so.
 */
const FEATURES = [
  {
    Icon: Compass,
    num: '01',
    title: 'Ideation & hooks',
    path: '/ideation',
    body:
      'Start from a topic or a competitor clip. Pull scored hooks from the pattern library, pick the angle, and open it as a script — or keep it as an idea on the board.',
    honest: 'Scoring is a weighted model, not a prediction of views.',
  },
  {
    Icon: FileText,
    num: '02',
    title: 'Script studio',
    path: '/scripts',
    body:
      'Write or generate a full script, then break it into beats: hook, problem, turn, payoff, CTA. Every beat stays editable, because the machine drafts and you decide.',
    honest: 'Generation uses OpenAI or Groq when a key is configured, otherwise a heuristic engine.',
  },
  {
    Icon: FolderOpen,
    num: '03',
    title: 'Asset library',
    path: '/assets',
    body:
      'Upload footage, audio and images straight to Supabase Storage. Assets attach to a project and stay reachable from Studio and ClipAI.',
  },
  {
    Icon: Layers,
    num: '04',
    title: 'Studio alignment',
    path: '/studio',
    body:
      'Pair a script with its footage, generate the clip list, and hand the result to the editor as a real EDL — tracks, captions and overlays that you can still change.',
  },
  {
    Icon: Scissors,
    num: '05',
    title: 'ClipAI auto-clips',
    path: '/clips',
    body:
      'Drop in a long video or a YouTube link. It downloads, transcribes, scores the strongest moments, trims them to 9:16, burns in captions and writes titles — then hands you the MP4s.',
    honest: 'ffmpeg and Whisper do the work; both degrade visibly rather than failing silently.',
  },
  {
    Icon: Wand2,
    num: '06',
    title: 'Adapt & publish',
    path: '/publish',
    body:
      'One clip, tailored per platform: caption, hashtags, CTA, aspect ratio and a reframe pass. Schedule the post, or mark it live, and keep the caption editable until it goes out.',
    honest: 'Scheduling records the intent — this build does not post to a social network for you.',
  },
  {
    Icon: LineChart,
    num: '07',
    title: 'Insights',
    path: '/insights',
    body:
      'Views, likes, comments, shares and retention, per project and per platform — only what has actually been recorded. Nothing is filled in for you.',
  },
  {
    Icon: CalendarDays,
    num: '08',
    title: 'Calendar',
    path: '/calendar',
    body: 'See what is drafted, what is scheduled and what is already out, in one place.',
  },
];

const DIFFERENTIATORS = [
  {
    Icon: Scissors,
    title: 'A real editor, not a black box',
    body:
      'ClipAI proposes clips and writes an EDL. You open that EDL in the built-in timeline and change the cut, the captions and the framing yourself.',
  },
  {
    Icon: Mic,
    title: 'Transcript-first',
    body:
      'Every long video is transcribed before it is scored, so the moment that gets clipped is chosen from what was actually said — not from a fixed timecode.',
  },
  {
    Icon: Sparkles,
    title: 'Honest about what is live',
    body:
      'Health checks report which AI engines resolved. If there is no API key, the UI says "heuristic fallback" instead of pretending a model is running.',
  },
];

const TICKER_WORDS = [
  'Ideate',
  'Hook',
  'Script',
  'Shoot',
  'Align',
  'Clip',
  'Caption',
  'Reframe',
  'Schedule',
  'Measure',
];

/** The marketing header: identity, a Features link, theme, and the login CTA. */
function MarketHeader({ signedIn }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-[46] bg-[color:var(--color-surface-raised)]/80 backdrop-blur-md transition-all duration-300 ${
        scrolled ? 'shadow-[0_6px_24px_rgba(20,20,20,0.12)] border-b border-ink/5' : 'border-b border-transparent'
      }`}
    >
      <div className="mkt-inner h-16 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="inline-flex transition-transform duration-500 hover:rotate-90">
            <AsteriskBurst size={22} />
          </span>
          <span className="font-display font-black text-lg tracking-tight">
            Bit<span style={{ color: 'var(--hot-pink)' }}>&amp;</span>Build
          </span>
        </span>
        <nav className="flex items-center gap-2">
          <a href="#features" className="btn ghost tiny hidden sm:inline-flex">
            Features
          </a>
          <ThemeToggle />
          <Link to={signedIn ? '/dashboard' : '/login'} className="btn primary tiny">
            {signedIn ? 'Open workspace' : 'Log in'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Hand-drawn stroke that draws itself under the hero's "Shorts out." */
function SquiggleUnderline({ reduced }) {
  return (
    <svg
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute left-0 -bottom-2 md:-bottom-3 w-full h-3 md:h-4 overflow-visible"
    >
      <motion.path
        d="M3 10 Q 30 3 60 8 T 120 7 T 197 6"
        fill="none"
        stroke="var(--color-hot-pink)"
        strokeWidth="5"
        strokeLinecap="round"
        initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: reduced ? 0 : 0.7, ease: 'easeOut' }}
      />
    </svg>
  );
}

/**
 * The hero's pipeline card, with a highlight that walks the eight stages on a
 * loop — the page quietly demonstrates the pipeline instead of just listing it.
 */
function PipelineRunway({ reduced }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    // Two extra beats of rest before the walk restarts, so the loop breathes.
    const t = setInterval(() => setActive((a) => (a + 1) % (PIPELINE_STAGES.length + 2)), 640);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <ol className="mkt-pipeline mt-4">
      {PIPELINE_STAGES.map((s, i) => {
        const isActive = active === i;
        return (
          <li
            key={s.key}
            className={`transition-all duration-300 ${isActive ? 'opacity-100 translate-x-1' : reduced ? '' : 'opacity-60'}`}
          >
            <span
              className="mkt-pipeline-num transition-colors duration-300"
              style={isActive ? { background: 'var(--color-hot-pink)' } : undefined}
            >
              {String(s.index).padStart(2, '0')}
            </span>
            <span className="font-display font-bold">{s.label}</span>
            <ArrowRight
              className={`w-3.5 h-3.5 ml-auto transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
              style={{ color: 'var(--color-hot-pink)' }}
            />
          </li>
        );
      })}
    </ol>
  );
}

/** Tilted washi-tape band of stage words, scrolling forever. */
function TickerBand({ reduced }) {
  const row = (dup) => (
    <div key={dup} className="flex items-center gap-10 pr-10 flex-none" aria-hidden={dup > 0}>
      {TICKER_WORDS.map((w, i) => (
        <span key={w} className="flex items-center gap-10">
          <span
            className={`font-display font-black uppercase tracking-tight text-2xl md:text-3xl whitespace-nowrap ${
              i % 2 ? 'text-ink/25' : 'text-ink/70'
            }`}
          >
            {w}
          </span>
          <AsteriskBurst size={18} />
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative -rotate-1 w-[102%] -ml-[1%] border-y-2 border-dashed border-ink/15 bg-paper/70 py-4 my-2 overflow-hidden">
      <motion.div
        className="flex w-max"
        animate={reduced ? {} : { x: ['0%', '-50%'] }}
        transition={reduced ? {} : { duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        {row(0)}
        {row(1)}
      </motion.div>
    </div>
  );
}

/**
 * Marketing — the public landing page at `/`.
 *
 * Every claim here points at a real route in this app, and every "honest"
 * caveat is a limitation of the current build rather than a disclaimer bolted
 * on afterwards. Signed-out visitors can read all of it; signing in is what
 * opens the workspace.
 */
export default function Marketing() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const user = useSession((s) => s.user);
  const [engines, setEngines] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // Report what the backend actually resolved. If it is unreachable we say so
  // rather than describing an imagined deployment.
  useEffect(() => {
    let active = true;
    api
      .get('/health')
      .then(({ data }) => active && setEngines(data?.engines || null))
      .catch((e) => active && setHealthError(errorMessage(e, 'The API is not reachable.')));
    return () => {
      active = false;
    };
  }, []);

  const go = () => navigate(user ? '/dashboard' : '/login');

  const copyEngine = engines?.copy === 'groq' ? 'Groq' : engines?.copy === 'openai' ? 'OpenAI' : engines?.copy === 'heuristic' ? 'Heuristic fallback' : null;

  return (
    <div className="layout mkt-root">
      <MarketHeader signedIn={Boolean(user)} />

      <GridPaperBg />
      <AmbientFloatLayers />
      <div className="bb-grain" aria-hidden="true" />

      <main className="mkt pt-16">
        {/* ---- Hero ------------------------------------------------------ */}
        <section className="mkt-band">
          <div className="mkt-inner grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <StaggerIn>
              <span className="pill">
                <span className="opacity-50">01</span>–<span className="opacity-50">08</span> · one pipeline
              </span>
              <h1 className="extruded-text !text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.92] mt-5">
                Long video in.
                <br />
                <span className="extruded-text-pink relative inline-block">
                  Shorts out.
                  <SquiggleUnderline reduced={reduced} />
                </span>
              </h1>
              <p className="font-body text-lg md:text-xl muted max-w-xl mt-6">
                Bit &amp; Build takes one recording and walks it all the way to a scheduled post: hooks, a
                script, the footage, the cut, the captions and the per-platform copy — with an editor in
                the middle so you keep control of the final frame.
              </p>

              <div className="bb-row mt-8">
                <button type="button" className="btn primary group" onClick={go}>
                  {user ? 'Open workspace' : 'Log in to start'}
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
                <a href="#features" className="btn ghost">
                  See the features
                </a>
              </div>

              <p className="mono-xs muted mt-6">
                {healthError
                  ? `API status unknown — ${healthError}`
                  : engines
                    ? `Backend reachable · copy: ${copyEngine || 'not reported'} · speech-to-text: ${engines?.stt?.name || 'not configured'}`
                    : 'Checking the API…'}
              </p>
            </StaggerIn>

            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.96, rotate: 1.5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="card card-taped p-6"
            >
              <p className="mono-xs muted">The pipeline, in order</p>
              <PipelineRunway reduced={reduced} />
              <p className="mono-xs muted mt-4">
                Plus the calendar, insights and a standalone video editor that reads the EDL Studio hands it.
              </p>
            </motion.div>
          </div>
        </section>

        <TickerBand reduced={reduced} />

        {/* ---- Features -------------------------------------------------- */}
        <section id="features" className="mkt-band">
          <div className="mkt-inner">
            <BlurReveal>
              <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight">Everything it does</h2>
              <p className="muted mt-3 max-w-2xl">
                Eight stages, each of which is a screen you can open right now. Where a stage has a real
                limitation, it is written on the card instead of being hidden.
              </p>
            </BlurReveal>

            <StaggerIn className="mkt-grid mt-10" stagger={0.05}>
              {FEATURES.map(({ Icon, num, title, body, honest, path }) => (
                <Link key={num} to={path} className="card mkt-feature card-hover group">
                  <span className="flex items-center justify-between gap-3">
                    <span className="mkt-feature-num transition-transform duration-300 group-hover:-rotate-6">
                      {num}
                    </span>
                    <Icon className="w-5 h-5 text-ink/40 transition-all duration-300 group-hover:text-hot-pink group-hover:rotate-12 group-hover:scale-110" />
                  </span>
                  <h3 className="font-display font-black text-xl">{title}</h3>
                  <p className="muted text-sm flex-1">{body}</p>
                  {honest && <p className="mono-xs muted border-t border-dashed border-ink/15 pt-3">{honest}</p>}
                  <span className="mono-xs font-bold text-ink/50 inline-flex items-center gap-1 transition-colors duration-300 group-hover:text-ink">
                    Open {title.toLowerCase()} <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </StaggerIn>
          </div>
        </section>

        <div className="mkt-inner">
          <div className="mkt-rule" />
        </div>

        {/* ---- Differentiators -------------------------------------------- */}
        <section className="mkt-band">
          <div className="mkt-inner">
            <BlurReveal>
              <h2 className="font-display font-black text-3xl md:text-4xl tracking-tight">Why this, not another black box</h2>
              <p className="muted mt-3 max-w-2xl">Three commitments the rest of the app is built on.</p>
            </BlurReveal>

            <StaggerIn className="mkt-grid mt-10" stagger={0.08}>
              {DIFFERENTIATORS.map(({ Icon, title, body }) => (
                <div key={title} className="card mkt-feature">
                  <Icon className="w-6 h-6 text-hot-pink" />
                  <h3 className="font-display font-black text-xl">{title}</h3>
                  <p className="muted text-sm">{body}</p>
                </div>
              ))}
            </StaggerIn>
          </div>
        </section>

        {/* ---- Close ------------------------------------------------------ */}
        <section className="mkt-band tight">
          <BlurReveal>
            <div className="mkt-inner card card-taped text-center py-12 relative">
              <motion.span
                aria-hidden="true"
                className="absolute -top-5 -right-4 inline-flex"
                animate={reduced ? {} : { rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              >
                <AsteriskBurst size={44} />
              </motion.span>
              <motion.span
                aria-hidden="true"
                className="absolute -bottom-4 -left-4 inline-block w-9 h-9 rounded-md border-2 border-ink bg-[color:var(--color-sticker-yellow)] -rotate-6"
              />
              <h2 className="font-display font-black text-3xl md:text-4xl tracking-tight">
                Sign in to open your workspace
              </h2>
              <p className="muted mt-3 max-w-xl mx-auto">
                Your projects, scripts, assets, clips and schedule all live behind the login. A brand new
                database needs its first account created before anyone can sign in.
              </p>
              <div className="bb-row justify-center mt-7">
                <button type="button" className="btn primary group" onClick={go}>
                  {user ? 'Open workspace' : 'Log in'}
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </BlurReveal>
        </section>

        <footer className="mkt-band tight pt-0">
          <div className="mkt-inner flex flex-wrap items-center justify-between gap-4">
            <span className="mono-xs muted">
              Bit&amp;Build · Express + Sequelize + Supabase · React + Vite
            </span>
            <span className="mono-xs muted">Video editor opens outside the workspace chrome</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
