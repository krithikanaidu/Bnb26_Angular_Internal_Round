# Feature List: CreatorAi

> The master list of every feature, what it does, how it works, who it serves and where it is documented. Also serves as the map of all `.md` documents in the project.
>
> **Status:** ✅ implemented · 🔧 partly built / being upgraded · ⏳ planned
> **Priority:** **M** Must (MVP demo) · **S** Should · **C** Could

---

## 1. Summary

| Domain | Features | Must | Should | Could |
|---|---|---|---|---|
| 1. Workspace and Pipeline | 5 | 4 | 1 | 0 |
| 2. Asset Management | 6 | 4 | 2 | 0 |
| 3. Ideation, Scripts and Hooks | 6 | 4 | 0 | 2 |
| 4. Script-to-Footage Understanding | 3 | 3 | 0 | 0 |
| 5. Clip Generation | 4 | 3 | 0 | 1 |
| 6. AI-Assisted Editing | 10 | 7 | 3 | 0 |
| 7. Multi-Platform Adaptation | 4 | 4 | 0 | 0 |
| 8. Publishing and Scheduling | 4 | 3 | 1 | 0 |
| 9. Creator Intelligence | 5 | 2 | 2 | 1 |
| 10. Platform and Reliability | 6 | 4 | 0 | 2 |
| **Total** | **53** | **38** | **9** | **6** |

---

## 2. Domain 1: Workspace and Pipeline

### F1.1 Authentication and Workspaces ⏳ · M
- **What:** Sign up and sign in; each user has a private workspace.
- **How:** Supabase Auth issues a JWT; Express middleware verifies it and attaches `workspace_id`; Postgres RLS enforces isolation.
- **Value:** Creators' footage and data stay private; prerequisite for any real use.
- **Docs:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) §9, [`DATABASE.md`](./DATABASE.md) §7, [`SETUP.md`](./SETUP.md) §2.5

### F1.2 Creator Profile and Tone Profile ⏳ · S
- **What:** Store niche, audience, preferred tone, banned words and sample voice.
- **How:** `workspaces.tone_profile` jsonb is injected into hook/script/caption prompts.
- **Value:** Output sounds like the creator, not generic AI.
- **Persona:** Riya, Meera

### F1.3 Project Management ✅ · M
- **What:** Each content piece is a Project with title, topic, niche and status.
- **How:** CRUD on `/api/projects`; assets, scripts, clips and publish jobs hang off the project.
- **Value:** One container for the whole content journey.

### F1.4 Pipeline Dashboard ✅ · M
- **What:** Board/list view of projects grouped by status (idea → published) with KPIs and insights.
- **How:** Groups by `project_status`; shows counts, recent activity and top insight.
- **Value:** At a glance, what's stuck and what's next.
- **Docs:** [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md)

### F1.5 Status Machine ✅ · M
- **What:** Enforced lifecycle `idea → scripted → recorded → editing → review → scheduled → published`.
- **How:** Allowed-transition table; event triggers advance status; invalid jumps return `409`.
- **Value:** Keeps the workflow consistent and drives dashboards and automation.
- **Docs:** [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md) §3

---

## 3. Domain 2: Asset Management

### F2.1 Multi-Format Upload ✅ · M
- **What:** Upload video, audio and images in one place.
- **How:** `multer` multipart → Supabase Storage bucket `creator-assets` → `Asset` row; type/size validation.
- **Value:** Replaces scattered folders and drives.
- **Docs:** [`API.md`](./API.md) §4, [`SETUP.md`](./SETUP.md) §2.4

### F2.2 Asset Library and Metadata ✅ · M
- **What:** Browse, filter and delete assets by project and type; see size, duration, status.
- **How:** `GET /api/assets`; metadata extracted on upload (ffprobe ⏳).
- **Value:** A creator-focused digital asset manager without a heavy DAM deployment.

### F2.3 Automatic Transcription 🔧 · M
- **What:** Speech to text with word-level timestamps (and optional speaker labels).
- **How:** Job → Python worker running WhisperX (or hosted Whisper API) → `transcript_segments` with `words`. Seeded demo transcripts are used today.
- **Value:** Makes footage searchable and enables alignment and captions.
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §3.3

### F2.4 Auto Tags and Summaries ⏳ · S
- **What:** Keywords, topics and a one-paragraph summary per video.
- **How:** LLM over the transcript; stored on the asset.
- **Value:** Faster browsing and better search.

### F2.5 Semantic Asset Search ⏳ · S
- **What:** Find footage by meaning ("where I explain pricing"), returning timestamped segments.
- **How:** Embeddings in pgvector; cosine search; results link to the Studio at that timestamp.
- **Value:** Turns hours of footage into a queryable library.
- **Docs:** [`DATABASE.md`](./DATABASE.md) §8

### F2.6 Secure Storage and Signed URLs ⏳ · M
- **What:** Private storage with short-lived URLs for playback and download.
- **How:** Backend generates signed URLs using the service key.
- **Value:** Creators own and control their raw footage.

---

## 4. Domain 3: Ideation, Scripts and Hooks

### F3.1 AI Hook Generation ✅ · M
- **What:** 5–10 hook options per topic with category and strength score.
- **How:** LLM with retrieved hook patterns as few-shot examples; deterministic scoring; heuristic template fallback.
- **Value:** Stronger openings that stop the scroll.
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §3.1

### F3.2 Viral Hook Pattern Library 🔧 · M
- **What:** A curated library of hook patterns (question, contrarian, story, stat, statement).
- **How:** `hook_patterns` table seeded from the viral-hooks dataset; each Hook and Clip stores its `pattern_id` so insights can group results by pattern.
- **Value:** Grounds generation in proven structures and powers the feedback loop.

### F3.3 Script Generation and Inline Editing ✅ · M
- **What:** Full script from a topic and chosen hook, in the creator's tone and target length; editable in place.
- **How:** LLM with structure (Hook → Problem → Value → CTA) and word budget; heuristic outline fallback.
- **Value:** From blank page to shootable script in seconds.

### F3.4 Script Beats ⏳ · M
- **What:** The script split into beat-level ideas with importance weights.
- **How:** LLM or rule-based sentence grouping; stored in `script_beats` with embeddings.
- **Value:** The unit used for footage alignment and clip scoring.

### F3.5 Supporting Content ✅ · M
- **What:** Title, caption, hashtags and CTA generated with the script.
- **How:** Same generation step; reused and rewritten per platform in adaptation.
- **Value:** Everything needed to post, not just the video.

### F3.6 Next-Idea Recommender ⏳ · C
- **What:** 3–5 suggested topics with reasons based on the creator's own performance.
- **How:** Insights agent finds top patterns/topics, then the ideation agent proposes follow-ups citing evidence.
- **Value:** Closes the loop from results back to ideas.
- **Persona:** Meera

---

## 5. Domain 4: Script-to-Footage Understanding

### F4.1 Script ↔ Transcript Alignment 🔧 · M
- **What:** Each script beat is mapped to the footage segment(s) that express it, with a score.
- **How:** Embedding cosine similarity (+ optional LLM rerank), time-order bias, thresholds for matched/weak/gap. Keyword-overlap heuristic today.
- **Value:** The system understands what the creator meant, not only what was said.
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §3.5

### F4.2 Gap Detection ⏳ · M
- **What:** Flags script beats with no usable footage.
- **How:** Beats whose best score is below the weak threshold are marked `gap`.
- **Value:** Tells the creator what to re-record before editing.

### F4.3 Alignment Viewer ✅ / 🔧 · M
- **What:** Studio panel showing beats beside matched segments with scores; click to jump to the timestamp.
- **How:** Renders `alignments`; color-codes matched/weak/gap.
- **Value:** Transparent AI that the creator can verify and correct.

---

## 6. Domain 5: Clip Generation

### F5.1 Candidate Clip Detection ✅ · M
- **What:** Finds potential short clips inside long footage.
- **How:** Sliding windows (20–60 s) snapped to sentence boundaries; overlap suppression.
- **Value:** Replaces scrubbing through hours of video.

### F5.2 Script-Aware Scoring with Reasons 🔧 · M
- **What:** Ranks clips and explains each score in plain language.
- **How:** Weighted score of alignment, hook strength, energy, length fit, completeness.
- **Value:** Unlike generic clippers, picks moments that carry the creator's intended message.
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §3.6

### F5.3 Accept / Reject / Adjust Clips ✅ · M
- **What:** Creator curates suggestions and tweaks in/out points.
- **How:** `PATCH /api/content/clips/:id`; adjustments create a new EDL version.
- **Value:** AI proposes, the creator decides.

### F5.4 Speaker Diarization and Tracking ⏳ · C
- **What:** Identify who is speaking; keep the active speaker framed in 9:16.
- **How:** pyannote via WhisperX; speaker labels on segments; crop focus follows speaker.
- **Value:** Essential for podcasts and interviews.
- **Persona:** Arjun

---

## 7. Domain 6: AI-Assisted Editing

### F6.1 AI-Generated EDL ✅ · M
- **What:** AI proposes an edit as structured JSON: tracks, captions, overlays, hook, CTA.
- **How:** Edit agent analyzes the clip and writes EDL v1 with provenance and reasons.
- **Value:** Edits are a transparent, editable plan instead of a baked video.
- **Docs:** [`EDL_FORMAT.md`](./EDL_FORMAT.md)

### F6.2 Per-Operation Accept / Reject ⏳ · M
- **What:** Each AI operation can be approved, rejected or modified individually.
- **How:** `status` field per item; endpoints for accept/reject create a new version.
- **Value:** Control without redoing the whole edit.

### F6.3 Versioned Edits and Revert ✅ · M
- **What:** Every save is an immutable version; restore any earlier one.
- **How:** `edl_versions` with `parent_version`; revert creates a new version from an old one.
- **Value:** Safe experimentation; nothing is ever lost.

### F6.4 Timeline Editor ⏳ · M
- **What:** Visual multi-lane timeline for video, audio, captions and overlays with drag/trim.
- **How:** React timeline SDK (Twick or similar) as a view over the EDL JSON; user changes are marked `source: user`.
- **Value:** Familiar editing UI for tweaking AI output.

### F6.5 Silence and Filler Removal ⏳ · S
- **What:** Cuts dead air (and optionally filler words) automatically.
- **How:** FFmpeg `silencedetect` plus transcript filler lists; each cut is a separate rejectable segment.
- **Value:** Tighter pacing in one click.

### F6.6 Auto Captions with Styles ✅ / 🔧 · M
- **What:** Burned-in captions with presets (clean, bold-karaoke, boxed, minimal).
- **How:** Words with timestamps → caption chunks → ASS subtitles at render time.
- **Value:** Higher retention for silent viewing.

### F6.7 9:16 Smart Reframing ⏳ · M
- **What:** Converts horizontal footage to vertical, centered or following the speaker.
- **How:** EDL `crop` per segment; FFmpeg crop and scale.
- **Value:** Short-form-ready output.

### F6.8 Hook and CTA Overlays ✅ · M
- **What:** Opening hook text and closing call-to-action added as overlay elements.
- **How:** `hook` and `cta` objects in the EDL with style presets and timing.
- **Value:** Consistent, tested structure on every clip.

### F6.9 Video Rendering ⏳ · M
- **What:** Export the EDL as an MP4.
- **How:** Async job in the worker; FFmpeg graph built from accepted items; output saved to Storage and linked.
- **Value:** Turns the editable plan into a postable file.
- **Docs:** [`EDL_FORMAT.md`](./EDL_FORMAT.md) §12

### F6.10 Time-Coded Review Comments ⏳ · S
- **What:** Reviewers comment at specific timestamps of a specific version; creator resolves.
- **How:** `review_comments` table; Studio panel with comment markers on the timeline.
- **Value:** Editor, client and creator collaborate without email.
- **Persona:** Sam

---

## 8. Domain 7: Multi-Platform Adaptation

### F7.1 Platform Presets ✅ · M
- **What:** Rules for TikTok, Reels, Shorts, X (and LinkedIn): aspect, duration, caption limits, hashtags, tone.
- **How:** Config objects; one place to update when platform rules change.
- **Value:** Right format every time.
- **Docs:** [`PUBLISHING.md`](./PUBLISHING.md) §2

### F7.2 One-Click Adaptation ✅ · M
- **What:** One clip becomes platform-specific variants.
- **How:** Duration clamp, reframe, caption rewrite in platform tone, hashtag selection.
- **Value:** Post everywhere without redoing work.

### F7.3 Variant Preview and Editing ✅ · M
- **What:** See and edit each platform's caption, title and hashtags with live character counters and safe-zone overlay.
- **How:** `platform_variants` rows editable via `PATCH /variants/:id`.
- **Value:** Final polish before posting.

### F7.4 Validation Warnings ✅ · M
- **What:** Alerts for over-length clips, long captions, too many hashtags.
- **How:** Validators run per preset; surfaced in the UI rather than silently truncating.
- **Value:** Avoids rejected or poorly performing posts.

---

## 9. Domain 8: Publishing and Scheduling

### F8.1 Scheduling and Publish Queue ✅ · M
- **What:** Post now or schedule; see the status per platform.
- **How:** `PublishJob` with states queued/scheduled/running/published/failed; polling scheduler with atomic claim.
- **Value:** Predictable posting without manual uploads.

### F8.2 Platform Connectors 🔧 · M
- **What:** Real posting on one platform; simulated posting elsewhere, clearly labeled.
- **How:** Common connector interface; aggregator API or YouTube Data API for the real one.
- **Value:** Real end-to-end proof without waiting on every platform's approval.

### F8.3 Retry and Error Recovery ⏳ · M
- **What:** Failed posts show the reason and can be retried or rescheduled.
- **How:** Backoff retries for transient errors; clear messages for auth/validation errors.
- **Value:** Trustworthy publishing.

### F8.4 Content Calendar ⏳ · S
- **What:** Month/week view of planned and scheduled posts.
- **How:** `calendar_entries` plus scheduled jobs; click to create or reschedule.
- **Value:** Consistency planning for career growth.
- **Persona:** Meera

---

## 10. Domain 9: Creator Intelligence

### F9.1 Performance Metrics Collection 🔧 · M
- **What:** Views, likes, comments, shares and watch time per post.
- **How:** Polled from connectors at fixed intervals or generated as flagged seed data.
- **Value:** The data foundation for every insight.

### F9.2 Pattern Insights 🔧 · M
- **What:** What works for this creator: performance by hook category, platform, duration and time of day.
- **How:** SQL aggregates, lift vs baseline, minimum sample size, LLM narration.
- **Value:** Specific, actionable findings ("question hooks on Reels get 2× your average engagement").
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §3.9

### F9.3 Intent → Output → Outcome Trace ⏳ · S
- **What:** For any clip, see the script beat, hook pattern, edit decisions and the resulting metrics together.
- **How:** Foreign keys across beats, clips, EDL versions, variants and metrics.
- **Value:** The differentiator: understanding *why* content performed.

### F9.4 Revenue Tracker ⏳ · S
- **What:** Log and view income per content piece and platform (CPM, brand deal, tip, other).
- **How:** `revenue_events` rolled up per project; manual and mock entries in MVP.
- **Value:** Connects content decisions to money.
- **Persona:** Meera

### F9.5 Brand-Deal Matching ⏳ · C
- **What:** Suggests brands/campaigns that fit the creator's niche and audience.
- **How:** Profile and performance data matched to a campaign list (reference: creator-brand matching projects).
- **Value:** Monetization path beyond ad revenue.

---

## 11. Domain 10: Platform and Reliability

### F10.1 Async Job System ⏳ · M
- **What:** Long tasks (transcribe, embed, render, publish) run in the background with progress.
- **How:** `jobs` table (or BullMQ), retries, `GET /api/jobs/:id` polling.
- **Value:** A responsive UI and recoverable failures.

### F10.2 Agent Run Logging ⏳ · M
- **What:** Every AI step is recorded with input, output, engine, latency and errors.
- **How:** Orchestrator writes `agent_runs`.
- **Value:** Debuggable, explainable AI; useful to show judges.

### F10.3 AI Engine Fallback ✅ · M
- **What:** Works with OpenAI or with built-in heuristics; same output shape either way.
- **How:** Engine selection with timeout and retry; response includes `engine`.
- **Value:** The product never breaks in a demo.
- **Docs:** [`AI_PIPELINE.md`](./AI_PIPELINE.md) §2

### F10.4 Demo / Seed Mode ✅ · M
- **What:** One click fills a project with transcript, clips and metrics.
- **How:** `POST /api/content/seed`; seeded metrics flagged and badged in the UI.
- **Value:** Reliable demos and easy testing.

### F10.5 MCP Tool Exposure ⏳ · C
- **What:** Expose CreatorAi actions (generate hooks, find clips, render) as MCP tools so external agents can drive the platform; optionally consume FFmpeg/YouTube MCP servers.
- **How:** Thin MCP server wrapping existing service functions.
- **Value:** "Agentic" story and extensibility.

### F10.6 Role-Based Collaboration ⏳ · C
- **What:** Editor and reviewer roles with limited permissions.
- **How:** Memberships table and permission checks.
- **Value:** Team workflows (post-MVP).

---

## 12. Feature → Persona Matrix

| Feature group | Riya (solo short-form) | Arjun (podcaster) | Meera (entrepreneur) | Sam (editor) |
|---|---|---|---|---|
| Hooks, scripts (F3) | ●●● | ●● | ●● | ○ |
| Transcription, search (F2) | ●● | ●●● | ●● | ●● |
| Alignment, gaps (F4) | ●● | ●●● | ●● | ●● |
| Clip generation (F5) | ●●● | ●●● | ●● | ●● |
| EDL, timeline, versions (F6.1–6.4) | ●● | ●●● | ● | ●●● |
| Review comments (F6.10) | ○ | ●● | ● | ●●● |
| Adaptation, publishing (F7, F8) | ●●● | ●● | ●●● | ● |
| Calendar (F8.4) | ●● | ●● | ●●● | ● |
| Insights, revenue (F9) | ●● | ●● | ●●● | ○ |

●●● core · ●● important · ● useful · ○ minimal

---

## 13. Feature → User Story Map

| Epic | Stories | Features |
|---|---|---|
| A. Assets | A1–A3 | F2.1–F2.5 |
| B. Scripts and hooks | B1–B3 | F3.1–F3.5 |
| C. Script ↔ footage | C1–C2 | F4.1–F4.3 |
| D. Clips and editing | D1–D4 | F5.1–F5.3, F6.1–F6.9 |
| E. Multi-platform | E1–E2 | F7.1–F7.4 |
| F. Workflow and publishing | F1–F3 | F1.4, F1.5, F6.10, F8.1–F8.4 |
| G. Creator intelligence | G1–G4 | F3.6, F9.1–F9.5 |

Story text and acceptance criteria: [`PRD.md`](./PRD.md) §4.

---

## 14. Feature → Open-Source Reference Map

| Feature(s) | Reference project | How it's used |
|---|---|---|
| F2.3, F5.4 | WhisperX, pyannote-audio | Library in the Python worker |
| F5.1–F5.2 | AutoClip, OpenShorts, jBahr's Clip Generator, ClippedAI | Pipeline pattern (transcribe → score → crop → caption) |
| F3 (script-to-video ideas) | InsightCut | Storyboard concept reference |
| F6.4 | Twick, react-video-editor | Timeline UI SDK |
| F6.10 | Clapshot, FreeFrame | Pattern for time-coded review |
| F7, F8 | Mixpost, AiToEarn, upload-post | Per-network rules, connector option |
| F3.2 | tiktok-viral-hooks | Seed data for patterns |
| F9.1 | SocialKit, Stormy Cookbook, youtuber | Analytics SDK/API options |
| F9.4–F9.5 | AiToEarn, InPactAI, Polar | Monetization and matching models |
| F10.5 | mcp-ffmpeg, Video Editing MCP | Optional MCP tooling |

Rule: integrate libraries and patterns; do not deploy whole third-party apps. Verify licenses first. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8.

---

## 15. MVP Cut

**Demo-critical path (all Must features):**
F1.1, F1.3–F1.5 → F2.1–F2.3, F2.6 → F3.1–F3.5 → F4.1–F4.3 → F5.1–F5.3 → F6.1–F6.4 (accept/reject, versions, timeline), F6.6–F6.9 → F7.1–F7.4 → F8.1–F8.3 → F9.1–F9.2 → F10.1–F10.4.

**If time is short, protect in this order:**
1. Upload → transcript → alignment → clips (the core intelligence)
2. EDL with accept/reject and versions (the editability promise)
3. Adaptation and one real publish (the end-to-end proof)
4. Insights loop (the differentiator)

**Out of scope for MVP:** payments/payouts, OAuth for every platform, mobile apps, multi-tenant teams, voice cloning.

---

## 16. Documentation Map

| # | Document | What it covers | Features most related |
|---|---|---|---|
| 1 | [`README.md`](./README.md) | Overview, stack, quick start, credits | All |
| 2 | [`PRD.md`](./PRD.md) | Goals, personas, user stories, MVP scope, metrics | All |
| 3 | [`FEATURES.md`](./FEATURES.md) | This file: every feature and the doc map | All |
| 4 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Components, agents, data flows, integration decisions | F1, F10 |
| 5 | [`DATABASE.md`](./DATABASE.md) | Tables, ERD, indexes, RLS, queries, migrations | F1, F2, F4, F6, F9 |
| 6 | [`API.md`](./API.md) | Endpoints, request/response, errors | All |
| 7 | [`AI_PIPELINE.md`](./AI_PIPELINE.md) | Hooks, scripts, alignment, clips, edits, insights; OpenAI vs heuristic | F2.3, F3, F4, F5, F6.1, F9, F10.3 |
| 8 | [`CONTENT_WORKFLOW.md`](./CONTENT_WORKFLOW.md) | Lifecycle stages, transitions, automation triggers | F1.4, F1.5, F6.10, F8 |
| 9 | [`EDL_FORMAT.md`](./EDL_FORMAT.md) | Editable edit-decision JSON spec | F6 |
| 10 | [`PUBLISHING.md`](./PUBLISHING.md) | Presets, adaptation rules, scheduling, connectors | F7, F8 |
| 11 | [`SETUP.md`](./SETUP.md) | Supabase, env variables, running, troubleshooting | F1.1, F2.6 |
| 12 | `DEMO.md` | Two-minute demo script | MVP cut |
| 13 | `ROADMAP.md` | Future phases and team split | All ⏳ |
| 14 | `CONTRIBUTING.md` | Conventions, branching, PR process | n/a |

Documents 12–14 are in the next batch.

---

## 17. Keeping This File Current

- Update a feature's status in the same PR that changes it.
- Add new features with the next ID in their domain and link to the doc that specifies them.
- Keep the summary counts in §1 in sync when adding or removing features.
