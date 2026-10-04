# CreatorAI — AI-Powered Creator Operating Platform

> One workspace to go from **idea → script → footage → AI-assisted edit → multi-platform publish → performance insights → next idea**. AI does the repetitive work; the creator keeps control.

> **Note on accuracy:** this document describes what the code in this repository actually does today. Anything not built is marked ⏳, and no feature is described as working if it is not. See the root [`README.md`](../README.md) for setup.

---

## 1. What is CreatorAI?

CreatorAI unifies the creator workflow that is normally spread across a dozen tools (notes app, cloud drive, editor, clipper, scheduler, analytics dashboard). It understands both **text** (scripts) and **visuals** (raw footage), automates production tasks, and keeps every AI-generated edit **editable**.

| Pillar | What it gives the creator |
|---|---|
| **Growth discovery** | Hook and script generation from viral patterns; ideas captured into a real pipeline |
| **Monetization and ownership** | Creator owns all assets, transcripts and edit data (EDL JSON) |
| **Production and management** | Asset library, script↔footage alignment, auto-clipping, editable timeline, publish queue |

---

## 2. Feature Status

Legend: ✅ implemented · 🔧 partial / being upgraded · ⏳ not built

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Asset upload and management | ✅ | Supabase Storage bucket `creator-assets`; duration/dimensions/codec measured with ffprobe |
| 2 | Idea capture → hooks → script → beats | ✅ | `/ideation`, 4-stage workflow, real LLM or heuristic engine |
| 3 | Hook and script generation (quick) | ✅ | `/scripts`; Groq → OpenAI → heuristic |
| 4 | Script ↔ transcript alignment | 🔧 | Heuristic alignment today; embedding-based next |
| 5 | Real transcription | ✅ | ClipAI: OpenAI Whisper → Groq whisper-large-v3-turbo. **No key → explicit error, never fake captions** |
| 6 | Clip generation (ranked) | ✅ | Real signals + `CLIPAI_SCORE_WEIGHTS` (engagement .28, cohesion .24, hook .24, speech .14, opener .10) |
| 7 | Real video rendering | ✅ | ffmpeg/ffprobe bundled via npm: cut, auto-reframe to 9:16, burn captions |
| 8 | Editable AI edits (EDL, versioned) | ✅ / 🔧 | Versioning done; per-op accept/reject ⏳ |
| 9 | Full timeline video editor | ✅ | `/video-editor`, lazy-loaded (@openvideo + PixiJS + mediabunny) |
| 10 | Platform adaptation presets | ✅ | TikTok, Reels, Shorts, X — presets served by the API, not hardcoded in the UI |
| 11 | Publish queue and scheduling | ✅ / 🔧 | Jobs are stored and status-tracked; uploading to real platform APIs is ⏳ |
| 12 | Pipeline dashboard | ✅ | Status machine idea → scripting → recording → editing → published |
| 13 | Creator insights | ✅ | Aggregated from real publish jobs; **no seeded/sample data** |
| 14 | Publishing calendar | ✅ | Month grid with real job status |
| 15 | Trend signals | 🔧 | LLM/heuristic signals with a clearly reported fallback source |
| 16 | Auth and workspaces | ⏳ | Supabase Auth not wired up |
| 17 | Review comments, revenue tracker | ⏳ | Planned |

See [`FEATURES.md`](./FEATURES.md) for the full feature list.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 5, React Router 6, Tailwind CSS 4, Radix UI, Framer Motion, Zustand, TanStack Query |
| Video editor | @openvideo (core/timeline), PixiJS 8, mediabunny, hotkeys-js |
| Backend | Node.js + Express 4, Sequelize 6, multer, morgan, express-validator, pg |
| Database | PostgreSQL via Supabase (pooler URL, SSL required, **no localhost fallback**) |
| Storage | Supabase Storage bucket `creator-assets` (auto-created at boot) |
| Media | `ffmpeg-static` + `ffprobe-static` + `yt-dlp-exec` — installed by npm, no manual setup |
| AI (copy) | Groq → OpenAI → deterministic heuristic, resolved by `services/llmProvider.js` |
| AI (speech) | OpenAI Whisper → Groq whisper-large-v3-turbo, resolved by `clippedai/keys.js` |
| Tooling | nodemon (backend `:5000`), Vite dev server (frontend `:5173`) |

**There is no Python worker.** Transcription and rendering run in Node using bundled ffmpeg and a hosted STT API.

---

## 4. Architecture at a Glance

```
React SPA ──REST──▶ Express API (orchestrator) ──▶ Supabase (Postgres + Storage)
                          │
                          ├──▶ LLM provider (Groq / OpenAI / heuristic)
                          ├──▶ STT provider (Whisper / Groq whisper)
                          └──▶ ffmpeg + ffprobe (cut, reframe, captions, loudness)
```

Details: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`AI_PIPELINE.md`](./AI_PIPELINE.md)

---

## 5. Quick Start

> Full instructions: [`SETUP.md`](./SETUP.md) and the root [`README.md`](../README.md)

```bash
# 1. Backend
cd backend
cp .env.example .env        # fill DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY
npm install
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Database: run [`supabase/schema.sql`](../supabase/schema.sql) in the Supabase SQL editor. The `creator-assets` bucket is created automatically.

No AI key? The app still runs end to end using the heuristic engine — and it reports `engine: "heuristic"` instead of pretending otherwise. ClipAI transcription requires a real key.

---

## 6. Repository Layout

```
bit and build/
├── backend/
│   ├── media/                   # rendered clips, served at /media/*
│   ├── scripts/                 # clipai.test.js + maintenance/verification scripts
│   └── src/
│       ├── index.js             # Express app, route mounting, /api/health
│       ├── config/              # database.js (Supabase-only), supabase.js
│       ├── models/              # Sequelize models
│       ├── routes/              # projects, assets, ideation, content, clippedai
│       ├── services/            # ideation, adaptation, trends, ai, llmProvider
│       └── clippedai/           # ffmpeg, transcribe, analyze, score, ai, titles,
│                                # reframe, captions, jobs, keys, schema
├── frontend/src/
│   ├── App.jsx, main.jsx        # routes
│   ├── lib/api.js               # axios client
│   ├── components/              # Layout, AssetUploader, shared UI
│   ├── pages/                   # Dashboard, Assets, Scripts, Studio, Publish,
│   │                            # ClipAI, Insights, Calendar, VideoEditor
│   ├── ideation-script-hook/    # idea → hooks → script → beats
│   ├── clippedai/               # ClipAI client API + components
│   └── video-editor/            # ported timeline editor (@ alias + shims)
├── supabase/schema.sql
├── AGENT/                       # this documentation set
└── MERGE_NOTES.md               # branch merge record
```

---

## 7. Documentation Index

| Doc | Purpose |
|---|---|
| [`PRD.md`](./PRD.md) | Goals, personas, user stories, MVP scope |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, services, data flow |
| [`DESIGN.md`](./DESIGN.md) | Page-by-page design |
| [`DATABASE.md`](./DATABASE.md) | Models, relationships, ERD |
| [`API.md`](./API.md) | Endpoint spec and schemas |
| [`AI_PIPELINE.md`](./AI_PIPELINE.md) | Hook, script, align, clip, edit flow |
| [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md) | Idea → publish lifecycle |
| [`EDL_FORMAT.md`](./EDL_FORMAT.md) | Editable edit-decision JSON spec |
| [`PUBLISHING.md`](./PUBLISHING.md) | Platform presets, scheduling, adaptation |
| [`SETUP.md`](./SETUP.md) | Supabase, env vars, storage |
| [`FEATURES.md`](./FEATURES.md) | Master feature list and doc map |
| [`../README.md`](../README.md) | Root setup + full API/architecture guide |
| [`../MERGE_NOTES.md`](../MERGE_NOTES.md) | What was merged, what was skipped, and why |

---

## 8. Open-Source Credits

CreatorAI composes ideas and libraries from the open-source community. We **integrate libraries and borrow patterns** rather than deploying whole third-party apps.

| Project | How we use it |
|---|---|
| OpenAI Whisper | Transcription with segment timestamps |
| AutoClip, OpenShorts, jBahr's Clip Generator, ClippedAI | Reference for the transcribe → score → crop → caption pipeline |
| InsightCut | Reference for script → storyboard flow |
| Twick / react-video-editor | Reference for the timeline editor UI |
| Clapshot / FreeFrame | Reference for time-coded review comments |
| Mixpost / AiToEarn / upload-post | Reference for per-platform posting models |
| tiktok-viral-hooks | Seed data for the hook-pattern library |
| @openvideo, PixiJS, mediabunny | Timeline rendering engine and media processing |

Always verify each project's license before embedding its code.

---

## 9. License

To be decided by the team (MIT recommended for hackathon submissions).