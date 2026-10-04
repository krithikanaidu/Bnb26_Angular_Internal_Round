# Product Requirements Document (PRD): CreatorAi

| | |
|---|---|
| **Product** | CreatorAi, AI-Powered Creator Operating Platform |
| **Status** | Draft v1 (hackathon build) |
| **Owners** | Product / Docs lead, with engineering leads for AI, backend, frontend |

---

## 1. Problem Statement

Creators lose most of their time on repetitive production work and on juggling disconnected tools. A typical video touches a notes app, a drive, an editor, a clipper, a scheduler and several analytics dashboards. None of these know the creator's **intent** (the script), so:

- AI clippers pick "viral" moments blindly, without regard to the message the creator wanted to make.
- Schedulers publish content but do not understand it.
- Analytics show numbers but not **which hook, edit or format** caused them.
- AI edits are often baked into a black-box export that the creator cannot adjust.

**CreatorAi** is a single platform that takes a script and raw footage, finds the relevant sections, generates short-form clips, writes hooks and supporting content, adapts everything per platform, and keeps all AI edits editable. Performance data then feeds the next idea.

---

## 2. Goals and Non-Goals

### Goals
1. Cover the full lifecycle: idea → script → record → edit → repurpose → publish → analyze.
2. Understand the relationship between **script text** and **footage**.
3. Generate ranked short-form clips with explanations.
4. Keep every AI edit **editable, versioned and reversible**.
5. Adapt one piece of content to several platforms in one click.
6. Close the loop: insights drive ideation.
7. Always demo-able: the app works with or without paid AI keys.

### Non-Goals (MVP)
- Payments or payouts processing
- OAuth integrations for every platform
- Native mobile apps
- Multi-tenant team management and billing
- Voice cloning or AI avatars
- Replacing a full professional NLE (Premiere, DaVinci)

---

## 3. Target Users and Personas

| Persona | Profile | Pain | Goal |
|---|---|---|---|
| **Riya**, solo short-form creator | 22, Reels/Shorts, student | 5+ hours of editing per video; unsure what performs | One 20-min video → 6 shorts in under an hour |
| **Arjun**, podcaster / long-form YouTuber | 30, 2-person team | Hours of footage; finding good bits; repurposing for 4 platforms | Script-aware clip pipeline his editor can tweak |
| **Meera**, creator-entrepreneur | 35, courses and brand deals | Scattered files; inconsistent posting; unclear revenue drivers | Calendar, performance and revenue view for career planning |
| **Sam**, freelance editor (secondary) | Works for creators | Needs versions, comments, approvals | Edit AI drafts fast; get client sign-off |

Full persona detail lives in this PRD; the story map below is keyed to them.

---

## 4. User Stories and Acceptance Criteria

### Epic A: Asset Management
| ID | Story | Acceptance criteria |
|---|---|---|
| A1 | As a creator, I upload video, audio and images into one library | Upload accepts mp4/mov/mp3/wav/png/jpg; file appears in library with type, size, duration; stored in Supabase Storage |
| A2 | I search assets by meaning | Query returns segments ranked by similarity with timestamps (planned) |
| A3 | I see a transcript and tags per upload | Transcript segments with start/end times appear within the asset detail view |

### Epic B: Ideation, Scripts and Hooks
| ID | Story | Acceptance criteria |
|---|---|---|
| B1 | I get 5–10 hook options for a topic | Each hook has text, pattern category and a strength score |
| B2 | I generate and edit a script in my tone | Script has beats; edits persist; tone profile is respected |
| B3 | I get supporting content | Title, caption, hashtags and CTA generated per script |

### Epic C: Script ↔ Footage Understanding
| ID | Story | Acceptance criteria |
|---|---|---|
| C1 | I link a script to footage and see matches | Each script beat maps to zero or more transcript segments with a similarity score |
| C2 | I see gaps | Beats with no segment above the threshold are flagged "no footage" |

### Epic D: Clips and Editing
| ID | Story | Acceptance criteria |
|---|---|---|
| D1 | I get ranked clip suggestions | Each clip shows start/end, score, and a plain-language reason |
| D2 | I accept or reject clips and adjust in/out points | Changes persist and create a new EDL version |
| D3 | I apply AI edits as editable operations | Trim silence, captions, 9:16 crop and hook overlay appear as discrete ops, each toggleable |
| D4 | I revert to an earlier version | Version history lists all versions; restore creates a new version from the chosen one |

### Epic E: Multi-Platform Adaptation
| ID | Story | Acceptance criteria |
|---|---|---|
| E1 | One clip adapts to each platform | Output respects aspect ratio, max duration, caption style and hashtag rules per preset |
| E2 | I preview and edit each variant | Per-platform caption and hashtags are editable before publishing |

### Epic F: Workflow and Publishing
| ID | Story | Acceptance criteria |
|---|---|---|
| F1 | Content moves through a pipeline | Status machine: idea → scripted → recorded → editing → review → scheduled → published; invalid jumps rejected |
| F2 | I schedule or publish | Publish job per variant with status (queued, scheduled, published, failed) |
| F3 | A reviewer leaves time-coded comments | Comment tied to clip, EDL version and timecode; can be resolved |

### Epic G: Creator Intelligence
| ID | Story | Acceptance criteria |
|---|---|---|
| G1 | I see per-post performance | Views, likes, comments, shares, watch-time proxy per variant |
| G2 | I learn what works for me | Aggregates by hook pattern, platform and duration bucket |
| G3 | I get next-idea recommendations | At least 3 ideas, each citing the data that motivated it |
| G4 | I track revenue per content piece | Revenue events (CPM, CPS, tip, brand) rolled up per project |

---

## 5. Scope (MoSCoW)

### Must (end-to-end demo)
1. Auth and workspace (Supabase Auth)
2. Video upload → real transcription (Whisper API via OpenAI or Groq). No key → job fails loudly; never a seeded fallback
3. Hook and script generation (LLM + hook-pattern retrieval, heuristic fallback)
4. Script ↔ transcript alignment with gap view
5. Ranked clip suggestions with scores and reasons
6. EDL editor with accept/reject/edit and version history
7. FFmpeg render to 9:16 with burned captions
8. Platform adaptation presets (Shorts, Reels, TikTok, X, LinkedIn)
9. Publish queue with scheduling; one real connector, others simulated
10. Pipeline dashboard and insights (real metrics only; empty state when there is none)

### Should
Semantic asset search UI · time-coded review comments · content calendar · revenue tracker

### Could
Next-idea recommender · speaker diarization · brand-deal matching · MCP tool exposure

### Won't (this release)
Payments/payouts · OAuth for every platform · mobile apps · multi-tenant teams · voice cloning

---

## 6. Functional Requirements Summary

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Users can authenticate and see only their workspace's data | Must |
| FR-2 | System stores uploaded assets and metadata | Must |
| FR-3 | System generates a transcript with word-level timestamps | Must |
| FR-4 | System generates hooks, scripts and supporting copy | Must |
| FR-5 | System aligns script beats to transcript segments and flags gaps | Must |
| FR-6 | System proposes ranked clips with reasons | Must |
| FR-7 | All AI edits are stored as versioned EDL operations with provenance | Must |
| FR-8 | Users can accept, reject or modify any operation | Must |
| FR-9 | System renders an EDL to an output video file | Must |
| FR-10 | System produces per-platform variants from presets | Must |
| FR-11 | System schedules and tracks publish jobs | Must |
| FR-12 | System aggregates metrics into insights by hook pattern, platform, length | Must |
| FR-13 | System works without an LLM key via a heuristic fallback | Must |

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | First clip suggestion within 10 minutes for a 10-minute video (target); API p95 under 500 ms for non-AI routes |
| Reliability | Long tasks run as async jobs with status polling; failures are recorded and retryable |
| Resilience | AI features degrade to heuristics rather than failing |
| Security | JWT auth, row-level security by workspace, signed storage URLs, secrets only in env vars |
| Observability | Every agent run logged (input, output, duration, error) |
| Usability | Core flow completable without documentation |
| Portability | Runs locally with Supabase credentials alone |

---

## 8. Novelty and Differentiation

1. **Intent → Output → Outcome graph.** Each clip stores the script beat behind it, the hook pattern used and the resulting metrics.
2. **Script-aware clipping.** Moments are scored using alignment to the creator's own key beats plus engagement signals.
3. **EDL as the contract.** Every AI action is a versioned JSON operation with provenance and reason. See [`EDL_FORMAT.md`](./EDL_FORMAT.md).
4. **Semantic footage search** over transcripts.
5. **Feedback-loop ideation** based on the creator's own data, not generic trends.
6. **Graceful degradation** so the demo never breaks.

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| Upload → first publishable clip | Under 10 min for a 10-min video |
| AI-suggested edit ops accepted | 60%+ in demo testing |
| Platforms published per source video | 3+ |
| Insight accuracy (recommended hook style matches top performer in data) | Matches on real published data |
| Manual editing time saved (self-reported) | 50%+ |

---

## 10. Assumptions, Dependencies and Risks

**Assumptions:** teams have Supabase and (optionally) OpenAI credentials; demo footage is short and pre-validated.

**Dependencies:** Supabase (DB, Storage, Auth), an LLM provider (Groq or OpenAI), FFmpeg (bundled via npm), a Whisper API key for transcription, a posting API for one real platform.

| Risk | Impact | Mitigation |
|---|---|---|
| GPU models too slow | Demo stalls | Hosted Whisper API or small CPU model; pre-processed demo video |
| Platform OAuth approvals | No real posting | One real connector, others clearly simulated |
| Third-party licenses (GPL/AGPL, source-available) | Legal friction | Use libraries and patterns; verify licenses; credit in README |
| Scope creep | Unfinished demo | Hold to the Must list |
| LLM cost or outage | Features fail | Heuristic fallback |
| Render time | Poor UX | Async jobs, progress, short clips |

---

## 11. Related Docs

[`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATABASE.md`](./DATABASE.md) · [`API.md`](./API.md) · [`AI_PIPELINE.md`](./AI_PIPELINE.md) · [`FEATURES.md`](./FEATURES.md)
