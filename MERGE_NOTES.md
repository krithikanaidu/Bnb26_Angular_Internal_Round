# Merge notes — KRITIKA / RAJAS / PRACHI

Records what was taken from each sibling branch, what was deliberately left out, and why.
Safety checkpoint for the pre-merge state: tag `backup/pre-merge-20261004-072106`.

## Taken from KRITIKA (feature branch)

Backend
- `config/platformPresets.js` — per-platform aspect/duration/limit presets.
- `data/hookPatterns.seed.js` — seed data for the hook pattern library.
- `routes/ideation.js` — idea capture, hook generation, script generation, beat editing.
- `services/adaptation.service.js` — clip → per-platform variants.
- `services/ideation.service.js` — ideation orchestration.
- `services/llmProvider.js` — multi-provider LLM access (Groq / OpenAI).
- `services/trends.service.js` — live Reddit / Hacker News trend tags.
- `routes/content.js`, `services/content.service.js`, `services/ai.service.js`, `config/database.js` — taken wholesale; KRITIKA's are the newer superset.
- `models/index.js` — added `HookPattern` + `PlatformVariant`, extended `Script` (`version`, `hook_pattern_id`, `beats`, `supporting`), `Hook` (`pattern_id`, `category`) and `PublishJob` (`variantId`).

Frontend
- `ideation-script-hook/` — full Ideation → Hook Generator → Script Studio flow (9 files + `ideation.css`, `PIPELINE.md`).
- `components/` — `AssetUploader`, `ClipList`, `EdlEditor`, `PipelineBoard`, `PlatformPicker`, `ReviewPanel`, `Scheduler`, `Timeline`, `TranscriptViewer`, `VariantPreview`.
- `hooks/useApi.js`.
- `pages/Insights.jsx`, `pages/Calendar.jsx`.
- `pages/Publish.jsx` — replaced by KRITIKA's Domain 7 rewrite (persisted variants, edit + validate, per-platform scheduling, retry/cancel).

Merged by hand rather than replaced
- `index.js` — kept ClipAI mounting and route order; ideation mounts **before** legacy `/content` so its paths win. Health check reports both LLM and STT providers.
- `App.jsx` — kept `/clips`, lazy `/video-editor` and `/scripts`; added `/ideation`, `/insights`, `/calendar`.
- `components/Layout.jsx` — union of both sidebars.
- `styles.css` — **kept the local version.** It scopes `input/select/textarea/button` to `.layout`; KRITIKA's global version would override the video editor's Tailwind utilities. Added the `--yellow`/`--coral`/`--olive`/`--orchid`/`--sky`/`--pink`/`--paper` tokens and `.page-head`/`.error-text`/`.primary`/`.dot`/`.coral` classes the merged pages reference, which were referenced but never defined in any branch.

Schema
- `supabase/schema.sql` — `HookPatterns` + `PlatformVariants` tables, new `Scripts`/`Hooks`/`PublishJobs` columns, plus idempotent `ALTER TABLE ... add column if not exists` statements so pre-existing databases pick up the changes.

## Taken from RAJAS

- `AGENT/` — 12 documents (`PRD`, `ARCHITECTURE`, `DATABASE`, `API`, `AI_PIPELINE`, `CONTENT_WORKFLOW`, `EDL_FORMAT`, `PUBLISHING`, `SETUP`, `FEATURES`, `README`, and `DESIGN.md` from KRITIKA, which RAJAS lacks).
- `README.md` and `AGENT/README.md` are logically identical across branches apart from line endings; the local versions were kept.

## Deliberately not taken from PRACHI

PRACHI contributes no functional or backend value and its UI cannot be adopted without breaking this app:

- **Backend is strictly older.** All 9 backend files are smaller and simpler than the current ones (e.g. `content.js` 6.5 KB vs 12.8 KB) and predate both ideation and ClipAI. Nothing to merge.
- **No wired features.** 7 of its 9 routes render `ComingSoon` placeholders; `Dashboard.tsx` makes zero API calls and renders mock projects from a local zustand store, and `Playground.tsx` is a component gallery.
- **Incompatible toolchain.** It pins React 18, react-router 7 and Tailwind 3; this app runs React 19, react-router 6 and Tailwind 4. Adopting it would downgrade the toolchain and break the video editor and the merged KRITIKA pages.
- **Alias collision.** It resolves `@/` to its own `src`, but `@` is already mapped to `src/video-editor` in `frontend/vite.config.js`.
- **Design conflict.** Its paper/ink `index.css` conflicts with the app's dark theme and with the video editor's separate design system.
- Mock/fabricated dashboard data also conflicts with the project rule against static placeholder output.

Its ~70 KB of decorative components (custom cursor, sky background, stickers, ink avatars, doodle outlines, spill bin, gradient slider) were left in place in the PRACHI folder for reference.