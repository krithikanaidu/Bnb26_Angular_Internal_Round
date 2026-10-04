// Multi-platform adaptation (AGENT/PUBLISHING.md §3, FEATURES.md Domain 7).
// One clip → per-platform variants: duration clamp, reframe note, LLM caption
// rewrite in preset tone, hashtag select/clamp, Shorts title, CTA, validation.
const PRESETS = require('../config/platformPresets');

function words(s = '') { return (s.trim() ? s.trim().split(/\s+/) : []); }

function truncateWords(text, maxChars) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > maxChars * 0.5 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}

// ---------- validation (F7.4) ----------
function validateVariant({ caption = '', title = '', hashtags = [], duration = null }, preset) {
  const warnings = [];
  // Duration is optional: skip the check when it was never measured, and flag
  // it so the creator knows the length rules could not be verified.
  if (duration == null || !Number.isFinite(duration)) {
    warnings.push({ code: 'DURATION_UNKNOWN', message: `Clip duration unknown — ${preset.label} bounds (${preset.duration.min}–${preset.duration.max}s) not verified`, fix: 'Set the clip in/out points, then re-run adapt.' });
  } else if (duration > preset.duration.max) {
    warnings.push({ code: 'DURATION_OVER', message: `Clip is ${Math.round(duration)}s but ${preset.label} caps at ${preset.duration.max}s`, fix: 'Offer auto-trim to the highest-energy window.' });
  } else if (duration < preset.duration.min) {
    warnings.push({ code: 'DURATION_UNDER', message: `Clip is ${Math.round(duration)}s, under the ${preset.duration.min}s minimum for ${preset.label}`, fix: 'Loop or extend with b-roll.' });
  }
  if (!caption) {
    warnings.push({ code: 'CAPTION_EMPTY', message: 'No caption — this clip has no hook or title to derive one from', fix: 'Add a hook in ClipAI, or write the caption manually.' });
  }
  if (caption.length > preset.caption.max_chars) {
    warnings.push({ code: 'CAPTION_OVER', message: `Caption is ${caption.length}/${preset.caption.max_chars} characters`, fix: 'Offer shorten.' });
  }
  if (preset.caption.title_max_chars && title.length > preset.caption.title_max_chars) {
    warnings.push({ code: 'TITLE_OVER', message: `Title is ${title.length}/${preset.caption.title_max_chars} characters`, fix: 'Move keywords to the front, then trim.' });
  }
  if (hashtags.length > preset.hashtags.max) {
    warnings.push({ code: 'HASHTAGS_OVER', message: `${hashtags.length} hashtags, ${preset.label} allows ${preset.hashtags.min}–${preset.hashtags.max}`, fix: 'Keep the highest-signal tags.' });
  } else if (hashtags.length < preset.hashtags.min) {
    warnings.push({ code: 'HASHTAGS_UNDER', message: `Only ${hashtags.length} hashtags, ${preset.label} wants ${preset.hashtags.min}–${preset.hashtags.max}`, fix: 'Add a niche tag.' });
  }
  return warnings;
}

// ---------- hashtags (rule 5) ----------
function selectHashtags({ baseTags = [], topicTags = [], preset }) {
  const seen = new Set();
  const out = [];
  const push = (t) => {
    if (!t) return;
    const tag = t.startsWith('#') ? t : `#${t}`;
    const k = tag.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(tag);
  };
  [...preset.hashtags.required, ...baseTags, ...topicTags].forEach(push);
  return out.slice(0, preset.hashtags.max);
}

// ---------- caption rewrite (rule 4): one LLM call for ALL platforms ----------
async function rewriteCaptionsBatch({ hookText, title, cta }, platforms) {
  // Derive from the clip's own text. If there is none, say so rather than
  // inventing a caption — an empty caption is visible and fixable, a fake one
  // looks real and ships by accident.
  const fallback = () => Object.fromEntries(platforms.map((p) => {
    const preset = PRESETS[p];
    const subject = (hookText || title || '').trim();
    if (!subject) return [p, ''];
    const base = cta ? `${subject} ${cta}` : subject;
    return [p, truncateWords(base, preset.caption.max_chars)];
  }));
  const { chatJson } = require('./llmProvider');
  const brief = platforms.map((p) => {
    const pr = PRESETS[p];
    return `- ${p}: tone "${pr.tone}", max ${pr.caption.max_chars} chars`;
  }).join('\n');
  const { engine, data } = await chatJson({
    system: 'You write short-form video post captions. Return JSON only.',
    user: `Hook: "${hookText}"\nVideo title: "${title}"\nCTA: "${cta}"\nRewrite one post caption per platform below. Plain text, no hashtags (hashtags are handled separately).\n${brief}\nReturn {"captions":{"${platforms[0]}":"..."}} with a key for every platform: ${platforms.join(', ')}.`,
    temperature: 0.7, json: true,
  });
  if (!data || typeof data.captions !== 'object') return { engine: 'heuristic', captions: fallback() };
  const captions = {};
  for (const p of platforms) {
    const preset = PRESETS[p];
    const raw = typeof data.captions[p] === 'string' && data.captions[p].trim() ? data.captions[p].trim() : fallback()[p];
    captions[p] = truncateWords(raw, preset.caption.max_chars);
  }
  return { engine, captions };
}

// ---------- reframe plan (pattern: AI-Youtube-Shorts-Generator local clipper) ----------
// That repo renders vertical shorts via ffmpeg + OpenCV face-tracked center crop.
// Render itself is out of scope (F6.9), so we emit the *plan* as data: normalized
// crop rect + the exact ffmpeg -vf string (EDL_FORMAT.md §12 mapping) that the
// future renderer will run. Stored on the variant; EDL crop uses the same shape.
function parseAspect(a = '9:16') {
  const [w, h] = String(a).split(/[:x]/).map(Number);
  return { w: w || 9, h: h || 16 };
}

function computeReframe({ sourceW = 1920, sourceH = 1080, targetAspect = '9:16', focus = 'center' } = {}) {
  const t = parseAspect(targetAspect);
  const targetRatio = t.w / t.h;
  const srcRatio = sourceW / sourceH;
  let cropW, cropH, x, y;
  if (srcRatio > targetRatio) {
    // source wider → pillar crop (e.g. 16:9 → 9:16): full height, centered width
    cropH = sourceH; cropW = Math.round(sourceH * targetRatio);
    x = Math.round((sourceW - cropW) / 2); y = 0;
  } else {
    // source taller → letter crop: full width, centered height
    cropW = sourceW; cropH = Math.round(sourceW / targetRatio);
    x = 0; y = Math.round((sourceH - cropH) / 2);
  }
  const outW = t.w === 9 && t.h === 16 ? 1080 : t.w === 1 && t.h === 1 ? 1080 : 1280;
  const outH = Math.round(outW / targetRatio);
  return {
    source: `${sourceW}x${sourceH}`, target: targetAspect, focus,
    crop: { x, y, w: cropW, h: cropH },
    normalized: { x: +((x + cropW / 2) / sourceW).toFixed(3), y: +((y + cropH / 2) / sourceH).toFixed(3), zoom: 1.0 },
    ffmpeg: `crop=${cropW}:${cropH}:${x}:${y},scale=${outW}:${outH}`,
    note: focus === 'speaker'
      ? 'Face/speaker-tracked crop at render time (OpenCV tracking, motion-smoothed).'
      : 'Center crop at render time; switch focus to speaker for talking-head footage.',
  };
}
// ---------- Shorts title (rule 6) ----------
function buildTitle({ title, hookText, platform }) {
  const preset = PRESETS[platform];
  // No title anywhere → no title. Do not fall back to a placeholder string.
  const raw = (title || hookText || '').trim();
  if (!preset.caption.title_max_chars || !raw) return '';
  return truncateWords(raw.replace(/\s*[🔥✨🚀]+\s*/g, ' ').trim(), preset.caption.title_max_chars);
}

// ---------- EDL helpers ----------
// The EDL (EDL_FORMAT.md) is the editable edit plan from Studio. Adaptation
// READS the clip's latest EDL but never writes it: CTA text, caption style and
// existing crop focus flow into the variants. Re-running adapt after a Studio
// edit automatically picks up the new version — that is the dynamic link.
function edlText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  return node.text || '';
}

function readEdl(edl = {}) {
  const tracks = Array.isArray(edl.tracks) ? edl.tracks : [];
  const videoTrack = tracks.find((t) => t.kind === 'video' || t.type === 'video');
  const segWithCrop = (videoTrack?.segments || []).find((s) => s.crop);
  const captions = Array.isArray(edl.captions) ? edl.captions : [];
  return {
    cta: edlText(edl.cta),
    hook: edlText(edl.hook),
    captionStyle: edl.meta?.caption_style || captions.find((c) => c.style)?.style || '',
    captionCount: captions.length,
    cropFocus: segWithCrop?.crop?.focus || 'center',
    frame: edl.frame || null,
  };
}

// ---------- full adaptation (rules 1–8) ----------
async function adaptMany(clip, platforms, opts = {}) {
  const valid = platforms.filter((p) => PRESETS[p]);
  // Real clip bounds only. A null/absent bound means we genuinely do not know
  // the duration, so it stays null and validation is skipped rather than
  // inventing a 30s clip and warning about a trim that may not be needed.
  const hasBounds = Number.isFinite(clip.startSec) && Number.isFinite(clip.endSec);
  const duration = hasBounds ? clip.endSec - clip.startSec : null;
  const hookText = (clip.hookText || clip.title || '').trim();
  const edl = opts.edlInfo || {};
  const cta = opts.cta || edl.cta || presetCtaDefault(valid);
  const { engine, captions } = await rewriteCaptionsBatch(
    { hookText, title: clip.title || '', cta }, valid);
  return valid.map((platform) => {
    const preset = PRESETS[platform];
    const caption = captions[platform];
    const title = buildTitle({ title: clip.title, hookText, platform });
    const hashtags = selectHashtags({
      baseTags: [...(clip.hashtags || []), ...(opts.baseTags || [])],
      topicTags: [...(opts.topicTags || []), `#${platform}`],
      preset,
    });
    const captionStyle = edl.captionStyle || preset.caption_style;
    const reframe = computeReframe({
      sourceW: opts.sourceW || edl.frame?.width || 1920,
      sourceH: opts.sourceH || edl.frame?.height || 1080,
      targetAspect: preset.aspect,
      focus: edl.cropFocus || 'center',
    });
    const warnings = validateVariant({ caption, title, hashtags, duration }, preset);
    const actions = [];
    if (duration == null) actions.push('Duration unknown — set in/out points before trimming');
    else if (duration > preset.duration.max) actions.push(`Trim ${duration.toFixed(0)}s → ${preset.duration.max}s (keep highest-energy window)`);
    actions.push(`Reframe ${reframe.source} → ${preset.aspect} (${reframe.focus} crop: ${reframe.ffmpeg})`);
    actions.push(`Caption in ${preset.tone} tone, style ${captionStyle}`);
    if (edl.captionCount) actions.push(`Carries ${edl.captionCount} timed captions from EDL v${opts.edlVersion ?? '?'} (repositioned to safe zone)`);
    return {
      clip_id: clip.id, platform, aspect: preset.aspect,
      duration: duration == null ? null : +duration.toFixed(1),
      title, caption, hashtags, cta, captionStyle, reframe,
      edlVersion: opts.edlVersion ?? null,
      warnings, actions,
      status: warnings.some((w) => ['DURATION_OVER', 'CAPTION_OVER', 'DURATION_UNKNOWN', 'CAPTION_EMPTY'].includes(w.code)) ? 'needs_attention' : 'ready',
      engine,
    };
  });
}

// The CTA comes from a platform preset, not from thin air. That is a config
// default, not a fabricated measurement — but it is still only applied when the
// caller has not supplied one.
function presetCtaDefault(platforms) {
  return (platforms.length && PRESETS[platforms[0]].cta_default) || '';
}

module.exports = { PRESETS, validateVariant, selectHashtags, rewriteCaptionsBatch, buildTitle, computeReframe, readEdl, adaptMany, presetCtaDefault };
