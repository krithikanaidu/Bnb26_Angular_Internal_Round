# DESIGN.md — Page Responsibilities

> This file defines **what each page does**. Use it as the source of truth when designing/building pages.

## Dashboard (`/`) — `pages/Dashboard.jsx`
- Content workflow pipeline board: projects as cards in status columns (`idea → scripting → recording → editing → ready → scheduled → published`).
- Create new idea/project (title in, status `idea`).
- Advance a project's status.
- Creator Intelligence snapshot: totals (views/likes/comments/shares), production patterns card, top clips.

## Scripts (`/scripts`) — `pages/Scripts.jsx`
- Generate hooks for a topic (count + style).
- Generate a full script (topic, tone, target platforms).
- List saved scripts, show body, tone, platforms.

## Assets (`/assets`) — `pages/Assets.jsx`
- Upload video/image/audio (multipart → Supabase Storage; row in `assets` table).
- Asset grid: file name, kind, duration, size, public URL.
- Transcript viewer (auto-seeded demo transcript segments on upload).

## Studio (`/studio`) — `pages/Studio.jsx`
- Align script beats to transcript segments (gap detection).
- Generate clip suggestions ranked by virality score.
- Select a clip → AI-assisted edit producing editable EDL.
- Timeline view of tracks/captions/overlays.
- EDL editor: edit JSON `{tracks, captions, overlays, hook, cta}`, save → new version.
- Review panel (time-coded comments).

## Publish (`/publish`) — `pages/Publish.jsx`
- Pick clip/project → adapt per platform (tiktok, reels, shorts, x) with aspect + safe-zone variants.
- Variant preview per platform.
- Schedule publish jobs (platform, datetime, caption) or save as draft.
- Publish job list with status (`draft/scheduled/published/failed`), one-click retry.

## Insights (`/insights`) — `pages/Insights.jsx`
- KPI totals across platforms.
- Production patterns: avg clip length, best hook style, best post window, suggestion text.
- Top clips by virality score.
- Per-platform metrics series.

## Calendar (`/calendar`) — `pages/Calendar.jsx`
- Publish jobs grouped by scheduled date (Unscheduled bucket for drafts).
- Shows platform, status, caption per job.

## Shared Components (`components/`)
- `Layout` — sidebar nav + outlet shell.
- `PipelineBoard` — reusable kanban of projects by status.
- `AssetUploader` — file input → upload.
- `TranscriptViewer` — transcript segments with timestamps.
- `ClipList` — ranked clip suggestions.
- `Timeline` — EDL track visualization.
- `EdlEditor` — editable JSON EDL + versioned save.
- `ReviewPanel` — time-coded comments.
- `PlatformPicker` — multi-select platforms.
- `VariantPreview` — per-platform variant card.
- `Scheduler` — schedule form.
