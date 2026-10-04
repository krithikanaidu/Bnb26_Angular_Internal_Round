# CreatorAI — AI Creator Operating Platform

**One app to go from a raw idea to a published, multi-platform video.**

CreatorAI takes you through the whole creator workflow in one place:

> **Idea → Hooks → Script → Footage → Transcript → Clips → Edit → Publish → Learn**

Everything you see in the app comes from your own data or from a real AI engine.
There is **no demo data, no fake captions, and no made-up statistics** anywhere in this project.

---

## Table of Contents

1. [What the App Does](#1-what-the-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Setup (Step by Step)](#5-setup-step-by-step)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [How the App Works (Architecture)](#7-how-the-app-works-architecture)
8. [Page Guide](#8-page-guide)
9. [API Reference](#9-api-reference)
10. [The ClipAI Pipeline](#10-the-clipai-pipeline)
11. [AI Engines & Fallbacks](#11-ai-engines--fallbacks)
12. [Tests, Builds & Useful Commands](#12-tests-builds--useful-commands)
13. [Troubleshooting](#13-troubleshooting)
14. [Project Rules (Please Read)](#14-project-rules-please-read)

---

## 1. What the App Does

| Stage | What happens | Page |
|---|---|---|
| **Idea** | Capture a topic, pick your niche and tone | `/ideation` |
| **Hooks** | Generate 8–12 ranked opening hooks for that topic | `/ideation` |
| **Script** | Turn the chosen hook into a full structured script | `/ideation`, `/scripts` |
| **Beats** | Split the script into timestamped beats for editing | `/ideation` |
| **Assets** | Upload video / audio / images (stored in Supabase Storage) | `/assets` |
| **Transcript** | Real speech-to-text transcription of your footage | `/clips`, `/video-editor` |
| **ClipAI** | Auto-find the best moments, score them, and render vertical clips | `/clips` |
| **Studio** | Align script to transcript, edit the EDL, version your cuts | `/studio` |
| **Edit** | Full in-browser timeline video editor | `/video-editor` |
| **Adapt** | Re-cut one clip for TikTok / Reels / Shorts / X | `/publish` |
| **Publish** | Schedule or draft every platform version | `/publish`, `/calendar` |
| **Learn** | Real performance insights from your published jobs | `/insights`, `/` |

---

## 2. Tech Stack

**Backend**
- **Node.js + Express** — REST API on port `5000`
- **Sequelize** — ORM for Postgres
- **Supabase Postgres** — the database (Supabase-only, no local Postgres)
- **Supabase Storage** — bucket `creator-assets` for uploaded media
- **ffmpeg / ffprobe** — bundled through npm (`ffmpeg-static`, `ffprobe-static`)
- **yt-dlp** — bundled through `yt-dlp-exec` (for YouTube imports)

**Frontend**
- **React 19** + **Vite 5**
- **React Router 6** — all pages
- **Tailwind CSS 4**
- **Radix UI / shadcn-style components**, Framer Motion, Lucide-style icons
- **@openvideo + PixiJS + mediabunny** — the timeline video editor (lazy-loaded)

**AI (optional but recommended)**
- **Groq** (`gsk_…`) — free tier, fast. Used for copy, hooks, titles, transcription
- **OpenAI** (`sk-…`) — Whisper transcription + copy
- **Heuristic engine** — deterministic offline generator so the app never hard-fails

---

## 3. Project Structure

```
bit and build/
├── backend/                     # Express API (Node, CommonJS)
│   ├── .env                     # your secrets — gitignored, never commit
│   ├── .env.example             # template for .env
│   ├── media/                   # rendered clips served at /media/*
│   ├── scripts/                 # test + maintenance scripts
│   └── src/
│       ├── index.js             # server entry, route mounting, /api/health
│       ├── config/
│       │   ├── database.js      # Sequelize (Supabase-only, throws without DATABASE_URL)
│       │   └── supabase.js      # Storage client + ensureBucket()
│       ├── models/              # Project, Asset, Script, Hook, Clip, Edit,
│       │                        # PublishJob, TranscriptSegment, PlatformVariant, ClipJob…
│       ├── routes/              # projects, assets, ideation, content, clippedai
│       ├── services/            # ideation, adaptation, trends, ai, llmProvider
│       ├── clippedai/           # the ClipAI engine
│       │   ├── ffmpeg.js        # loudness, silence detect, extract audio, frame sampling
│       │   ├── transcribe.js    # real Whisper STT + caption scrubbing
│       │   ├── analyze.js       # moment detection
│       │   ├── rank.js / score.js# moment + clip scoring (CLIPAI_SCORE_WEIGHTS)
│       │   ├── ai.js            # clip copy (hook / poll / CTA)
│       │   ├── titles.js        # viral titles
│       │   ├── reframe.js       # auto-reframe to 9:16
│       │   ├── captions.js      # burned-in captions
│       │   ├── jobs.js          # job queue + stuck-job recovery
│       │   ├── keys.js          # provider key resolution
│       │   └── schema.js        # ensureClipAiSchema()
│       └── data/hookPatterns.seed.js
│
├── frontend/                    # React app (Vite, ES modules)
│   ├── .env                     # frontend config — gitignored
│   ├── .env.example
│   └── src/
│       ├── main.jsx / App.jsx   # routes
│       ├── styles.css           # design tokens (scoped .layout rules)
│       ├── lib/api.js           # shared axios instance
│       ├── components/          # Layout, AssetUploader, shared UI
│       ├── pages/               # Dashboard, Assets, Scripts, Studio,
│       │                        # Publish, ClipAI, Insights, Calendar, VideoEditor
│       ├── ideation-script-hook/  # the 4-stage idea→script workflow
│       ├── clippedai/           # ClipAI client API + components
│       └── video-editor/        # ported timeline editor (own @ alias + shims)
│
├── supabase/schema.sql          # full schema + idempotent ALTER migrations
├── AGENT/                       # detailed design / API / pipeline docs
└── MERGE_NOTES.md               # what was merged from which branch, and why
```

---

## 4. Prerequisites

You need these **before** you start:

| Requirement | Why | Notes |
|---|---|---|
| **Node.js 18+** (20 or 22 recommended) | runs backend + frontend | check with `node -v` |
| **npm** | installs packages | ships with Node |
| **A Supabase account** | the database + file storage | free tier is enough |
| **A Groq API key** *(recommended)* | AI copy + free transcription | `gsk_…`, free tier |
| **An OpenAI API key** *(optional)* | Whisper transcription + copy | `sk-…`, paid |

You **do not** need to install ffmpeg or yt-dlp — they come from npm automatically.

---

## 5. Setup (Step by Step)

### Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Wait for the database to finish provisioning.

### Step 2 — Get your keys

In Supabase → **Project Settings**:

| Where | What to copy | Env variable |
|---|---|---|
| Database → Connection string → **Transaction pooler** (`:6543`) | connection URL | `DATABASE_URL` |
| API | Project URL | `SUPABASE_URL` |
| API → service_role | service role key | `SUPABASE_SERVICE_KEY` |

Use the **Transaction pooler (`:6543`)** URL. The backend always connects with SSL, so both `:6543` and `:5432` work.

### Step 3 — Create the tables

1. Open Supabase → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. Click **Run**.

This creates every table, plus safe `ALTER TABLE ... IF NOT EXISTS` statements so re-running it on an existing database is harmless.

> The backend also runs `sequelize.sync()` at boot as a safety net, but **always run the schema file once** — `sync({alter:true})` cannot reliably add columns to tables that already hold data.

### Step 4 — Storage bucket

The backend creates the public bucket `creator-assets` automatically at startup (`ensureBucket()` in `backend/src/config/supabase.js`). You can also create it by hand in Supabase → **Storage** and mark it **public**.

### Step 5 — Backend

```bash
cd backend

# Windows PowerShell
Copy-Item .env.example .env
# macOS / Linux
# cp .env.example .env

npm install
```

Open `backend/.env` and fill in:

```env
PORT=5000
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=creator-assets

AI_PROVIDER=heuristic
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=gsk_your_key_here
FRONTEND_URL=http://localhost:5173
```

Then start it:

```bash
npm run dev        # nodemon, restarts on change → http://localhost:5000
```

Verify it worked:

```bash
curl http://localhost:5000/api/health
```

You should see something like:

```json
{
  "ok": true,
  "service": "creatorai-backend",
  "ai": "groq",
  "model": "openai/gpt-oss-20b",
  "engines": { "whisper": true, "stt": { "name": "groq", "model": "whisper-large-v3-turbo" }, "copy": "groq", "titles": "groq", "trends": "groq", "reframe": "auto" },
  "scoreWeights": { "engagement": 0.28, "cohesion": 0.24, "hook": 0.24, "speech": 0.14, "opener": 0.1 }
}
```

If `engines.whisper` is `false`, transcription is unavailable and ClipAI will tell you instead of inventing captions.

### Step 6 — Frontend

```bash
cd frontend

# Copy-Item .env.example .env     (Windows PowerShell)
# cp .env.example .env           (macOS / Linux)

npm install
npm run dev                      # → http://localhost:5173
```

Open **http://localhost:5173**.

> The frontend calls the backend directly at `VITE_API_URL` (no dev proxy). The backend allows CORS from `FRONTEND_URL`, so keep both consistent.

---

## 6. Environment Variables Reference

### `backend/.env`

| Variable | Required | Default | What it does |
|---|:--:|---|---|
| `PORT` | no | `5000` | Backend HTTP port |
| `DATABASE_URL` | **yes** | — | Supabase Postgres connection string. **Startup fails without it** |
| `SUPABASE_URL` | **yes** | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | **yes** | — | `service_role` key — server only, never commit |
| `SUPABASE_BUCKET` | no | `creator-assets` | Storage bucket for uploads |
| `AI_PROVIDER` | no | auto | `groq` \| `openai` \| `heuristic` \| `none` |
| `OPENAI_API_KEY` | no | — | `sk-…`. Also used for Whisper transcription |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | OpenAI chat model |
| `GROQ_API_KEY` | no | — | `gsk_…`. Used for copy + whisper-large-v3-turbo |
| `GROQ_MODEL` | no | `openai/gpt-oss-20b` | Groq chat model for hooks/scripts/adaptation/trends |
| `CLIPAI_GROQ_MODEL` | no | `openai/gpt-oss-20b` | Groq chat model for ClipAI ranking + titles |
| `FRONTEND_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `CLIPAI_MIN_CLIP_SEC` | no | `45` | Shortest clip ClipAI will cut |
| `CLIPAI_MAX_CLIP_SEC` | no | `120` | Longest clip ClipAI will cut |
| `CLIPAI_PRESET` | no | `veryfast` | ffmpeg encode preset |
| `CLIPAI_CRF` | no | `20` | ffmpeg quality (lower = better) |
| `CLIPAI_WHISPER_MODEL` | no | `whisper-1` | OpenAI transcription model |
| `CLIPAI_GROQ_WHISPER_MODEL` | no | `whisper-large-v3-turbo` | Groq transcription model |
| `CLIPAI_LANGUAGE` | no | `auto` | Force a transcription language instead of auto-detect |
| `CLIPAI_STT_PROMPT` | no | — | Bias/hint passed to Whisper for better punctuation and names |
| `CLIPAI_STT_CHUNK_SEC` | no | `600` | Audio chunk length for long uploads |
| `YOUTUBE_API_KEY` | no | — | Real YouTube trend signals in `/content/trends` (falls back to a labeled heuristic source) |
| `CLIPAI_FFMPEG_PATH` | no | bundled | Use a system ffmpeg instead |
| `CLIPAI_FFPROBE_PATH` | no | bundled | Use a system ffprobe instead |
| `CLIPAI_YTDLP_PATH` | no | bundled | Use a system yt-dlp instead |
| `CLIPAI_YT_MAX_MIN` | no | `120` | Refuse YouTube videos longer than this (`0` = unlimited) |

### `frontend/.env`

| Variable | Required | Default | What it does |
|---|:--:|---|---|
| `VITE_API_URL` | no | `http://localhost:5000/api` | Backend API base URL |
| `VITE_R2_BUCKET_NAME` | no | — | Cloudflare R2 / S3 bucket for the Video Editor |
| `VITE_R2_ACCESS_KEY_ID` | no | — | R2 access key |
| `VITE_R2_SECRET_ACCESS_KEY` | no | — | R2 secret |
| `VITE_R2_ACCOUNT_ID` | no | — | R2 account id |
| `VITE_R2_PUBLIC_DOMAIN` | no | — | Public domain for R2 URLs |
| `VITE_DEEPGRAM_API_KEY` | no | — | Deepgram STT inside the Video Editor |
| `VITE_DEEPGRAM_URL` | no | `https://api.deepgram.com/v1` | Deepgram endpoint |
| `VITE_DEEPGRAM_MODEL` | no | `nova-2` | Deepgram model |
| `VITE_PEXELS_API_KEY` | no | — | Pexels stock media library |

The Video Editor keys are all optional — the editor still opens and plays local/remote media without them.

---

## 7. How the App Works (Architecture)

```
┌──────────────────────────┐
│  React 19 + Vite (:5173) │
│  pages / ideation /      │
│  video-editor            │
└────────────┬─────────────┘
             │  axios  (VITE_API_URL)
             │  JSON / multipart
┌────────────▼─────────────┐
│  Express API  (:5000)    │
│  routes/ → services/ →   │
│  models/ (Sequelize)     │
└──────┬───────────┬───────┘
       │           │
┌──────▼─────┐ ┌───▼──────────────────┐
│ Supabase   │ │ ClipAI engine        │
│ Postgres   │ │ ffmpeg · Whisper STT │
│ + Storage  │ │ scoring · reframe    │
└────────────┘ └──────────────────────┘
```

**Request flow, step by step:**

1. A React page calls `api.get('/content/insights')` using the shared axios instance (`frontend/src/lib/api.js`).
2. Express route in `backend/src/routes/` validates the request.
3. The route calls a service in `backend/src/services/` for any AI work (copy, adaptation, trends).
4. Services resolve an AI engine through `llmProvider` / `keys` — real provider if a key exists, otherwise a deterministic heuristic.
5. Sequelize reads/writes Postgres. Media lives in Supabase Storage; rendered clips live in `backend/media/` and are served at `/media/*`.
6. The route returns real JSON. The page renders it, or shows a real loading/error/empty state.

**Two AI resolvers:**

| Resolver | Used for | Order |
|---|---|---|
| `services/llmProvider.js` | hooks, scripts, copy, adaptation, trends, titles | Groq → OpenAI → heuristic |
| `clippedai/keys.js` | speech-to-text | OpenAI Whisper → Groq whisper-large-v3-turbo → none |

Both report their real state through `GET /api/health`, which the UI reads to show which engine is actually live.

---

## 8. Page Guide

### `/` — Dashboard
Create a project, move it through `idea → scripting → recording → editing → published`, and see real insight totals pulled from `/api/content/insights`.

### `/ideation` — Idea → Hooks → Script → Beats
The 4-stage workflow:
1. **Idea** — topic, niche, tone, audience.
2. **Hooks** — ranked hooks with category labels and deterministic strength scores. Pick one.
3. **Script** — full structured script from your hook; edit the text inline (each save bumps `version`).
4. **Beats** — timestamped beats for aligning to footage.

### `/scripts` — Quick scripts
Generate hooks and a script for a topic without the full pipeline. Lists everything saved in the database.

### `/assets` — Media library
Upload video / audio / images. For each file the backend runs **ffprobe** and stores the *measured* duration, dimensions, codec and audio presence — never a guessed number. Shows the public URL and transcript segments once real transcription exists.

### `/clips` — ClipAI
The automatic clip factory. See [section 10](#10-the-clipai-pipeline).

### `/studio` — Alignment & EDL
- **Align** script beats to real transcript segments and spot gaps.
- **Generate clips** ranked by the real ClipAI score.
- **AI edit** → produces an editable EDL `{tracks, captions, overlays, hook, cta}`.
- Edit the EDL JSON, save → stored as a new **version**. You always own the final cut.

### `/video-editor` — Full timeline editor
Lazy-loaded (keeps ~4 MB of Pixi/mediabunny out of the main bundle). Full-screen editor with its own header, panels and timeline, using the `@` alias and framework shims in `frontend/vite.config.js`.

### `/publish` — Adapt & schedule
Pick a clip → generate platform variants for TikTok / Reels / Shorts / X (aspect ratio + safe zones from the API) → schedule each one with its own caption and time, or save as draft. Retry failed jobs, delete drafts.

### `/calendar` — Publishing calendar
Every publish job on a month grid with its real status: `draft`, `scheduled`, `published`, `failed`.

### `/insights` — Performance
KPIs, per-platform series, and production patterns **computed from your own published jobs**. If there is no data yet, it says so instead of showing made-up numbers.

---

## 9. API Reference

Base URL: `http://localhost:5000/api`

### System

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Engine status, model names, real score weights |

### Projects

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/projects` | List projects |
| `POST` | `/projects` | Create a project |
| `GET` | `/projects/:id` | One project |
| `PATCH` | `/projects/:id` | Update (e.g. workflow status) |
| `DELETE` | `/projects/:id` | Delete |

### Assets

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/assets` | List assets |
| `POST` | `/assets/upload` | Upload (multipart `file`) → Storage + ffprobe metadata |
| `DELETE` | `/assets/:id` | Delete |

### Ideation (`/api` and `/api/content`)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/hook-patterns` | Hook pattern templates (`?category=`) |
| `POST` | `/hooks/generate` | `{ topic, tone, count, niche, project_id }` → `{ engine, hooks[] }` |
| `POST` | `/scripts/generate` | `{ hook_id \| hook, topic, tone, length_sec, project_id }` |
| `GET` | `/scripts` | List scripts (`?projectId=` or `?project_id=`) |
| `PATCH` | `/scripts/:id` | Edit script → version bump |
| `POST` | `/scripts/:id/beats` | Re-split beats |

### Content

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/content/generate-hooks` | Quick hooks |
| `POST` | `/content/generate-script` | Quick script |
| `GET` | `/content/scripts` | List scripts |
| `POST` | `/content/align` | `{ scriptBody, assetId \| projectId }` → beat↔transcript alignment |
| `POST` | `/content/clips/generate` | Ranked clip suggestions |
| `GET` | `/content/clips` | List clips |
| `POST` | `/content/edits` | Create EDL for a clip |
| `GET` | `/content/edits` | List EDLs |
| `PATCH` | `/content/edits/:id` | Save new EDL version |
| `POST` | `/content/adapt` | `{ clipId, platforms[] }` → per-platform variants |
| `GET` | `/content/trends` | Trend signal for a topic/niche |
| `GET` | `/content/clips/:id/variants` | Stored platform variants |
| `PATCH` | `/content/variants/:id` | Edit a variant |
| `POST` | `/content/publish` | Schedule or draft a publish job |
| `GET` | `/content/publish` | List publish jobs |
| `POST` | `/content/publish/:id/retry` | Retry a failed job |
| `DELETE` | `/content/publish/:id` | Delete a job |
| `GET` | `/content/insights` | Real performance insights |

### ClipAI (`/api/clippedai`)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/inspect` | Probe a media file before creating a job |
| `POST` | `/jobs` | Create a clip job (multipart `video`, or a source URL) |
| `GET` | `/jobs` | List jobs |
| `GET` | `/jobs/:id` | One job |
| `DELETE` | `/jobs/:id` | Delete a job |
| `GET` | `/jobs/:id/transcript` | Real transcript segments |
| `POST` | `/jobs/:id/candidates` | Detect + rank moments |
| `POST` | `/jobs/:id/clips` | Render selected candidates |
| `PATCH` | `/jobs/:id/clips/:index` | Edit clip timing / copy |
| `POST` | `/jobs/:id/clips/:index/rerender` | Re-render with current settings |
| `POST` | `/jobs/:id/recopy` | Regenerate clip copy |
| `DELETE` | `/jobs/:id/clips/:index` | Delete a clip |

### Static

| Path | Purpose |
|---|---|
| `/media/*` | Rendered shorts, for preview and download |

---

## 10. The ClipAI Pipeline

ClipAI turns one long video into several ready-to-post vertical clips.

```
upload / URL
   │
   ├─ 1. INSPECT      ffprobe → duration, streams, resolution, audio presence
   │
   ├─ 2. AUDIO CHECK  ffmpeg volumedetect → mean/max volume
   │                 · digital silence + no audio → stop with a clear message
   │                 · loudness unreadable      → continue anyway (never blocks)
   │
   ├─ 3. EXTRACT      16 kHz mono WAV for speech-to-text
   │
   ├─ 4. TRANSCRIBE   real Whisper STT → timestamped segments
   │                 · filler words ("umm", "uh") are scrubbed out
   │                 · no STT key → explicit error, NEVER invented captions
   │
   ├─ 5. ANALYZE      speech density, motion, audio energy, hook signals
   │
   ├─ 6. RANK         weighted score → best moments first
   │                 engagement .28 · cohesion .24 · hook .24 · speech .14 · opener .10
   │
   ├─ 7. COPY         hook / poll / CTA + viral titles (skip filler-only ranges)
   │
   ├─ 8. RENDER       auto-reframe to 9:16, burn captions, encode
   │
   └─ 9. STORE        clip rows + files, then appear in Studio and Publish
```

**Scoring weights** live in `backend/src/clippedai/score.js` as `CLIPAI_SCORE_WEIGHTS`, are served by `/api/health`, and always sum to `1`. The UI shows these real values instead of guessing.

**Jobs** are persisted in `ClipJob`, so restarting the backend does not lose them. Jobs stuck in `processing` are recovered automatically at boot (`recoverStuckJobs()`).

---

## 11. AI Engines & Fallbacks

The app never crashes because a key is missing, and it never pretends a fallback is a real result.

| Feature | With a key | Without a key |
|---|---|---|
| Hooks / scripts / titles / adaptation / trends | Groq or OpenAI | Deterministic heuristic built from **your topic** — clearly reported as `engine: "heuristic"` |
| Transcription (ClipAI) | Whisper (OpenAI or Groq) | Job stops with a clear error. **Captions are never invented** |
| Silence / loudness | ffmpeg `volumedetect` | Same — bundled, always available |
| Scoring / ranking | Real signals from your media | Same — computed from actual audio/video |

Check what is actually live any time:

```bash
curl http://localhost:5000/api/health
```

The left sidebar reads the same endpoint and shows the true engine names.

---

## 12. Tests, Builds & Useful Commands

### Backend

```bash
cd backend

npm run dev                  # nodemon dev server
npm start                    # plain node server
npm run db:sync              # create/sync tables only

node --check src/index.js    # syntax check a single file

# ClipAI test suites
node scripts/clipai.test.js         # core pipeline + silence/loudness regression
node scripts/clipai-stt-test.js     # live speech-to-text check (needs a real key)
node scripts/clipai-e2e.js          # full job → clips run
node scripts/clipai-live-test.js    # live provider check
node scripts/clipai-smoke.js        # quick smoke test
node scripts/clipai-rankcheck.js    # ranking/scoring output
node scripts/clipai-dbcheck.js      # verify ClipAI tables exist
node scripts/clipai-migrate.js      # add missing ClipAI columns
node scripts/db-inspect.js          # dump tables/columns
```

### Frontend

```bash
cd frontend

npm run dev        # dev server on :5173
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

### Check every backend file parses

```bash
cd backend
Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
```

---

## 13. Troubleshooting

**Backend exits immediately with `DATABASE_URL is required`**
Copy `backend/.env.example` → `backend/.env` and paste your Supabase **Transaction pooler (`:6543`)** URL. There is no localhost fallback by design.

**`[fatal] Could not connect to Supabase Postgres`**
- Confirm the project is not paused.
- Confirm the password has no unescaped special characters (`@ : / ? #` must be URL-encoded).
- Prefer the pooler URL over the direct URL.
- Make sure you ran `supabase/schema.sql` once.

**Frontend shows `Network Error` or a CORS error**
- Backend must be running on port `5000`.
- `VITE_API_URL` must be `http://localhost:5000/api`.
- `FRONTEND_URL` in `backend/.env` must match the address you open in the browser.
- Restart Vite after changing `.env` — Vite only reads env files at startup.

**ClipAI says transcription is unavailable**
Set `GROQ_API_KEY=gsk_…` (free) or `OPENAI_API_KEY=sk-…` in `backend/.env` and restart. This is intentional — the app will not fabricate a transcript.

**ClipAI rejects a video as silent**
It only rejects when ffmpeg reports true digital silence **and** there is no audio stream. If loudness could not be measured, the job continues. Try `CLIPAI_FFMPEG_PATH` if your bundled ffmpeg misbehaves.

**A video was wrongly marked "digital silence" on an older build**
That was a bug where ffmpeg's `volumedetect` output (which goes to **stderr**) was not captured. It is fixed in `backend/src/clippedai/ffmpeg.js`. Update, restart, and **re-run the failed jobs**.

**Job stuck in `processing`**
Jobs are recovered automatically on boot. Just restart the backend. If it keeps happening, check disk space in `backend/media/`.

**`npm run db:sync` changed my table shape**
Avoid `sync({alter:true})` on a production database — it can rebuild tables and drop rows. Use `supabase/schema.sql` for migrations and `scripts/clipai-migrate.js` for ClipAI columns.

**Video Editor is slow to open**
It is intentionally lazy-loaded (PixiJS + mediabunny ≈ 4 MB). First load compiles those chunks; later loads hit the browser cache.

---

## 14. Project Rules (Please Read)

These rules exist because the app previously showed convincing-looking fake data. Keep them intact.

1. **Never fabricate content.** No invented transcripts, captions, hooks, CTAs, hashtags, titles, durations, scores, or metrics. If data does not exist, show an empty or error state.
2. **Never fabricate measurements.** Durations come from ffprobe, scores come from the real scoring algorithm, insights come from real publish jobs.
3. **Never report an engine that is not running.** `/api/health` returns the actual provider names; the UI must display those, not an assumed label.
4. **No silent error swallowing.** A failed request sets an error state the user can see — it must not quietly become `0`, `[]`, or `null`.
5. **Score weights must sum to 1** and live in one exported constant.
6. **User input wins.** Client-sent values are fallbacks only; measured values always override them.
7. **Keep secrets out of git.** Only `.env.example` files are committed.
8. **Protect the Video Editor.** Shared styles must stay scoped to `.layout` so they cannot override the editor's Tailwind styles. The `@` alias and framework shims in `vite.config.js` are what make the ported editor compile — do not remove them.
9. **Do not "fix" a heuristic fallback into a fake result.** Deterministic generation from real user input is fine; pretending a placeholder is a measurement is not.
10. **When merging branches**, record what was taken, what was skipped, and why in `MERGE_NOTES.md`.

---

## Further Reading

| Document | Contents |
|---|---|
| [`MERGE_NOTES.md`](./MERGE_NOTES.md) | What was merged from the KRITIKA / RAJAS branches, what was skipped, and why |
| [`AGENT/DESIGN.md`](./AGENT/DESIGN.md) | Page-by-page design |
| [`AGENT/API.md`](./AGENT/API.md) | Full API contract |
| [`AGENT/ARCHITECTURE.md`](./AGENT/ARCHITECTURE.md) | System architecture |
| [`AGENT/AI_PIPELINE.md`](./AGENT/AI_PIPELINE.md) | AI pipeline stages and prompts |
| [`AGENT/FEATURES.md`](./AGENT/FEATURES.md) | Feature catalogue |
| [`AGENT/SETUP.md`](./AGENT/SETUP.md) | Setup notes |
| [`AGENT/DATABASE.md`](./AGENT/DATABASE.md) | Data model |
| [`AGENT/EDL_FORMAT.md`](./AGENT/EDL_FORMAT.md) | EDL JSON structure |
| [`AGENT/PUBLISHING.md`](./AGENT/PUBLISHING.md) | Publishing flow |
| [`AGENT/CONTENT_WORKFLOW.md`](./AGENT/CONTENT_WORKFLOW.md) | Content workflow |
| [`AGENT/PRD.md`](./AGENT/PRD.md) | Product requirements |
| [`frontend/src/ideation-script-hook/PIPELINE.md`](./frontend/src/ideation-script-hook/PIPELINE.md) | Idea → hook → script → beats flow |

---

**Stack:** Supabase (Postgres + Storage) · Express · Sequelize · Node · React 19 · Vite · Tailwind CSS 4