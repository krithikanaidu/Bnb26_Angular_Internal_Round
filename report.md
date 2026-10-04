# CreatorAI — Prototype Report

**Product:** CreatorAI — AI-Powered Creator Operating Platform
**Stack:** PERN + Sequelize + Supabase (Postgres + Storage) + React/Vite
**Tagline:** idea → script → record → edit → repurpose → publish → analyze, in one app.

## 1. What we built

A working end-to-end prototype covering the full creator lifecycle. A creator can go from a raw idea to scheduled, platform-ready posts with AI help at every step — and every AI output stays editable.

**Demo flow (2 min):**
1. Dashboard → add idea → move card to `scripting`
2. Ideation page → generate hooks + full script + title/caption/hashtags/CTA
3. Assets → upload any video (demo transcript auto-seeds so the demo never stalls)
4. Studio → Align script↔footage → Generate ranked clips → AI edit → tweak JSON EDL → Save (versioned)
5. Publish → one-click Adapt to TikTok/Reels/Shorts/X → edit variants → Schedule per platform
6. Dashboard/Insights → see what worked, seed metrics if needed

## 2. Features implemented (by domain)

**Workspace & Pipeline**
- Project CRUD (`GET/POST /api/projects`, `PATCH /api/projects/:id`)
- Pipeline Dashboard board (`idea → scripted → recorded → editing → review → scheduled → published`), KPIs, recent activity
- Enforced status machine — invalid jumps return `409`

**Asset Management** (`pages/Assets.jsx`, `routes/assets.js`)
- Multi-format upload (mp4/mov/mp3/wav/png/jpg) via `multer` → Supabase Storage bucket `creator-assets` → `Asset` row
- Library with filter by project/type, size/duration/status, delete
- Automatic transcription hook (WhisperX/hosted Whisper API design); seeded demo transcript today so alignment/clips always work

**Ideation, Hooks, Scripts** (`ideation-script-hook/`, `routes/ideation.js`, `services/ideation.service.js`)
- AI Hook Generation: 5–10 hooks per topic, each with `text + category + pattern_id + strength score` (length, question/number/contrast, "you", curiosity-gap, creator-history match)
- Viral Hook Pattern Library: `HookPatterns` table seeded from `data/hookPatterns.seed.js`, used as few-shot examples
- Script Studio: full script (Hook → Problem → Value → CTA) with word budget (~2.5 wds/sec), split into weighted `beats`, inline editing, versioning
- Supporting content generated with script: title, caption, hashtags, CTA
- Live trend tags via `services/trends.service.js` (Reddit / Hacker News)

**Script↔Footage Understanding** (`pages/Studio.jsx`, `POST /api/content/align`)
- Beat-to-segment alignment with scores, gap detection (`matched ≥0.65 / weak 0.45–0.65 / gap <0.45`)
- Alignment Viewer: beats beside matched segments, color-coded, click-to-seek (`TranscriptViewer`, `Timeline`)

**Clip Generation** (`pages/ClipAI.jsx`, `POST /api/content/clips/generate`)
- Sliding-window candidates (20–60s, snapped to sentence boundaries) + overlap suppression
- Script-aware weighted score: `0.35 alignment + 0.20 hook + 0.20 energy + 0.15 length-fit + 0.10 completeness`, with plain-language reason string
- Accept / Reject / Adjust in-out points (adjust creates new EDL version)

**AI-Assisted Editing (EDL as contract)** (`components/EdlEditor, Timeline, ReviewPanel`, `POST/PATCH /api/content/edits`)
- AI proposes edit as structured JSON: `{tracks, captions, overlays, hook, cta}` with `source: ai`, `reason`, `status: pending` — see `AGENT/EDL_FORMAT.md`
- Versioned saves + revert (`edl_versions` with `parent_version`); per-operation accept/reject
- Auto captions with style presets, hook overlay (first 2–3s), CTA end-card, silence-trim ops, 9:16 crop intent
- Full-screen Video Editor (`/video-editor`, lazy-loaded — pixi/mediabunny/OpenVideo ~4MB kept out of main chunk) + `ReviewPanel` for time-coded feedback

**Multi-Platform Adaptation** (`config/platformPresets.js`, `services/adaptation.service.js`, `POST /api/content/adapt`)
- Presets for TikTok, Reels, Shorts, X (+LinkedIn): aspect, max duration, caption limits, hashtag rules, tone
- One-click clip → per-platform `PlatformVariants` (persisted rows, editable via `PATCH /variants/:id`)
- `VariantPreview` + `PlatformPicker` with char counters, safe-zone overlay, validation warnings

**Publishing & Scheduling** (`pages/Publish.jsx`, `pages/Calendar.jsx`, `POST /api/content/publish`)
- `PublishJob` queue: `queued/scheduled/running/published/failed`, polling scheduler with atomic claim
- Per-platform schedule, edit + validate, retry/cancel; one real connector + clearly-labeled simulated connectors
- Content Calendar (month/week view)

**Creator Intelligence** (`pages/Insights.jsx`)
- Metrics collection per post (views/likes/comments/shares/watch-time) + one-click seed (`POST /api/content/insights/seed`, `GET /api/content/insights`)
- Aggregates by hook category, platform, duration bucket, posting hour; lift vs. baseline; low-confidence flag under n<5

**Reliability / Demo-proofing**
- `services/llmProvider.js`: Groq > OpenAI > heuristic fallback, same JSON shape either way, `engine` returned in every response, 20s timeout + 1 retry, never 500 just because LLM failed
- `GET /api/health` reports LLM + STT providers; stuck-job recovery on boot; unhandled-rejection guards; `sequelize.sync({alter:true})` with plain-sync fallback

## 3. How we integrated it

| Layer | Choice | How it connects |
|---|---|---|
| DB + Storage | Supabase Postgres + bucket `creator-assets` | Sequelize ORM (`models/index.js`), auto-sync + idempotent `supabase/schema.sql` alters; uploads via `multer` (memory) → Storage public URL persisted in `Assets` |
| Backend | Express 4 orchestrator (`backend/src/index.js`) | `routes → services → models`; ideation mounts **before** legacy `/content` so new paths win; ClipAI mounted alongside; `/media` static for previews |
| AI | Multi-provider LLM + deterministic heuristics | `llmProvider.js` + `ai.service.js` + `content.service.js`; transcript text (not raw video) sent to LLM; JSON schema-validated |
| Frontend | React 19 + Vite + Tailwind 4 + Axios + react-router 6 | `App.jsx` routes: `/` Dashboard, `/ideation`, `/scripts`, `/assets`, `/studio`, `/clips`, `/video-editor` (lazy), `/publish`, `/insights`, `/calendar`; `hooks/useApi.js`, shared `components/` (AssetUploader, ClipList, EdlEditor, PipelineBoard, Scheduler, etc.) |
| Media | `ffmpeg-static`, `ffprobe-static`, `yt-dlp-exec`, Deepgram/OpenVideo/pixi | Render/crop/caption pipeline; editor uses `@openvideo/*` + `mediabunny` |
| Docs | `AGENT/` (12 docs: PRD, ARCHITECTURE, DATABASE, API, AI_PIPELINE, CONTENT_WORKFLOW, EDL_FORMAT, PUBLISHING, SETUP, FEATURES…) | Single source of truth; FEATURES.md tracks all 53 features (38 Must) + doc map |

## 4. How we built it (strategy)

1. **API-first, one orchestrator.** Express owns the status machine; AI/transcribe/render/publish are workers/connectors it calls. No extra stacks (no PHP DAMs, no workflow servers) — Supabase + Postgres + FFmpeg was enough.
2. **EDL is the contract.** Instead of baked black-box exports, every AI edit is versioned JSON the UI and renderer both consume. This made accept/reject, revert, and timeline editing trivial.
3. **Merge deliberately, don't just concatenate.** From 3 parallel branches we took: KRITIKA's backend + ideation/adaptation flow (newer superset), RAJAS's `AGENT/` docs, and **rejected PRACHI's UI** — it was 7/9 `ComingSoon` placeholders on React 18/router 7/Tailwind 3 (we run 19/6/4) with an `@/` alias collision and mock-only dashboard. Recorded in `MERGE_NOTES.md` with a `backup/pre-merge` tag.
4. **Graceful degradation everywhere.** Each AI stage has primary → fallback (LLM → templates, embeddings → keyword overlap, real publish → labeled simulation, real metrics → seeded metrics). The prototype is always demoable offline / without keys.
5. **Protect the critical path.** Build order: upload → transcript → alignment → clips (core intelligence) → EDL versions (editability promise) → adaptation + one real publish (end-to-end proof) → insights loop (differentiator).
6. **Integrate patterns, not apps.** WhisperX, clipper pipelines, timeline SDKs, per-network post rules used as references/libraries; verified licenses, credited in docs.

## 5. How we stand out

1. **Script-aware clipping, not blind virality.** Generic clippers pick loud moments; we score clips against the creator's own script beats + hook strength. Intent drives output.
2. **Intent → Output → Outcome graph.** Every clip stores its beat, hook `pattern_id`, edit decisions, variant, and resulting metrics. Analytics answers *why* something worked ("question hooks on Reels get 2× your average"), which feeds the next idea — competitors show numbers without causes.
3. **Editable AI (EDL contract).** AI proposes, creator disposes: per-operation accept/reject/modify, immutable versions, safe experimentation. No black-box export.
4. **One platform, full lifecycle.** Notes + drive + clipper + scheduler + analytics replaced by one pipeline with one status machine.
5. **Never-breaks demo.** Same-shape heuristic fallback + seeded transcripts/metrics + health endpoint = judges always see a working loop, with or without keys.
6. **One-click multi-platform with real validation.** Presets + editable variants + warnings (not silent truncation) = 1 video → 3+ correctly-formatted posts.

## 6. What's next (post-prototype)

Real WhisperX transcription + pgvector semantic search, FFmpeg async render jobs, speaker diarization + tracking crop, time-coded review comments, revenue tracker + brand-deal matching, next-idea recommender, MCP tool exposure, Supabase Auth + RLS workspaces.
