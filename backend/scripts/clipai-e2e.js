#!/usr/bin/env node
'use strict';
/* End-to-end check of the interactive ClipAI HTTP surface against a running
 * backend (nodemon dev server on :5000). Uploads a real video, waits for the
 * job, then exercises transcript → candidates → PATCH → rerender → custom clip
 * → recopy → delete. Requires a real projectId (or "null"). */

const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'http://localhost:5000/api/clippedai';
const VIDEO = process.argv[2] || path.resolve(__dirname, '../../ClippedAI-main/website/3.mp4');
const PROJECT_ID = process.argv[3] || 'null';

async function api(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log(`  ok  ${m}`);
const assert = (c, m) => { if (!c) throw new Error(`assertion failed: ${m}`); };

(async () => {
  if (!fs.existsSync(VIDEO)) throw new Error(`video not found: ${VIDEO}`);

  const projects = await fetch('http://localhost:5000/api/projects').then((r) => r.json());
  let projectId = PROJECT_ID;
  if (projectId === 'null') {
    assert(projects.length, 'backend has no projects — create one in the UI first');
    projectId = projects[0].id;
  }
  console.log(`project: ${projectId}`);

  // 1. Upload + start the job. (Native FormData needs a Blob, not a Buffer.)
  const fd = new FormData();
  const buf = fs.readFileSync(VIDEO);
  fd.append('video', new Blob([buf], { type: 'video/mp4' }), path.basename(VIDEO));
  fd.append('projectId', projectId);
  fd.append('maxClips', '2');
  fd.append('minLen', '15');
  fd.append('maxLen', '40');
  fd.append('captionStyle', 'karaoke');
  fd.append('reframe', 'auto');
  const created = await fetch(`${BASE}/jobs`, { method: 'POST', body: fd }).then(async (r) => {
    const t = await r.text();
    if (!r.ok) throw new Error(`POST /jobs -> ${r.status} ${t.slice(0, 400)}`);
    return JSON.parse(t);
  });
  const jobId = created.id;
  console.log(`job ${jobId} created (status=${created.status})`);

  // 2. Poll to completion.
  let job = null;
  const deadline = Date.now() + 15 * 60 * 1000;
  let lastStage = '';
  while (Date.now() < deadline) {
    await sleep(4000);
    job = await api('GET', `/jobs/${jobId}`);
    if (`${job.stage}:${job.progress}` !== lastStage) {
      lastStage = `${job.stage}:${job.progress}`;
      console.log(`  [${job.status}] ${job.stage} ${job.progress}%`);
    }
    if (job.status === 'done' || job.status === 'error') break;
  }
  assert(job.status === 'done', `job ended as "${job.status}": ${job.error || 'timeout'}`);

  const t = job.transcript;
  console.log(`transcript: mode=${t.mode} provider=${t.provider} model=${t.model} `
    + `segments=${t.segments?.length} candidates=${t.candidates?.length} warning=${t.warning || 'none'}`);
  assert(t.mode !== 'heuristic', `transcript fell back to the heuristic filler (mode="${t.mode}")`);
  assert(['groq', 'openai', 'whisper'].includes(t.mode), `unexpected transcript mode "${t.mode}"`);
  assert(t.provider && t.model, 'transcript missing provider/model');
  assert(!t.warning, `transcript warning: ${t.warning}`);
  assert(t.segments?.length > 3, 'too few transcript segments');
  assert(t.candidates?.length > 1, 'no candidates stored');
  assert(t.duration > 0, 'transcript duration not stored');

  assert(job.outputs.length === 2, `expected 2 clips, got ${job.outputs.length}`);
  for (const o of job.outputs) {
    console.log(`  clip ${o.index}: ${o.startSec}-${o.endSec}s score=${o.score} style=${o.captionStyle} `
      + `reframe=${o.reframe} "${o.title}"`);
    assert(o.file && o.clipId, 'clip missing file/clipId');
    assert(o.copy?.title, 'clip missing AI copy');
    assert(o.hook && o.poll && o.cta, 'clip copy incomplete');
    const head = await fetch(`http://localhost:5000${o.file}`, { method: 'HEAD' });
    assert(head.ok, `rendered file not served: ${o.file}`);
  }
  ok('rendered clips exist and are served');

  // 3. Transcript endpoint.
  const tr = await api('GET', `/jobs/${jobId}/transcript`);
  assert(tr.hasWords, 'transcript endpoint reports no cached words');
  assert(tr.segments.length === t.segments.length, 'segment count mismatch');
  assert(tr.candidates.length, 'transcript endpoint returned no candidates');
  ok(`transcript: ${tr.segments.length} segments, ${tr.candidates.length} candidates, provider=${tr.provider}`);

  // 4. Re-score candidates with a different length window.
  const cands = await api('POST', `/jobs/${jobId}/candidates`, { minLen: 20, maxLen: 55 });
  assert(cands.candidates.length, 're-scoring returned nothing');
  ok(`re-scored ${cands.candidates.length} candidates for 20-55s`);
  console.log(`    top: ${cands.candidates[0].start_time}-${cands.candidates[0].end_time}s `
    + `"${cands.candidates[0].text.slice(0, 60)}…"`);

  // 5. Instant metadata edit (no re-render).
  const edited = await api('PATCH', `/jobs/${jobId}/clips/0`, {
    title: 'Manual Title Test', hook: 'Edited hook line', cta: 'Edited CTA',
  });
  assert(edited.title === 'Manual Title Test', 'PATCH did not change the title');
  assert(edited.hook === 'Edited hook line', 'PATCH did not change the hook');
  assert(edited.file.includes('Manual'), `file name not re-synced: ${edited.file}`);
  const afterHead = await fetch(`http://localhost:5000${edited.file}`, { method: 'HEAD' });
  assert(afterHead.ok, 'renamed file is not served after PATCH');
  ok('PATCH updated copy + renamed the file');

  // 6. Re-render with a different caption style + framing (the expensive path).
  console.log('  re-rendering clip 1 as classic/center …');
  const rerendered = await api('POST', `/jobs/${jobId}/clips/1/rerender`, {
    captionStyle: 'classic', reframe: 'center', hook: 'Rerendered hook',
  });
  const r1 = rerendered.output;
  assert(r1.captionStyle === 'classic', `style not applied: ${r1.captionStyle}`);
  assert(r1.hook === 'Rerendered hook', 'hook override not applied');
  assert(r1.reframe !== undefined, 'reframe note missing');
  const r1Head = await fetch(`http://localhost:5000${r1.file}`, { method: 'HEAD' });
  assert(r1Head.ok, `re-rendered file not served: ${r1.file}`);
  ok(`re-render ok: style=${r1.captionStyle} reframe=${r1.reframe} title="${r1.title}"`);

  // 7. Manual pick: cut an arbitrary moment the AI did not choose.
  const pick = cands.candidates[cands.candidates.length - 1];
  console.log(`  cutting manual pick ${pick.start_time}-${pick.end_time}s …`);
  const manual = await api('POST', `/jobs/${jobId}/clips`, {
    startSec: pick.start_time, endSec: pick.end_time, captionStyle: 'karaoke',
  });
  assert(manual.outputs.length === 3, `expected 3 clips after manual pick, got ${manual.outputs.length}`);
  assert(manual.output.reason === 'manually picked', 'manual pick reason not recorded');
  const mHead = await fetch(`http://localhost:5000${manual.output.file}`, { method: 'HEAD' });
  assert(mHead.ok, 'manual clip not served');
  console.log(`    "${manual.output.title}" hook="${manual.output.hook}"`);
  ok('manual clip created with AI-written copy');

  // 8. Bad range is rejected, not rendered.
  let rejected = false;
  try {
    await api('POST', `/jobs/${jobId}/clips`, { startSec: 10, endSec: 10.2 });
  } catch (e) {
    rejected = /valid in\/out range/.test(e.message);
  }
  assert(rejected, 'a 0.2s range should be rejected');
  ok('invalid in/out range rejected');

  // 9. Rewrite copy for every clip (no re-render).
  const recopied = await api('POST', `/jobs/${jobId}/recopy`);
  assert(recopied.outputs.length === 3, 'recopy lost clips');
  assert(recopied.outputs[0].copy?.title, 'recopy did not write copy');
  console.log(`    new title[0]="${recopied.outputs[0].copy.title}" title[1]="${recopied.outputs[1].copy.title}"`);
  ok('recopy rewrote titles/hooks for all clips');

  // 10. Delete a clip, indices renumber.
  const deleted = await api('DELETE', `/jobs/${jobId}/clips/1`);
  assert(deleted.outputs.length === 2, `expected 2 clips after delete, got ${deleted.outputs.length}`);
  assert(deleted.outputs.map((o) => o.index).join(',') === '1,2', 'indices not renumbered');
  ok('clip deleted and indices renumbered');

  console.log(`\njob ${jobId} passed every HTTP check — ${deleted.outputs.length} clips remain`);
  console.log(`(job left in place as ${jobId} for manual inspection)`);
})().catch((e) => { console.error('\nE2E FAIL:', e.message); process.exit(1); });
