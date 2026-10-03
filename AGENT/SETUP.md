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
| FFmpeg | 5+ | Rendering ⏳ (worker or backend host) |
| Python | 3.10+ | AI worker ⏳ |
| OpenAI API key | optional | Better AI output; app works without it |

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
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database (Supabase pooler URL, SSL on)
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
DB_SSL=true

# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_BUCKET=creator-assets

# AI (optional; heuristic fallback when empty)
OPENAI_API_KEY=
LLM_PROVIDER=openai
LLM_MODEL=
LLM_TIMEOUT_MS=20000

# Uploads
MAX_UPLOAD_MB=500

# Planned
JWT_SECRET=                 # only if verifying Supabase JWT locally
WORKER_URL=http://localhost:8000
TRANSCRIBE_MODE=seed        # seed | api | whisperx
UPLOAD_POST_API_KEY=        # one real publishing connector
```

### 3.2 Frontend: `frontend/.env`

```env
VITE_API_URL=http://localhost:5000/api
# Planned (auth)
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

Only variables prefixed with `VITE_` are exposed to the browser.

### 3.3 Worker (planned): `worker/.env` ⏳

```env
PORT=8000
DATABASE_URL=<same as backend>
SUPABASE_URL=<same>
SUPABASE_SERVICE_KEY=<service_role_key>
WHISPER_MODEL=small            # tiny | base | small | medium
DEVICE=cpu                     # cpu | cuda
HF_TOKEN=                      # needed only for pyannote diarization
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### 3.4 Variable reference

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | none | Pooler URL |
| `DB_SSL` | yes | `true` | Needed for Supabase |
| `SUPABASE_URL` | yes | none | |
| `SUPABASE_SERVICE_KEY` | yes | none | Server-side only |
| `SUPABASE_BUCKET` | no | `creator-assets` | |
| `OPENAI_API_KEY` | no | empty | Empty → heuristic engine |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Comma-separate for several origins |
| `PORT` | no | 5000 | |
| `MAX_UPLOAD_MB` | no | 500 | |

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
Use the Dashboard "Seed demo" action (calls `POST /api/content/seed`) to create demo transcripts and metrics so every page has content.

---

## 5. Run the AI Worker (planned) ⏳

```bash
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

Notes:
- First run downloads model weights (hundreds of MB). Do it before demo day.
- CPU is fine for short clips with `WHISPER_MODEL=small` or smaller. Use a GPU (`DEVICE=cuda`) for longer footage.
- Diarization needs a Hugging Face token and acceptance of the gated model terms.
- Install FFmpeg on the same machine (`brew install ffmpeg` / `sudo apt install ffmpeg`).

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
| Backend | Render, Railway or Fly.io | Set all backend env vars; set `CORS_ORIGIN` to the frontend URL |
| Worker | Render, Railway, Fly.io or a GPU host | Needs FFmpeg and enough RAM for models |
| Database / Storage | Supabase (managed) | Use the pooler URL |

Large uploads: if the host limits request size, move to **direct-to-Storage uploads** with signed upload URLs from the backend.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `SequelizeConnectionError` / timeout | Wrong URL, or direct (non-pooler) URL | Use the pooler URL; check password encoding |
| `no pg_hba.conf entry` / SSL error | SSL off | Set `DB_SSL=true` and dialect SSL options |
| Upload returns 500 | Bucket missing or wrong name | Create `creator-assets`; check `SUPABASE_BUCKET` |
| `Invalid API key` from Supabase | Wrong key or anon vs service confusion | Use the service role key on the backend |
| CORS error in the browser | Origin mismatch | Set `CORS_ORIGIN` to the exact frontend URL |
| Frontend calls the wrong server | Missing `VITE_API_URL` | Set it and restart Vite |
| AI always `heuristic` | No/invalid `OPENAI_API_KEY` or timeout | Check the key and logs; heuristic is expected without a key |
| Large upload fails | multer or proxy limit | Raise `MAX_UPLOAD_MB`; use signed uploads in production |
| `type "vector" does not exist` | pgvector not enabled | Run `create extension vector;` |
| Worker can't find FFmpeg | Not installed or not on PATH | Install FFmpeg; verify with `ffmpeg -version` |
| Slow transcription | CPU + large model | Use a smaller model or the Whisper API |

---

## 9. Security Checklist

- [ ] `.env` files are in `.gitignore`; no secrets in the repo history
- [ ] Service role key is only on the server
- [ ] Storage bucket is private
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
