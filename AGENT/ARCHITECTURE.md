# Architecture: CreatorAi

> System design, services, agents, data flow and integration decisions.
> Legend: ✅ exists today · ⏳ planned

---

## 1. Design Principles

1. **API-first, one orchestrator.** The Express API owns the workflow state machine; everything else is a worker or connector it calls.
2. **Integrate libraries and patterns, not whole apps.** We avoid deploying extra stacks (PHP, Django, workflow servers) that cost hosting and debugging time.
3. **EDL is the contract.** Every AI edit is a versioned JSON operation; the UI and renderer both consume it.
4. **Graceful degradation.** Every AI capability has a deterministic fallback, so the demo never breaks.
5. **Observable AI.** Each agent run is logged with input, output, duration and error.
6. **Async by default** for anything slow (transcribe, embed, render, publish).

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ React 19 + Vite 5 SPA (Tailwind 4)                           │
│ Dashboard │ Assets │ Scripts │ Ideation │ Studio │ Publish │  │
│ ClipAI │ Insights │ Calendar │ Video Editor                  │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST (Axios)
┌────────────────────────────▼─────────────────────────────────┐
│ Node.js + Express 4 API  (orchestrator)                      │
│ routes → services → Sequelize models                         │
│ ClipAI job queue (DB-backed, recoverStuckJobs on boot)       │
└───┬──────────────┬───────────────┬───────────────┬───────────┘
    │              │               │               │
┌───▼─────────┐ ┌──▼───────────┐ ┌─▼────────────┐ ┌▼─────────────┐
│ Supabase    │ │ LLM provider │ │ ClipAI engine│ │ Platform     │
│ Postgres    │ │ Groq, OpenAI,│ │ ffmpeg,ffprobe│ │ connectors   │
│ (+pgvector⏳)│ │ or heuristic│ │ STT (Whisper/ │ │ record-only  │
│ Storage     │ │ fallback ✅  │ │ Groq), reframe│ │ today, ⏳ real│
│ Auth ⏳     │ │              │ │ captions     │ │ APIs         │
└─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 3. Components

### 3.1 Frontend (`frontend/src`) ✅
| Piece | Role |
|---|---|
| `App.jsx`, `Layout.jsx`, `main.jsx` | Router and app shell |
| `lib/api.js` | Axios client; attaches JWT once auth lands |
| Pages | **Dashboard** (pipeline + insights), **Scripts** (hooks/scripts), **Assets** (upload), **Studio** (align → clips → AI edit → versioned save), **Publish** (adapt, schedule) |
| ⏳ Studio timeline | Timeline SDK (Twick or similar) bound to the EDL JSON |
| ⏳ Review, Insights, Calendar | Time-coded comments, deeper analytics, content calendar |

### 3.2 Backend API (`backend/src`) ✅
| Piece | Role |
|---|---|
| `index.js` | Express app, CORS, routes mounted at `/api/...` |
| `config/database.js`, `config/supabase.js` | Sequelize and Supabase clients |
| `models/index.js` | Sequelize models (see [`DATABASE.md`](./DATABASE.md)) |
| `services/ai.service.js` | Hook and script generation (OpenAI or heuristic) |
| `services/content.service.js` | Alignment, clip generation, platform adaptation presets |
| `routes/projects.js` | Project CRUD and status machine |
| `routes/assets.js` | Multipart upload → Storage → Asset row |
| `routes/content.js` | Hooks, scripts, align, clips, EDL, adapt, publish, insights |
| ⏳ `middleware/auth.js` | Verify Supabase JWT, attach `workspace_id` |
| ⏳ `services/jobs.service.js` | Enqueue, poll and retry jobs |
| ⏳ `services/agents/*` | One module per agent (see §4) |
| ⏳ `connectors/*` | Platform adapters with a common interface |

### 3.3 ClipAI Engine ✅ (in-process, Node — no separate worker)

Compute-heavy media work runs inside the backend via `ffmpeg-static` / `ffprobe-static`:

| Task | Implementation | Output |
|---|---|---|
| `inspect` | ffprobe | duration, streams, resolution, audio presence |
| `loudness` | ffmpeg `volumedetect` | mean/max volume, real-silence decision |
| `transcribe` | Whisper API (OpenAI or Groq) | Segments with word-level timestamps |
| `render` | ffmpeg | MP4 from EDL (trim, crop 9:16, burn captions, overlays) |
| `reframe` | ffmpeg frame sampling | 9:16 auto-reframe offsets per clip |

Jobs are rows in `ClipJob`; `clippedai/jobs.js` recovers jobs stuck in `processing` at boot.

Embeddings remain ⏳ (they would need a hosted embedding API or a Python worker).

### 3.4 Data Stores
| Store | Contents |
|---|---|
| Supabase Postgres | All relational data, JSONB EDLs, vectors (pgvector ⏳) |
| Supabase Storage (`creator-assets`) | Raw uploads, rendered clips, thumbnails |
| Supabase Auth ⏳ | Users and JWTs |

---

## 4. Agents (Logical Modules)

Agents are service modules coordinated by the orchestrator, not necessarily separate processes.

| Agent | Input | Output | Tools |
|---|---|---|---|
| **Ideation** | Niche, past metrics | Topic ideas with rationale | LLM, metrics SQL |
| **Script/Hook** | Topic, tone | Hooks, script beats, caption, hashtags, CTA | LLM + `hook_patterns` retrieval |
| **Footage Understanding** | Video asset | Transcript, segments | Whisper API (OpenAI / Groq) |
| **Alignment** | Script beats + segments | Beat↔segment map, gap flags | Cosine similarity, optional LLM rerank |
| **Clip** | Segments, alignment, signals | Ranked clips with reasons | Scoring function |
| **Edit** | Clip | EDL operations | FFmpeg analysis, LLM |
| **Adapt** | Clip + EDL | Per-platform variants | Preset rules + LLM captions |
| **Publish** | Variant + schedule | Post status | Connectors |
| **Insights** | Metrics | Patterns and recommendations | SQL aggregates + LLM narration |

Every run is recorded in `agent_runs`. See [`AI_PIPELINE.md`](./AI_PIPELINE.md).

---

## 5. Core Data Flows

### 5.1 Upload → Understand
```
Client ─upload─▶ API ─▶ Storage
                  └─▶ Asset row ─▶ job:transcribe ─▶ Worker
Worker ─▶ TranscriptSegments (+words) ─▶ job:embed ─▶ vectors saved
```

### 5.2 Script → Clip → Edit
```
Script ─▶ beats ─▶ embed ─▶ Alignment (beat↔segment, gaps)
Alignment + signals ─▶ Clip scoring ─▶ Clip rows
Clip ─▶ Edit agent ─▶ EDL v1 ─▶ user edits ─▶ v2…vN ─▶ job:render ─▶ output asset
```

### 5.3 Adapt → Publish → Learn
```
Clip + EDL ─▶ Adapt ─▶ PlatformVariants ─▶ PublishJob ─▶ Connector ─▶ Platform
Platform ─▶ Metrics (real connector reports only) ─▶ Insights ─▶ Ideation
```

---

## 6. Project Status Machine

```
idea → scripted → recorded → editing → review → scheduled → published
```

- Forward moves are triggered by events (script saved, asset linked, EDL created, review requested, publish scheduled).
- Backward moves are allowed one step (e.g. `review → editing`).
- Invalid jumps return `409`.

See [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md).

---

## 7. Job System

| Aspect | Design |
|---|---|
| Queue | MVP: `jobs` table polled by the worker. Upgrade path: BullMQ + Redis |
| Job types | `transcribe`, `embed`, `align`, `render`, `publish`, `metrics_sync` |
| States | `queued → running → succeeded | failed` |
| Retries | Up to 3 attempts with backoff |
| Progress | `progress` 0–100 field; client polls `GET /api/jobs/:id` |
| Idempotency | Job key = `type + target_id + version` |

---

## 8. Integration Decisions for Open-Source Repos

| Repo or tool | Mode | Reason |
|---|---|---|
| Whisper API | STT inside the ClipAI engine | Word timestamps power alignment and clipping |
| AutoClip, OpenShorts, jBahr, ClippedAI | **Pattern reference** | Re-implement stages so output is editable EDL |
| InsightCut | Reference | Output targets CapCut drafts, not our UI |
| Twick / react-video-editor | Embed SDK ⏳ | Fits "AI edits stay editable" |
| Clapshot / FreeFrame | Pattern reference | Separate servers; we only need time-coded comments |
| Mixpost, AiToEarn | Pattern reference | Different stacks; we borrow per-network post rules and revenue models |
| upload-post / platform APIs | Connector | Real posting on one platform |
| n8n | Optional | Source-available license; custom status machine is lighter |
| Pimcore, ResourceSpace | Skipped | Heavy PHP DAMs; Supabase Storage + Postgres suffices |
| mcp-ffmpeg and other MCP servers | Optional agent tooling | Plain FFmpeg is more reliable for MVP |
| tiktok-viral-hooks | Dataset | Seeds `hook_patterns` |

Verify licenses and maintenance status before embedding any code.

---

## 9. Security

| Concern | Approach |
|---|---|
| Authentication | Supabase Auth JWT verified in Express middleware |
| Authorization | `workspace_id` on every row; Postgres RLS as defense in depth |
| Storage | Private bucket; short-lived signed URLs |
| Secrets | `.env` only; service key never sent to the browser |
| Uploads | Type and size validation; multer limits |
| Input | `express-validator` on all write routes |
| Tokens for platforms | Stored by reference (`token_ref`), not in plain text |

---

## 10. Resilience and Fallbacks

| Capability | Primary | Fallback |
|---|---|---|
| Hooks and scripts | Groq, then OpenAI | Template + pattern heuristic (reported as `engine: "heuristic"`) |
| Transcription | Whisper API (OpenAI, then Groq) | **None — the job fails with a real error** |
| Alignment | Embedding similarity ⏳ | Keyword-overlap heuristic |
| Rendering | FFmpeg | EDL-only preview (no file) |
| Publishing | Real connector ⏳ | Record-only job, clearly labeled |
| Insights | Real aggregation | Empty state — nothing is seeded |

**Rule:** a fallback may derive real content from real input (e.g. a hook generated from your
topic). A fallback may never fabricate a measurement (transcript, duration, score, metric).

---

## 11. Deployment

| Environment | Setup |
|---|---|
| Local | Vite `:5173`, Express `:5000`, Supabase cloud project (ffmpeg bundled via npm) |
| Demo / hosted | Frontend on Vercel or Netlify; API on Render, Railway or Fly.io; Supabase managed |

Env variables are documented in [`SETUP.md`](./SETUP.md).

---

## 12. Key Technical Decisions

| Decision | Choice | Alternative considered |
|---|---|---|
| Orchestration | Express + status machine | n8n (license, extra service) |
| Vectors | pgvector in Supabase | Separate vector DB (extra infra) |
| Edit representation | Versioned EDL JSON | Baked renders (not editable) |
| Asset management | Supabase Storage | Pimcore / ResourceSpace (heavy) |
| Review | Own comments table | Clapshot server |
| Worker language | Python | Node-only (weaker ML ecosystem) |
