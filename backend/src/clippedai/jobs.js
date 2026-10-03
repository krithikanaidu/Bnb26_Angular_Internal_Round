// ClipAI job queue: one job at a time (long ffmpeg/whisper work),
// progress persisted on the ClipJob row so the UI can poll.
'use strict';

const fs = require('fs');
const path = require('path');
const { transcribe } = require('./transcribe');
const { selectClips } = require('./score');
const { renderOne } = require('./pipeline');
const { rankMoments, writeClipCopy } = require('./ai');
const { probeDuration } = require('./ffmpeg');
const { download: downloadYouTube } = require('./youtube');

let Clip; // lazy (models may not be loaded in unit tests)
let ClipJob;
function models() {
  if (!ClipJob) ({ Clip, ClipJob } = require('../models'));
  return { Clip, ClipJob };
}

const MEDIA_ROOT = path.join(__dirname, '..', '..', 'media', 'clippedai');

let running = false;
const waiting = [];

async function setProgress(job, stage, progress, extra = {}) {
  try {
    // Persist progress. `outputs` is deliberately NOT written from inside the render
    // loop: those partial writes race each other and the last one to land wins,
//    which silently truncated the finished list to a single clip. It is written
    // exactly once, at the end.
    await job.update({ status: stage, stage, progress, ...extra });
  } catch (e) {
    console.warn('[clipai] progress update failed:', e.message);
  }
}

/** Default options, overridable per job from the request. */
function resolveOptions(job) {
  return {
    maxClips: 4,
    minLen: 20,
    maxLen: 60,
    subtitles: true,
    portrait: true,
    captionStyle: 'karaoke',
    reframe: 'auto',
    ...(job.options || {}),
  };
}

async function processJob(jobId) {
  const { Clip: ClipModel, ClipJob: JobModel } = models();
  const job = await JobModel.findByPk(jobId);
  if (!job) return;
  const options = resolveOptions(job);
  const jobDir = path.join(MEDIA_ROOT, job.id);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    // 0. YouTube source? Download first (progress 0–4%).
    if (!job.sourcePath && job.options && job.options.youtubeUrl) {
      await setProgress(job, 'downloading', 1);
      const outPath = path.join(jobDir, 'source.mp4');
      await downloadYouTube(job.options.youtubeUrl, outPath, (pct) => {
        job.progress = Math.round((pct / 100) * 4);
        job.changed('progress', true);
        job.save({ fields: ['progress'] }).catch(() => {});
      });
      await job.update({ sourcePath: outPath, sourceName: job.sourceName || 'YouTube video' });
      job.sourcePath = outPath;
    }
    if (!job.sourcePath || !fs.existsSync(job.sourcePath)) {
      throw new Error('Source video is missing — re-upload or re-paste the link.');
    }

    // 1. Transcribe (cached per job dir). This is the step that must be real:
    //    everything downstream is derived from these word timings.
    await setProgress(job, 'transcribing', 5);
    const transcript = await transcribe(job.sourcePath, jobDir, (fraction) => {
      job.progress = Math.round(5 + fraction * 25);
      job.changed('progress', true);
      job.save({ fields: ['progress'] }).catch(() => {});
    });
    const transcriptMetaBase = {
      mode: transcript.mode,
      provider: transcript.provider,
      model: transcript.model,
      segments: transcript.segments,
      warning: transcript.warning || null,
    };
    await setProgress(job, 'transcribing', 30, { transcript: transcriptMetaBase });
    if (transcript.warning) console.warn(`[clipai] job ${job.id}: ${transcript.warning}`);

    // 2. Find + score candidate moments, then let the LLM pick the winners.
    await setProgress(job, 'finding', 36);
    const maxClips = Math.max(1, Math.min(12, options.maxClips));
    const candidates = selectClips(transcript, {
      minLen: options.minLen,
      maxLen: options.maxLen,
      maxClips,
    });
    if (!candidates.length) throw new Error('No engaging clips found — try a longer video or wider duration range.');

    const ranked = await rankMoments(candidates, maxClips);
    const selected = (ranked || candidates).slice(0, maxClips);
    if (!selected.length) throw new Error('No engaging clips found — try a longer video or wider duration range.');

    await setProgress(job, 'finding', 40, { transcript: transcriptMetaBase });
    const duration = transcript.duration || await probeDuration(job.sourcePath);
    const transcriptMeta = {
      ...transcriptMetaBase,
      duration,
      candidates: candidates.slice(0, 12),
    };

    // 3. Write the packaging copy, then render each clip.
    const outputs = [];
    for (let i = 0; i < selected.length; i += 1) {
      await setProgress(job, 'titling', 41 + Math.round((i / selected.length) * 4));
      const clip = selected[i];
      const copy = await writeClipCopy({
        text: clip.text || '',
        duration: clip.end_time - clip.start_time,
        index: i,
      });

      await setProgress(job, 'rendering', 45 + Math.round((i / selected.length) * 44));
      const out = await renderOne({
        Clip: ClipModel,
        job,
        words: transcript.words,
        clip: { ...clip, title: copy.title },
        index: i,
        jobDir,
        options,
        overrides: {
          title: copy.title,
          hook: copy.hook,
          poll: copy.pollQuestion,
          pollOptions: copy.pollOptions,
          cta: copy.cta,
          hashtags: copy.hashtags,
        },
      });
      outputs.push(out);
      job.changed('outputs', true);
    }

    await setProgress(job, 'done', 100, {
      status: 'done',
      outputs,
      transcript: transcriptMeta,
    });
    console.log(`[clipai] job ${job.id} done: ${outputs.length} clips (${transcript.mode} transcript)`);
  } catch (e) {
    console.error(`[clipai] job ${job.id} failed:`, e.message);
    await setProgress(job, 'error', 0, { status: 'error', error: String(e.message || e).slice(0, 2000) });
  } finally {
    running = false;
    const next = waiting.shift();
    if (next) {
      running = true;
      setImmediate(() => processJob(next).catch((e) => console.error('[clipai] worker failed:', e)));
    }
  }
}

function enqueue(jobId) {
  if (!running) {
    running = true;
    setImmediate(() => processJob(jobId).catch((e) => { console.error('[clipai] worker failed:', e); running = false; }));
  } else {
    waiting.push(jobId);
  }
}

/** On boot: stuck jobs from a crash → error (honest, re-runnable). */
async function recoverStuckJobs() {
  try {
    const { ClipJob: JobModel } = models();
    const stuck = await JobModel.findAll({ where: { status: ['queued', 'downloading', 'transcribing', 'finding', 'rendering', 'titling'] } });
    for (const job of stuck) {
      await job.update({ status: 'error', stage: 'error', error: 'Server restarted mid-render — please re-run.' });
    }
    if (stuck.length) console.log(`[clipai] marked ${stuck.length} stuck job(s) as error`);
  } catch (e) {
    console.warn('[clipai] recovery skipped:', e.message);
  }
}

module.exports = { enqueue, recoverStuckJobs, MEDIA_ROOT, resolveOptions };