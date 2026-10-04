# Setup and Environment: CreatorAi

> Get CreatorAi running locally with Supabase. Covers prerequisites, Supabase project, storage bucket, environment variables, running, and troubleshooting.

---

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 18 LTS or newer | Backend and frontend |
| npm | 9+ | Dependencies |
| Git | any | Cloning |
| Supabase account | free tier is enough | Postgres, Storage, Auth |
| FFmpeg | not needed | Bundled via npm (`ffmpeg-static`, `ffprobe-static`) |
| Groq or OpenAI API key | recommended | AI copy + transcription. App runs without, but ClipAI transcription requires one |

Check:
```bash
node -v && npm -v && git --version
ffmpeg -version     # when rendering is enabled
python3 --version   # when the worker is enabled
```

---

## 2. Supabase Setup

### 2.1 Create the project
1. Go to <https://supabase.com> → **New project**.
2. Choose a name, a strong database password (save it), and the region nearest your users.
3. Wait until the project status is healthy.

### 2.2 Get connection details
In **Project Settings**:

| Value | Where | Used as |
|---|---|---|
| Project URL | API → Project URL | `SUPABASE_URL` |
| Service role key | API → `service_role` (secret) | `SUPABASE_SERVICE_KEY` (backend only) |
| Anon key | API → `anon` (public) | `VITE_SUPABASE_ANON_KEY` (frontend, once auth lands) |
| Database URL (pooler) | Database → Connection string → **Connection pooling** | `DATABASE_URL` |

Use the **pooler** URL (it works well from serverless and avoids connection limits) and keep SSL on. Replace `[YOUR-PASSWORD]` in the string with your database password; URL-encode special characters.

> **Never** expose the service role key in the frontend or commit it to Git.

### 2.3 Create the schema
1. Open **SQL Editor** → **New query**.
2. Paste the contents of `supabase/schema.sql` and run it.
3. Confirm tables exist in **Table Editor** (Project, Asset, Script, Hook, TranscriptSegment, Clip, EditProject, PublishJob, Metric).

For planned features, also run (when available) the files in `supabase/migrations/` in numeric order. See [`DATABASE.md`](./DATABASE.md) §9.

Enable pgvector when you start semantic features:
```sql
create extension if not exists vector;
```

### 2.4 Create the storage bucket
1. Go to **Storage** → **New bucket**.
2. Name it exactly `creator-assets`.
3. Keep it **private** (recommended). The backend uses the service key and serves signed URLs.
4. Optional: set a file size limit (e.g. 500 MB) and allowed MIME types (`video/*`, `audio/*`, `image/*`).

If `supabase/` includes a storage setup script, run it instead of the manual steps.

### 2.5 Auth (planned) ⏳
1. **Authentication → Providers**: enable Email (and optionally Google).
2. **URL Configuration**: set Site URL to `http://localhost:5173` for dev, and add your deployed URL later.
3. Turn on **Row Level Security** with the policies in [`DATABASE.md`](./DATABASE.md) §7.

---

## 3. Environment Variables

### 3.1 Backend: `backend/.env`

```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:5173     # allowed CORS origin(s), comma-separated

# Database (Supabase Transaction pooler, :6543; SSL is always on and not configurable)
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_BUCKET=creator-assets

# AI (Groq is preferred; heuristic engine when both keys are empty)
AI_PROVIDER=                # groq | openai | heuristic  (blank = auto-detect)
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
YOUTUBE_API_KEY=            # optional: real YouTube trend signals

# ClipAI (all optional — bundled ffmpeg/ffprobe/yt-dlp are used by default)
CLIPAI_MIN_CLIP_SEC=45
CLIPAI_MAX_CLIP_SEC=120
CLIPAI_PRESET=veryfast
CLIPAI_CRF=20
CLIPAI_LANGUAGE=auto
CLIPAI_WHISPER_MODEL=whisper-1
CLIPAI_GROQ_WHISPER_MODEL=whisper-large-v3-turbo
CLIPAI_GROQ_MODEL=openai/gpt-oss-20b
CLIPAI_STT_CHUNK_SEC=600
CLIPAI_YT_MAX_MIN=120
```

### 3.2 Frontend: `frontend/.env`

```env
VITE_API_URL=http://localhost:5000/api

# Video Editor (all optional until you use that feature)
VITE_R2_BUCKET_NAME=
VITE_R2_ACCESS_KEY_ID=
VITE_R2_SECRET_ACCESS_KEY=
VITE_R2_ACCOUNT_ID=
VITE_R2_PUBLIC_DOMAIN=
VITE_DEEPGRAM_API_KEY=
VITE_DEEPGRAM_URL=https://api.deepgram.com/v1
VITE_DEEPGRAM_MODEL=nova-2
VITE_PEXELS_API_KEY=
```

Only variables prefixed with `VITE_` are exposed to the browser.

### 3.3 Variable reference

The authoritative, code-verified list of environment variables is in the root
[`README.md`](../README.md#6-environment-variables-reference). There is **no `worker/.env`**
— transcription and rendering run in-process via the bundled ffmpeg binaries.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | none | Supabase pooler URL. Startup fails without it |
| `SUPABASE_URL` | yes | none | |
| `SUPABASE_SERVICE_KEY` | yes | none | Server-side only |
| `SUPABASE_BUCKET` | no | `creator-assets` | |
| `AI_PROVIDER` | no | auto-detect | `groq`, `openai`, `heuristic` or `none` |
| `GROQ_API_KEY` | no | empty | Preferred provider; empty → next option |
| `OPENAI_API_KEY` | no | empty | Also used for Whisper transcription |
| `FRONTEND_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `PORT` | no | 5000 | |

Keep a committed `.env.example` with **names only, no secrets**. Add `.env` to `.gitignore`.

---

## 4. Install and Run

```bash
# Clone
git clone <repo-url> creatorai && cd creatorai

# Backend
cd backend
cp .env.example .env     # then edit values
npm install
npm run dev              # nodemon → http://localhost:5000

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev              # Vite → http://localhost:5173
```

### Verify
1. `curl http://localhost:5000/api/health` → expect `{ "ok": true, ... }`.
2. Open <http://localhost:5173>: the Dashboard loads.
3. Upload a small video on the **Assets** page; check the file appears in the Supabase Storage bucket and a row in the `assets` table.
4. Generate hooks on **Scripts**. With no OpenAI key, the response shows `engine: "heuristic"`.

### Seed demo data
There is no seed/demo endpoint — the app never fabricates transcripts or metrics. To populate
real data: upload footage on `/assets`, run transcription from `/clips` (ClipAI) or the Video
Editor, then generate a script and clips. Every page will show an honest empty state until then.

---

## 5. Verify the AI Engines

```bash
curl http://localhost:5000/api/health
```

Check the returned `engines` block:

| Field | Meaning |
|---|---|
| `ai` / `engines.copy` / `engines.titles` / `engines.trends` | Provider actually serving AI copy |
| `engines.whisper` | `true` when a real speech-to-text provider is configured |
| `engines.stt` | STT provider name and model (`null` when none) |
| `scoreWeights` | The real ClipAI scoring weights, served from `score.js` |

If `engines.whisper` is `false`, set `GROQ_API_KEY` (free) or `OPENAI_API_KEY` and restart.
ClipAI will refuse to invent a transcript without one — that is intentional.

Useful live checks:

```bash
node scripts/clipai.test.js       # pipeline + silence/loudness regression (no key needed)
node scripts/clipai-stt-test.js   # real transcription (needs a key)
node scripts/clipai-e2e.js        # full job → clips
```

---

## 6. Useful npm Scripts

| Command | Where | Purpose |
|---|---|---|
| `npm run dev` | backend | Start with nodemon |
| `npm start` | backend | Production start |
| `npm run dev` | frontend | Vite dev server |
| `npm run build` | frontend | Production build |
| `npm run preview` | frontend | Serve the build locally |

---

## 7. Deployment Notes

| Component | Suggested host | Notes |
|---|---|---|
| Frontend | Vercel or Netlify | Set `VITE_API_URL` to the deployed API |
| Backend | Render, Railway or Fly.io | Set all backend env vars; set `FRONTEND_URL` to the frontend origin. ffmpeg is bundled via npm — no system install needed |
| Database / Storage | Supabase (managed) | Use the pooler URL |

Large uploads: if the host limits request size, move to **direct-to-Storage uploads** with signed upload URLs from the backend.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend exits: `DATABASE_URL is required` | `.env` missing or not filled | Copy `.env.example` → `.env` and set the Transaction pooler URL. There is no localhost fallback |
| `SequelizeConnectionError` / timeout | Wrong URL, or direct (non-pooler) URL | Use the pooler URL (`:6543`); URL-encode special chars in the password |
| SSL / `no pg_hba.conf entry` | Direct connection blocked | Use the pooler URL. SSL is always on and not configurable |
| Upload returns 500 | Bucket missing or wrong name | The backend creates `creator-assets` at boot; check `SUPABASE_BUCKET` |
| `Invalid API key` from Supabase | anon key used instead of service role | Use the service role key on the backend only |
| CORS error in the browser | Origin mismatch | Set `FRONTEND_URL` to the exact frontend origin |
| Frontend calls the wrong server | Missing `VITE_API_URL` | Set it and restart Vite — Vite only reads `.env` at startup |
| AI always reports `heuristic` | No valid key, or `AI_PROVIDER` forcing it | Check `GROQ_API_KEY` / `OPENAI_API_KEY` and the backend logs |
| ClipAI says transcription unavailable | No STT key | Set `GROQ_API_KEY` (free) or `OPENAI_API_KEY` and restart |
| ClipAI wrongly rejects a video as silent | Old build that did not capture ffmpeg stderr | Fixed in `clippedai/ffmpeg.js` — update, restart, re-run the job |
| Large upload fails | multer memory limit or proxy limit | Uploads are held in memory by multer; move to signed direct-to-Storage uploads for large files |
| `type "vector" does not exist` | pgvector not enabled (embeddings are ⏳ anyway) | Run `create extension vector;` if you intend to use embeddings |
| Job stuck in `processing` | Process died mid-job | Restart the backend — `recoverStuckJobs()` reclaims them |

---

## 9. Security Checklist

- [ ] `.env` files are in `.gitignore`; no secrets in the repo history
- [ ] Service role key is only on the server
- [ ] Storage bucket access is intentional (the app currently uses a **public** bucket for playback URLs — add signed URLs before handling private client footage)
- [ ] RLS enabled on user tables (when auth is live)
- [ ] CORS restricted to known origins in production
- [ ] Upload type and size validation on
- [ ] Rotate any key that was ever committed or shared

---

## 10. Resetting the Environment

```sql
-- Danger: removes all data. Dev only.
drop schema public cascade;
create schema public;
-- then re-run supabase/schema.sql
```
Also empty the `creator-assets` bucket from the Storage UI.
