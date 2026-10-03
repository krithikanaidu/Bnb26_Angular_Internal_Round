# ✨ CreatorAI — AI-Powered Creator Operating Platform (PERN + Sequelize + Supabase)

Unifies idea → script → recording → editing → repurposing → publishing.

## Stack
- **P**ostgres via **Supabase** (DB + Storage bucket `creator-assets`)
- **E**xpress backend + **Sequelize** ORM (`backend/src`)
- **R**eact + Vite frontend (`frontend/src`)
- **N**ode
- AI: OpenAI if `OPENAI_API_KEY` set, else built-in heuristic (works offline for demo)

## Quick start
### 1. Supabase
1. Create project at supabase.com → copy `DATABASE_URL` (pooler :5432), `SUPABASE_URL`, `service_role` key.
2. SQL editor → run `supabase/schema.sql` (also auto-synced by Sequelize).
3. Storage → bucket `creator-assets` (public).

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill values
npm install
npm run dev            # :5000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # :5173
```

## API map
| Feature | Endpoint |
|---|---|
| Health | `GET /api/health` |
| Projects/workflow | `GET/POST /api/projects`, `PATCH /api/projects/:id` |
| Assets (→Supabase storage) | `GET /api/assets`, `POST /api/assets/upload` (multipart `file`) |
| Hooks | `POST /api/content/generate-hooks` `{topic,count}` |
| Scripts | `POST /api/content/generate-script`, `GET /api/content/scripts` |
| Script↔video align | `POST /api/content/align` `{scriptBody, assetId|projectId}` |
| Auto clips | `POST /api/content/clips/generate`, `GET /api/content/clips` |
| Editable AI edits (EDL) | `POST /api/content/edits`, `PATCH /api/content/edits/:id` |
| Multi-platform adapt | `POST /api/content/adapt` `{clipId, platforms[]}` |
| Publish | `POST /api/content/publish`, `GET /api/content/publish` |
| Intelligence | `GET /api/content/insights`, `POST /api/content/insights/seed` |

## Demo flow (2 min)
1. Dashboard → Add idea → move to `scripting`.
2. Scripts page → Generate hooks + script.
3. Assets → Upload any video (demo transcript auto-seeds).
4. Studio → Align → Generate clips → AI edit → edit JSON EDL → Save (versioned).
5. Publish → Adapt → Schedule per platform.
6. Dashboard → insights (seed via `POST /api/content/insights/seed`).

## Notes
- Sequelize requires `DATABASE_URL` (Supabase pooler URL, SSL on). Set it in `backend/.env` before `npm run dev`.
- Uploads use `multer` (memory) → Supabase Storage public URL persisted in `Assets`.
- EDL stays editable JSON: `{tracks, captions, overlays, hook, cta}` — creators always own the final cut.
