# CreatorAi: AI-Powered Creator Operating Platform

> One workspace to go from **idea → script → footage → AI-assisted edit → multi-platform publish → performance insights → next idea**. AI does the repetitive work; the creator keeps control.

---

## 1. What is CreatorAi?

CreatorAi unifies the creator workflow that is normally spread across a dozen tools (notes app, cloud drive, editor, clipper, scheduler, analytics dashboard). It understands both **text** (scripts) and **visuals** (raw footage), automates production tasks, and keeps every AI-generated edit **editable**.

| Pillar | What it gives the creator |
|---|---|
| **Growth discovery** | Hook and script generation grounded in viral patterns; next-idea recommendations from the creator's own history |
| **Monetization and ownership** | Revenue tracking per content piece; creator owns all assets and edit data |
| **Production and management** | Asset library, script↔footage alignment, auto-clipping, editable timeline, content pipeline |

---

## 2. Feature Status

Legend: ✅ implemented · 🔧 in progress / being upgraded · ⏳ planned

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Asset upload and management | ✅ | Supabase Storage bucket `creator-assets` |
| 2 | Hook and script generation | ✅ | OpenAI if key set, heuristic fallback otherwise |
| 3 | Script ↔ transcript alignment | 🔧 | Heuristic now; embedding-based next |
| 4 | Clip generation (ranked) | ✅ / 🔧 | Scoring v1 done; script-aware scoring in progress |
| 5 | Editable AI edits (EDL, versioned) | ✅ / 🔧 | Versioning done; per-op accept/reject in progress |
| 6 | Platform adaptation presets | ✅ | TikTok, Reels, Shorts, X (+ LinkedIn planned) |
| 7 | Publish queue and scheduling | ✅ | Records only; one real connector planned |
| 8 | Pipeline dashboard | ✅ | Status machine idea → published |
| 9 | Creator insights | 🔧 | Seeded data now; real aggregation next |
| 10 | Real transcription (WhisperX/Whisper) | ⏳ | Python worker |
| 11 | Real video rendering (FFmpeg) | ⏳ | 9:16 crop and burned captions |
| 12 | Auth and workspaces | ⏳ | Supabase Auth |
| 13 | Review comments, revenue tracker, calendar | ⏳ | Should-have |

See [`FEATURES.md`](./FEATURES.md) for the full feature list and [`ROADMAP.md`](./ROADMAP.md) for phases.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, Axios, plain CSS (timeline SDK planned) |
| Backend | Node.js + Express 4, Sequelize ORM, multer, morgan, express-validator |
| Database | PostgreSQL via Supabase (pooler URL, SSL on); `pgvector` planned |
| Storage | Supabase Storage bucket `creator-assets` |
| AI | OpenAI API when `OPENAI_API_KEY` is set; built-in heuristic fallback otherwise |
| AI worker (planned) | Python service: WhisperX, FFmpeg, embeddings |
| Tooling | nodemon (dev), Vite dev server `:5173`, Express `:5000` |

---

## 4. Architecture at a Glance

```
React SPA ──REST──▶ Express API (orchestrator) ──▶ Supabase (Postgres, Storage, Auth)
                          │
                          ├──▶ LLM provider (OpenAI / heuristic fallback)
                          ├──▶ Python AI worker (transcribe, embed, render)  [planned]
                          └──▶ Platform connectors (upload-post / platform APIs / mock)
```

Details: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 5. Quick Start

> Full instructions: [`SETUP.md`](./SETUP.md)

```bash
# 1. Clone
git clone <repo-url> creatorai && cd creatorai

# 2. Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, (optional) OPENAI_API_KEY
npm install
npm run dev                 # http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Database: run `supabase/schema.sql` in the Supabase SQL editor and create the storage bucket `creator-assets`.

No OpenAI key? The app still works end to end using the heuristic fallback.

---

## 6. Repository Layout

```
creatorai/
├── backend/src/
│   ├── index.js              # Express app, CORS, routes under /api
│   ├── config/               # database.js, supabase.js
│   ├── models/index.js       # Sequelize models
│   ├── services/             # ai.service.js, content.service.js
│   └── routes/               # projects.js, assets.js, content.js
├── frontend/src/
│   ├── App.jsx, Layout.jsx, main.jsx
│   ├── lib/api.js            # Axios client
│   └── pages/                # Dashboard, Scripts, Assets, Studio, Publish
├── supabase/                 # schema.sql, storage setup
├── worker/                   # (planned) Python AI worker
└── docs/                     # all .md documentation
```

---

## 7. Documentation Index

| Doc | Purpose |
|---|---|
| [`PRD.md`](./PRD.md) | Goals, personas, user stories, MVP scope |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, services, data flow |
| [`DATABASE.md`](./DATABASE.md) | Models, relationships, ERD |
| [`API.md`](./API.md) | Endpoint spec and schemas |
| [`AI_PIPELINE.md`](./AI_PIPELINE.md) | Hook, script, align, clip, edit flow |
| [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md) | Idea → publish lifecycle |
| [`EDL_FORMAT.md`](./EDL_FORMAT.md) | Editable edit-decision JSON spec |
| [`PUBLISHING.md`](./PUBLISHING.md) | Platform presets, scheduling, adaptation |
| [`SETUP.md`](./SETUP.md) | Supabase, env vars, storage |
| [`DEMO.md`](./DEMO.md) | Demo walkthrough |
| [`ROADMAP.md`](./ROADMAP.md) | Future phases |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Conventions and PR process |
| [`FEATURES.md`](./FEATURES.md) | Master feature list and doc map |

---

## 8. Open-Source Credits and Licensing

CreatorAi composes ideas and libraries from the open-source community. We **integrate libraries and borrow patterns** rather than deploying whole third-party apps.

| Project | How we use it |
|---|---|
| WhisperX / pyannote-audio | Transcription with word timestamps (worker) |
| AutoClip, OpenShorts, jBahr's Clip Generator, ClippedAI | Reference for the transcribe → score → crop → caption pipeline |
| InsightCut | Reference for script → storyboard flow |
| Twick / react-video-editor | Timeline UI (planned) |
| Clapshot / FreeFrame | Reference for time-coded review comments |
| Mixpost / AiToEarn / upload-post | Reference for per-platform posting and monetization models |
| tiktok-viral-hooks | Seed data for the hook-pattern library |

Always verify each project's license before embedding its code. Record findings in the credits section of this README.

---

## 9. License

To be decided by the team (MIT recommended for hackathon submissions).
