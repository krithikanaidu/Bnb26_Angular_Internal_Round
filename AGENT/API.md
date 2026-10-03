# API Reference: CreatorAi

> REST API served by Express at `http://localhost:5000/api`.
> Legend: ✅ exists (route group present, exact paths may differ slightly: confirm against `routes/*.js`) · ⏳ planned.

---

## 1. Conventions

| Item | Rule |
|---|---|
| Base URL | `/api` |
| Format | JSON (`Content-Type: application/json`); uploads use `multipart/form-data` |
| Auth ⏳ | `Authorization: Bearer <supabase_jwt>` |
| IDs | UUID strings |
| Timestamps | ISO 8601 UTC |
| Time offsets | Seconds as floats (e.g. `12.4`) |
| Pagination | `?page=1&limit=20` → `{ data, page, limit, total }` |
| Long tasks | Return `202 Accepted` with `{ jobId }`; poll `GET /api/jobs/:id` |

### Error shape
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "topic is required",
    "details": [{ "field": "topic", "msg": "Required" }]
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Validation failed |
| 401 | Missing or invalid token |
| 403 | Not your workspace |
| 404 | Not found |
| 409 | Invalid status transition or version conflict |
| 413 | File too large |
| 422 | Unsupported file type |
| 500 | Server error |

---

## 2. Health
| Method | Path | Description |
|---|---|---|
| GET ✅ | `/health` | `{ "ok": true, "ai": "openai" \| "heuristic" }` |

---

## 3. Projects and Workflow

| Method | Path | Description |
|---|---|---|
| GET ✅ | `/projects` | List projects (filter `?status=`) |
| POST ✅ | `/projects` | Create project |
| GET ✅ | `/projects/:id` | Project with counts of assets, scripts, clips |
| PATCH ✅ | `/projects/:id` | Update title/topic/niche |
| POST ✅ | `/projects/:id/status` | Advance or revert status |
| DELETE ✅ | `/projects/:id` | Delete project |

**POST `/projects`**
```json
// request
{ "title": "Pricing explained", "topic": "SaaS pricing mistakes", "niche": "startups" }
// 201
{ "id": "…", "title": "Pricing explained", "status": "idea", "created_at": "…" }
```

**POST `/projects/:id/status`**
```json
// request
{ "status": "scripted" }
// 409 when invalid
{ "error": { "code": "INVALID_TRANSITION", "message": "idea → published not allowed" } }
```

---

## 4. Assets

| Method | Path | Description |
|---|---|---|
| POST ✅ | `/assets` | Upload file (multipart: `file`, `project_id`) |
| GET ✅ | `/assets?project_id=` | List assets |
| GET ✅ | `/assets/:id` | Asset detail with transcript segments |
| DELETE ✅ | `/assets/:id` | Delete asset and storage object |
| POST ⏳ | `/assets/:id/transcribe` | Start transcription → `202 { jobId }` |
| GET ⏳ | `/assets/search?q=&project_id=` | Semantic search over transcripts |
| GET ⏳ | `/assets/:id/url` | Signed download/stream URL |

**POST `/assets`** (multipart)
```
file: <binary>
project_id: <uuid>
```
```json
// 201
{
  "id": "…", "project_id": "…", "type": "video",
  "filename": "talk.mp4", "size": 48210334,
  "storage_path": "creator-assets/…/talk.mp4",
  "status": "uploaded"
}
```

**GET `/assets/search?q=explain pricing`** ⏳
```json
{ "data": [
  { "segment_id": "…", "asset_id": "…", "start": 132.4, "end": 151.0,
    "text": "So when we talk about pricing…", "similarity": 0.84 }
] }
```

---

## 5. Scripts and Hooks

| Method | Path | Description |
|---|---|---|
| POST ✅ | `/content/hooks/generate` | Generate hook options |
| POST ✅ | `/content/scripts/generate` | Generate script + supporting copy |
| GET ✅ | `/content/scripts?project_id=` | List scripts |
| PATCH ✅ | `/content/scripts/:id` | Edit script text |
| POST ⏳ | `/scripts/:id/beats` | Split script into beats |
| GET ⏳ | `/hook-patterns` | List hook patterns |

**POST `/content/hooks/generate`**
```json
// request
{ "project_id": "…", "topic": "SaaS pricing mistakes", "tone": "punchy", "count": 8 }
// 200
{
  "engine": "openai",
  "hooks": [
    { "id": "…", "text": "Most founders price too low. Here's why.",
      "category": "contrarian", "score": 0.82, "pattern_id": "…" }
  ]
}
```

**POST `/content/scripts/generate`**
```json
// request
{ "project_id": "…", "hook_id": "…", "tone": "punchy", "length_sec": 60 }
// 200
{
  "id": "…", "engine": "heuristic",
  "content": "…",
  "beats": [{ "idx": 0, "text": "Hook" }, { "idx": 1, "text": "Problem" }],
  "supporting": {
    "title": "…", "caption": "…", "hashtags": ["#saas", "#pricing"], "cta": "Follow for more"
  }
}
```

---

## 6. Alignment and Clips

| Method | Path | Description |
|---|---|---|
| POST ✅ | `/content/align` | Align script to transcript |
| GET ⏳ | `/projects/:id/alignments` | Beat↔segment map and gaps |
| POST ✅ | `/content/clips/generate` | Generate ranked clips |
| GET ✅ | `/content/clips?project_id=` | List clips |
| PATCH ✅ | `/content/clips/:id` | Accept/reject, adjust in/out |

**POST `/content/align`**
```json
// request
{ "script_id": "…", "asset_id": "…" }
// 200
{
  "engine": "embedding",
  "matches": [
    { "beat_idx": 0, "segment_id": "…", "score": 0.81, "status": "matched" },
    { "beat_idx": 3, "segment_id": null, "score": 0.12, "status": "gap" }
  ],
  "gaps": [3]
}
```

**POST `/content/clips/generate`**
```json
// request
{ "project_id": "…", "asset_id": "…", "script_id": "…", "max_clips": 5, "target_sec": 45 }
// 200
{
  "clips": [
    { "id": "…", "start": 132.4, "end": 178.1, "score": 0.88,
      "reason": "Matches script beat 2 (pricing mistake) with high speaker energy",
      "status": "suggested" }
  ]
}
```

---

## 7. Editing (EDL)

Spec: [`EDL_FORMAT.md`](./EDL_FORMAT.md).

| Method | Path | Description |
|---|---|---|
| POST ✅ | `/content/edit/generate` | AI generates EDL v1 for a clip |
| GET ✅ | `/content/clips/:id/edl` | Latest EDL (`?version=` for specific) |
| POST ✅ | `/content/clips/:id/edl` | Save a new version |
| GET ⏳ | `/clips/:id/edl/versions` | Version list |
| POST ⏳ | `/clips/:id/edl/revert` | Create new version from an older one |
| POST ⏳ | `/clips/:id/edl/ops/:opId/accept` | Accept an op |
| POST ⏳ | `/clips/:id/edl/ops/:opId/reject` | Reject an op |
| POST ⏳ | `/clips/:id/render` | Render EDL to MP4 → `202 { jobId }` |
| GET ⏳ | `/clips/:id/comments` | Time-coded comments |
| POST ⏳ | `/clips/:id/comments` | Add comment |
| PATCH ⏳ | `/comments/:id` | Resolve/unresolve |

**POST `/clips/:id/edl`**
```json
// request
{
  "base_version": 2,
  "edl": { "tracks": [], "captions": [], "overlays": [], "hook": {}, "cta": {} },
  "note": "Rejected silence trim"
}
// 201
{ "version": 3, "created_by": "user", "parent_version": 2 }
// 409 if base_version is stale
```

**POST `/clips/:id/render`** ⏳
```json
// request
{ "version": 3, "aspect": "9:16", "burn_captions": true }
// 202
{ "jobId": "…" }
```

---

## 8. Adaptation and Publishing

Presets: [`PUBLISHING.md`](./PUBLISHING.md).

| Method | Path | Description |
|---|---|---|
| POST ✅ | `/content/adapt` | Generate per-platform variants |
| GET ✅ | `/content/clips/:id/variants` | List variants |
| PATCH ✅ | `/content/variants/:id` | Edit caption/hashtags |
| GET ✅ | `/content/trends?topic=&niche=&geo=` | Live trend titles + suggested tags |
| POST ✅ | `/content/publish` | Publish or schedule |
| GET ✅ | `/content/publish?project_id=` | Publish jobs and statuses |
| POST ⏳ | `/variants/:id/publish` | Publish a variant |
| DELETE ⏳ | `/publish/:id` | Cancel scheduled job |
| GET ⏳ | `/platform-accounts` | Connected accounts |
| POST ⏳ | `/platform-accounts` | Connect or simulate an account |

**POST `/content/adapt`**
```json
// request
{ "clip_id": "…", "platforms": ["tiktok", "reels", "shorts", "x"] }
// 200
{ "variants": [
  { "platform": "tiktok", "aspect": "9:16", "max_duration": 60,
    "caption": "…", "hashtags": ["#fyp", "#saas"] }
] }
```

**POST `/content/publish`**
```json
// request
{ "variant_id": "…", "scheduled_at": "2026-10-10T09:00:00Z" }
// 201
{ "id": "…", "status": "scheduled", "mode": "simulated" }
```

---

## 9. Insights and Revenue

| Method | Path | Description |
|---|---|---|
| GET ✅ | `/content/insights` | Dashboard metrics |
| POST ✅ | `/content/seed` | Seed demo metrics and transcripts |
| GET ⏳ | `/insights/summary` | KPIs: views, engagement, output volume |
| GET ⏳ | `/insights/patterns` | Performance by hook category, platform, duration |
| GET ⏳ | `/insights/recommendations` | Next-idea suggestions with evidence |
| GET ⏳ | `/revenue` | Revenue events (`?project_id=`) |
| POST ⏳ | `/revenue` | Add revenue event |
| GET ⏳ | `/calendar` | Calendar entries |
| POST ⏳ | `/calendar` | Create entry |

**GET `/insights/recommendations`** ⏳
```json
{ "recommendations": [
  { "idea": "Pricing myths short series",
    "reason": "Contrarian hooks on Reels earn 2.1× engagement of your average",
    "evidence": { "category": "contrarian", "platform": "reels", "sample_size": 14 } }
] }
```

---

## 10. Jobs

| Method | Path | Description |
|---|---|---|
| GET ⏳ | `/jobs/:id` | Status and progress |
| POST ⏳ | `/jobs/:id/retry` | Retry failed job |

```json
{ "id": "…", "type": "transcribe", "status": "running", "progress": 45, "attempts": 1 }
```

---

## 11. Authentication ⏳

Handled by Supabase Auth on the client (email/password or OAuth). The API verifies the JWT and derives `workspace_id`.

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Current workspace profile |
| PATCH | `/me` | Update niche, tone profile |

---

## 12. Webhooks / Events ⏳ (stretch)

Job completion can be pushed via Supabase Realtime on the `jobs` table instead of polling.

---

## 13. Versioning and Compatibility

- Current routes remain stable under `/api`.
- New routes are additive. Breaking changes will move under `/api/v2`.
- Update this document whenever a route changes; each PR touching `routes/*` should include an API.md diff.
