// ASS subtitle builder + interactive overlay layer.
//
// Two caption styles:
//   'classic' — ClippedAI's original: white Montserrat Extra Bold, top-centre,
//               numbers/currency flipped to yellow.
//   'karaoke' — same layout, but each word pops in and the spoken word fills
//               with the accent colour, which is what makes a short read as
//               edited rather than auto-generated.
//
// Overlays (hook card, poll sticker, CTA) are emitted as extra Dialogue lines
// in the same file so a single libass pass burns everything.
'use strict';

const FONT = 'Montserrat Extra Bold';
const FONT_SIZE = 80;
const CUE_MAX_CHARS = 25;
const GAP_SPLIT = 0.5;

// ASS colours are &HAABBGGRR — BGR, not RGB.
const WHITE = '&H00FFFFFF';
const YELLOW = '&H0000FFFF';
const BLACK = '&HFF000000';

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  const pad = (n) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(sec)}.${pad(cs)}`;
}

/** Centiseconds, for karaoke \k timing. */
const cs = (seconds) => Math.max(1, Math.round((Number(seconds) || 0) * 100));

function isYellowWord(w) {
  return /\d/.test(w) || w.includes('$') || (w.includes(',') && !Number.isNaN(Number(w.replace(/,/g, ''))));
}

/** Group words into short cues: capped width, split on long pauses. */
function buildCues(words, clipStart, clipEnd, { maxChars = CUE_MAX_CHARS, gapSplit = GAP_SPLIT } = {}) {
  const inClip = words.filter((w) => w.start >= clipStart && w.end <= clipEnd);
  const cues = [];
  let cur = null;
  const push = () => {
    if (cur && cur.words.length) {
      cues.push({
        start: cur.start, end: cur.end, words: cur.words, spans: cur.spans, text: cur.words.join(' '),
      });
    }
  };
  for (const w of inClip) {
    const start = w.start - clipStart;
    const end = w.end - clipStart;
    const tooLong = cur && `${cur.words.join(' ')} ${w.word}`.length > maxChars;
    const gap = cur && start - cur.end > gapSplit;
    if (!cur || tooLong || gap) {
      push();
      cur = { words: [w.word], start, end, spans: [{ word: w.word, start, end }] };
    } else {
      cur.words.push(w.word);
      cur.spans.push({ word: w.word, start, end });
      cur.end = end;
    }
  }
  push();
  return cues;
}

/** ASS style row: …,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding */
function styleLine(name, primary, {
  secondary = primary, fontSize = FONT_SIZE, outlineColour = BLACK, outline = 3, shadow = 0,
  alignment = 8, marginV = 120, marginL = 30, marginR = 30, borderStyle = 1, spacing = 2, bold = -1,
} = {}) {
  return `Style: ${name},${FONT},${fontSize},${primary},${secondary},${outlineColour},${BLACK},${bold},0,0,0,100,100,${spacing},0,${borderStyle},${outline},${shadow},${alignment},${marginL},${marginR},${marginV},1`;
}

function headerFor(style) {
  const base = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;
  // Karaoke fills from SecondaryColour → PrimaryColour, so the unspoken colour
  // has to sit in SecondaryColour for the sweep to be visible.
  const defaultStyle = style === 'karaoke'
    ? styleLine('Default', YELLOW, { secondary: WHITE, outline: 15 })
    : styleLine('Default', WHITE, { outline: 15 });
  return `${base}${defaultStyle}\n${styleLine('Yellow', YELLOW, { outline: 15 })}\n`;
}

const HEADER = headerFor('classic');

const EVENTS_HEADER = `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

/** Escape text so braces/slashes in the transcript can't break ASS parsing. */
function assText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/** ClippedAI's original caption rule: yellow style on numbers/currency. */
function classicLine(cue) {
  const text = cue.words
    .map((w) => (isYellowWord(w) ? `{\\style Yellow}${w}` : w))
    .join(' ');
  return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${text}`;
}

/**
 * Word-by-word highlight. Each word carries `\\kf` for its own spoken
 * duration, so the accent fill sweeps across the line in sync with the audio
 * (SecondaryColour = unspoken white, PrimaryColour = spoken yellow).
 */
function karaokeLine(cue) {
  const body = (cue.spans || []).map((s, i) => {
    const next = cue.spans[i + 1];
    // Word is "sung" from its own start until the next word begins.
    const dur = cs(Math.max(0.08, (next ? next.start : cue.end) - s.start));
    return `{\\kf${dur}}${assText(s.word)} `;
  }).join('');
  return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${body.trim()}`;
}

/**
 * Full ASS document.
 *
 * @param cues   from buildCues (clip-relative timings)
 * @param opts   style: 'classic'|'karaoke'; overlays: { hook, poll, cta, progress }
 */
function buildAss(cues, opts = {}) {
  const style = opts.style === 'karaoke' ? 'karaoke' : 'classic';
  let stylesBlock = headerFor(style);
  const lines = [];

  for (const cue of cues) {
    if (!cue || !cue.words?.length) continue;
    lines.push(style === 'karaoke' ? karaokeLine(cue) : classicLine(cue));
  }

  const overlays = buildOverlayLines(cues, opts);
  if (overlays.styles.length) {
    stylesBlock += `${overlays.styles.join('\n')}\n`;
    lines.push(...overlays.lines);
  }

  return `${stylesBlock}${EVENTS_HEADER}${lines.join('\n')}\n`;
}

/**
 * Interactive overlays burned into the mp4.
 *  - hook card: the AI hook line, punches in over the opening seconds
 *  - poll sticker: question + options, appears late to drive comments
 *  - CTA + hashtags: closing card
 *
 * Vertical bands are chosen so overlays never collide with the top-centre
 * captions: hook 1240, poll 1360, CTA 1560, tags 1650 on a 1920 canvas.
 */
function buildOverlayLines(cues, opts = {}) {
  const o = opts.overlays || {};
  const duration = cues.length ? cues[cues.length - 1].end : 0;
  if (!duration) return { styles: [], lines: [] };

  const styles = [];
  const lines = [];

  if (o.hook) {
    styles.push(styleLine('Hook', WHITE, { fontSize: 92, outline: 0, shadow: 0 }));
  }
  if (o.poll && Array.isArray(o.pollOptions) && o.pollOptions.length >= 2) {
    styles.push(styleLine('Poll', YELLOW, { fontSize: 66, outline: 0, shadow: 0 }));
    styles.push(styleLine('PollOpt', WHITE, { fontSize: 52, outline: 0, shadow: 0 }));
  }
  if (o.cta) styles.push(styleLine('CTA', YELLOW, { fontSize: 58, outline: 0, shadow: 0 }));
  if (o.hashtags && o.hashtags.length) {
    styles.push(styleLine('Tags', WHITE, { fontSize: 44, outline: 0, shadow: 0 }));
  }

  if (o.hook) {
    const hold = Math.min(3.4, Math.max(1.8, duration * 0.28));
    // \fad fades in/out; \fscx/\fscy with \t gives a punch-in from smaller.
    lines.push(
      `Dialogue: 0,${assTime(0)},${assTime(hold)},Hook,,0,0,0,,`
      + '{\\fad(180,140)}{\\fscx70\\fscy70\\t(0,220,\\fscx100\\fscy100)}'
      + `{\\pos(540,1240)}${assText(o.hook).slice(0, 80)}`,
    );
  }

  if (o.poll && Array.isArray(o.pollOptions) && o.pollOptions.length >= 2 && duration > 5) {
    const start = Math.max(0, duration - 3.8);
    const optsText = o.pollOptions.slice(0, 3).map((t) => `· ${assText(t).slice(0, 26)}`).join('   ');
    lines.push(
      `Dialogue: 0,${assTime(start)},${assTime(duration)},Poll,,0,0,0,,`
      + `{\\fad(200,320)}{\\pos(540,1360)}${assText(o.poll).slice(0, 90)}`,
    );
    lines.push(
      `Dialogue: 0,${assTime(start + 0.18)},${assTime(duration)},PollOpt,,0,0,0,,`
      + `{\\fad(220,320)}{\\pos(540,1470)}${optsText}`,
    );
  }

  if (o.cta) {
    const start = Math.max(0, duration - 2.6);
    lines.push(
      `Dialogue: 0,${assTime(start)},${assTime(duration)},CTA,,0,0,0,,`
      + `{\\fad(160,260)}{\\pos(540,1600)}${assText(o.cta).slice(0, 50)}`,
    );
  }

  if (o.hashtags && o.hashtags.length) {
    const start = Math.max(0, duration - 2.4);
    const tags = assText(o.hashtags.slice(0, 4).join(' ')).slice(0, 70);
    lines.push(
      `Dialogue: 0,${assTime(start)},${assTime(duration)},Tags,,0,0,0,,`
      + `{\\fad(160,240)}{\\pos(540,1690)}${tags}`,
    );
  }

  return { styles, lines };
}

module.exports = {
  assTime, buildCues, buildAss, isYellowWord, classicLine, karaokeLine,
  styleLine, assText, HEADER, EVENTS_HEADER, CUE_MAX_CHARS, WHITE, YELLOW,
};