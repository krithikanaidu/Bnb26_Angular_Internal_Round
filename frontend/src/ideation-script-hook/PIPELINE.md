# Ideation Pipeline — `ideation-script-hook/`

Feature scope: **F3.1 Hook Generation · F3.2 Hook Pattern Library · F3.3 Script Generation + Inline Editing · F3.5 Supporting Content**
(Source: `AGENT/FEATURES.md` Domain 3, `AGENT/AI_PIPELINE.md` §3.1–3.2, `AGENT/API.md` §5, `AGENT/DATABASE.md` §4.5)

## Current pipeline

```
[1 Idea]  topic + tone + project selection (page form)
   │
[2 Hooks] POST /api/content/hooks/generate
   │       ├─ retrieve 5–8 patterns from hook_patterns (seed → DB, static fallback offline)
   │       ├─ engine: openai (few-shot w/ patterns) | heuristic (template fill)
   │       ├─ deterministic strength score 0–1 (AI_PIPELINE §3.1 weights)
   │       ├─ persisted to hooks table (pattern_id, category, score)
   │       └─ user clicks one hook → carried to stage 3
   │
   │       GET /api/hook-patterns?category=…   → library grid (browse/filter)
   │
[3 Script] POST /api/content/scripts/generate {project_id, hook_id, tone, length_sec}
   │       ├─ word budget ≈ length_sec × 2.5 (150 wpm)
   │       ├─ structure: Hook → Problem → 2–3 value beats → CTA
   │       ├─ beats[] + supporting {title, caption, hashtags, cta} returned
   │       └─ saved as scripts row (version 1)
   │
   │       PATCH /api/content/scripts/:id  ← inline editing, version++ on every save
   │
[4 Beats ⏳]  split into script_beats (alignment unit for Studio)
```

## Backend files

| File | Role |
|---|---|
| `backend/src/routes/ideation.js` | New API paths (`/hook-patterns`, `/content/hooks/generate`, `/content/scripts/generate`, `/content/scripts/:id`). Mounted **before** `routes/content.js` so documented paths win; legacy `/content/generate-hooks` and `/content/generate-script` still work. |
| `backend/src/services/ideation.service.js` | Pattern retrieval, deterministic hook scoring, heuristic/LLM hook + script generation. |
| `backend/src/data/hookPatterns.seed.js` | 30 curated patterns across question/statement/story/stat/contrarian. |
| `backend/src/models/index.js` | Added `HookPattern`; `Hook.patternId`, `Hook.category`; `Script.version`, `Script.beats`, `Script.supporting`, `Script.hookPatternId`. All additive (`sequelize.sync({alter:true})`). |

## Frontend files (`frontend/src/ideation-script-hook/`)

| File | Role |
|---|---|
| `IdeationPage.jsx` | Orchestrator: stage rail, shared state (chosen hook, generated script). |
| `components/StageRail.jsx` | Pipeline breadcrumb (Idea → Hooks → Script → Beats ⏳). |
| `components/HookGenerator.jsx` | Stage 2: form + hook cards (category chip, strength bar, pick). |
| `components/HookPatternLibrary.jsx` | F3.2: pattern grid with category filter. |
| `components/ScriptStudio.jsx` | Stage 3: generate from chosen hook, tone/length controls. |
| `components/ScriptEditor.jsx` | Inline title/body editing, dirty state, save → PATCH, version chip. |
| `api.js` | Thin wrappers over `lib/api`. |
| `ideation.css` | Feature-scoped `ia-*` classes (tokens only). |

Route: `/ideation` (registered in `App.jsx`, nav link in `components/Layout.jsx`).

## Next pipeline stages (not built yet)

1. **F3.4 Script beats** — `POST /scripts/:id/beats`: sentence-level split with importance weights → `script_beats` table (needed by Studio alignment).
2. **F3.6 Next-idea recommender** — `POST /content/ideas/suggest`: insights agent reads metrics by hook pattern → 3–5 topic ideas with evidence-based rationale (loop closes stage 1).
3. **Pattern feedback loop** — store `hook_pattern_id` on `clips` + aggregate `metrics × pattern` → auto-mark `top performer` patterns and pass them into stage 2 retrieval (`topCategories` arg already wired in `generateHooks`).
4. **Tone profile** — creator tone profile per workspace influencing generation (AI_PIPELINE §3.2 input).
5. **Beats → alignment** — hand `beats[]` to `POST /content/align` as the query units instead of whole script body.

## Contracts

```jsonc
POST /api/content/hooks/generate
// req  { "project_id", "topic", "tone", "count", "niche" }
// res  { "engine": "openai|heuristic", "patterns": [...],
//        "hooks": [{ "id", "text", "category", "score", "pattern_id" }] }

POST /api/content/scripts/generate
// req  { "project_id", "hook_id", "tone", "length_sec" }
// res  { "id", "engine", "content", "beats": [{idx,text,importance}],
//        "supporting": {title,caption,hashtags,cta}, "version" }

PATCH /api/content/scripts/:id
// req  { "title"?, "content"?, "beats"?, "supporting"? }   → version + 1
```
