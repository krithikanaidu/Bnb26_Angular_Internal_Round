import { motion } from 'framer-motion';
import { AlertTriangle, Inbox } from 'lucide-react';
import { GridPaperBg } from './SkyBackground';
import { AmbientFloatLayers } from './AmbientFloatLayers';
import { SectionLabel, PosterTitle } from './PosterTitle';
import { DoodleOutline, AsteriskBurst } from './DoodleOutline';
import { TapeStrip } from './StickerLabel';
import { useReducedMotion } from './useReducedMotion';

/**
 * Rendered wherever the backend did not give us a number.
 * This is deliberately a visible em dash rather than a 0, a blank, or a
 * spinner: "we don't know" and "zero" must never look the same on this board.
 */
export const NO_VALUE = '—';

/**
 * PaperPage — the standard page frame: content column, breathing room and a
 * full-viewport minimum.
 *
 * The graph-paper and ambient backdrops are painted ONCE by <Layout> (they
 * need a positioned ancestor to size to the whole document), so pages must
 * not add their own. Pass `backdrop` only when you need a self-contained
 * surface, e.g. a demo card inside the playground.
 */
export function PaperPage({ children, className = '', backdrop = false }) {
  return (
    <div className={`relative min-h-screen ${className}`}>
      {backdrop && (
        <>
          <GridPaperBg />
          <AmbientFloatLayers />
        </>
      )}
      <div className="bb-page">{children}</div>
    </div>
  );
}

/**
 * PageHead — numbered page title with an optional script word, a hand-drawn
 * underline, an optional blurb and a slot for actions.
 */
export function PageHead({
  number,
  title,
  script,
  description,
  actions,
  children,
  className = '',
}) {
  const reduced = useReducedMotion();

  return (
    <header className={`page-head ${className}`}>
      <div className="min-w-0">
        {number && <SectionLabel number={number} label={title} className="mut mb-3" />}
        {script ? (
          <PosterTitle
            boldText={title}
            scriptText={script}
            animate={!reduced}
            boldClassName="text-[clamp(30px,5vw,46px)]"
            scriptClassName="text-[clamp(22px,4vw,34px)] text-hot-pink"
          />
        ) : (
          <h1>{title}</h1>
        )}
        {description && (
          <p className="mt-3">
            {description}
            {children}
          </p>
        )}
      </div>
      {actions && <div className="bb-row shrink-0">{actions}</div>}
    </header>
  );
}

/** UnderlineDoodle — pink sketch line under a heading. */
export function UnderlineDoodle({ className = '', width = 140 }) {
  return <DoodleOutline type="underline" width={width} height={24} className={className} />;
}

/**
 * StatTile — one number on a taped card. Renders NO_VALUE when the value is
 * absent so a failed or empty query is never dressed up as a real figure.
 */
export function StatTile({ label, value, hint, accent = false, className = '' }) {
  const missing = value === null || value === undefined || value === '';

  return (
    <motion.div
      className={`card card-hover relative overflow-visible ${className}`}
      style={accent ? { borderColor: 'color-mix(in srgb, var(--color-hot-pink) 45%, transparent)' } : undefined}
    >
      <TapeStrip color={accent ? 'var(--color-hot-pink)' : 'var(--color-sticker-yellow)'} rotate={accent ? -4 : -3} left={22} />
      <div className="stat">
        <small>{label}</small>
        <div className="kpi" style={missing ? { color: 'color-mix(in srgb, var(--color-ink) 32%, transparent)' } : undefined}>
          {missing ? NO_VALUE : value}
        </div>
        {hint && <span className="ex">{hint}</span>}
      </div>
    </motion.div>
  );
}

/**
 * Panel — a titled paper card, optionally taped at the corner, with an action
 * slot in the header.
 */
export function Panel({ title, subtitle, taped = false, actions, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`card ${taped ? 'relative overflow-visible' : ''} ${className}`}>
      {(taped || subtitle || actions) && (
        <>
          {taped && <TapeStrip rotate={-3} left={26} width={92} />}
          {(title || actions) && (
            <div className="card-title-row" style={taped ? { marginTop: 6 } : undefined}>
              <div className="min-w-0">
                {title && <h3>{title}</h3>}
                {subtitle && <div className="ex mt-1">{subtitle}</div>}
              </div>
              {actions && <div className="bb-row shrink-0">{actions}</div>}
            </div>
          )}
        </>
      )}
      {children}
    </Tag>
  );
}

/** ErrorNote — the loud-but-readable failure surface. */
export function ErrorNote({ children, label = 'Error', className = '' }) {
  if (!children) return null;
  return (
    <div className={`error-text ${className}`} role="alert">
      <AlertTriangle className="w-4 h-4 flex-none mt-0.5" />
      <div className="min-w-0">
        <span className="error-label">{label} </span>
        <span>{children}</span>
      </div>
    </div>
  );
}

/** EmptyState — dashed paper with a note explaining what would fill it. */
export function EmptyState({ title, children, action, icon, className = '' }) {
  return (
    <div className={`bb-empty ${className}`}>
      <span className="mut flex items-center gap-2">
        {icon ?? <Inbox className="w-5 h-5" />}
        <AsteriskBurst size={22} />
      </span>
      {title && <b>{title}</b>}
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

/** LoadingNote — neutral, non-alarming placeholder while a request is open. */
export function LoadingNote({ children = 'Loading…', className = '' }) {
  return (
    <p className={`mut flex items-center gap-2 text-sm ${className}`}>
      <span className="dot" style={{ background: 'var(--color-soft-pink)', animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
      {children}
    </p>
  );
}

/** Bar — a labelled proportional meter. Never used for a value we don't have. */
export function Bar({ value, max = 100, color, className = '' }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return (
    <div className={`bar ${className}`} role="presentation">
      <div style={color ? { width: `${pct}%`, background: color } : { width: `${pct}%` }} />
    </div>
  );
}

/** TagRow — pills from a list, with a cap so long lists stay readable. */
export function TagRow({ items = [], cap = 6, empty = 'None recorded', className = '' }) {
  if (!items.length) return <span className={`ex ${className}`}>{empty}</span>;
  return (
    <div className={`tags ${className}`}>
      {items.slice(0, cap).map((t, i) => (
        <span className="pill" key={`${t}-${i}`}>
          {t}
        </span>
      ))}
      {items.length > cap && <span className="pill">+{items.length - cap} more</span>}
    </div>
  );
}

/** DataRow — label / value pair used inside panels. */
export function DataRow({ label, children, mono = false, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${className}`}>
      <span className="mono-xs muted">{label}</span>
      <span className={mono ? 'font-mono text-xs text-right break-all' : 'text-sm text-right'}>{children}</span>
    </div>
  );
}
