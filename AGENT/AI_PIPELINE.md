# AI Pipeline: CreatorAi

> How hooks, scripts, alignment, clips and edits are generated, and how the system behaves with OpenAI versus the heuristic fallback.
> Legend: ✅ exists today · 🔧 being upgraded · ⏳ planned

---

## 1. Pipeline Overview

```
Topic ─▶ [1 Hooks] ─▶ [2 Script + beats] ─────────────┐
                                                       ▼
Video ─▶ [3 Transcribe] ─▶ [4 Embed] ─▶ [5 Align] ─▶ [6 Clip scoring] ─▶ [7 Edit → EDL]
                                                                              │
                              [9 Insights] ◀─ Metrics ◀─ [8 Adapt + Publish] ◀┘
                                   │
                                   └──▶ [0 Ideation] (feeds the next topic)
```

| # | Stage | Engine (primary) | Fallback | Status |
|---|---|---|---|---|
| 0 | Ideation | LLM + metrics SQL | Rule-based from top categories | ⏳ |
| 1 | Hook generation | LLM + hook-pattern retrieval | Pattern templates filled with topic | ✅ |
| 2 | Script and beats | LLM | Outline template | ✅ |
| 3 | Transcription | WhisperX or Whisper API | Seeded demo transcript | 🔧 (seed only today) |
| 4 | Embedding | Sentence-transformers or hosted embeddings | Skipped (keyword overlap) | ⏳ |
| 5 | Alignment | Cosine similarity (+ optional LLM rerank) | Keyword overlap | ✅ heuristic / ⏳ embedding |
| 6 | Clip scoring | Weighted score function | Same (deterministic) | ✅ v1 / 🔧 script-aware |
| 7 | Edit generation | Analysis (silence, energy) + LLM for overlays | Rule-based ops | ✅ |
| 8 | Adaptation | Preset rules + LLM captions | Preset rules + templates | ✅ |
| 9 | Insights | SQL aggregates + LLM narration | SQL + templated text | 🔧 |

---

## 2. Engine Selection: OpenAI vs Heuristic

The AI service picks an engine at call time.

```
if OPENAI_API_KEY is set and request succeeds   → engine = "openai"
else                                            → engine = "heuristic"
```

| Aspect | OpenAI (LLM) | Heuristic fallback |
|---|---|---|
| Quality | Natural, tone-aware, varied | Predictable, template-based |
| Latency | 1–10 s | Under 50 ms |
| Cost | Per token | Free |
| Offline | No | Yes |
| Determinism | Low | High |
| Use | Production and rich demo | Dev, tests, outages, no-key demos |

Rules:
1. Every AI endpoint returns `"engine": "openai" | "heuristic"` so the UI can show it.
2. On LLM timeout (default 20 s), rate limit or malformed JSON, retry once, then fall back. Never return a 500 solely because the LLM failed.
3. Fallback output must have the **same JSON shape** as LLM output.
4. Log every run in `agent_runs` with engine, latency and fallback reason.

Provider abstraction (so Claude or others can be swapped in):
```js
// services/llm.js
async function complete({ system, user, json = true, temperature = 0.7 }) { /* provider switch */ }
```
Configured via `LLM_PROVIDER=openai|anthropic|none`.

---

## 3. Stage Details

### 3.1 Hook Generation ✅
**Input:** topic, tone, niche, count, optional past top-performing patterns.
**Process:**
1. Retrieve 5–8 patterns from `hook_patterns` (by category mix, or by creator's best performers once data exists).
2. Prompt the LLM with the topic plus the patterns as few-shot examples.
3. Ask for JSON: `[{text, category, pattern_id}]`.
4. Score each hook (see below).

**Hook strength score (0–1), deterministic:**
| Signal | Weight |
|---|---|
| Length 6–14 words | 0.2 |
| Contains a number, question, or contrast word | 0.25 |
| Addresses viewer ("you", "your") | 0.15 |
| Curiosity gap (promise without answer) | 0.25 |
| Matches a pattern known to perform for this creator | 0.15 |

**Prompt skeleton**
```
System: You write short-form video hooks. Return JSON only.
User: Topic: {topic}. Niche: {niche}. Tone: {tone}.
Use these proven patterns as inspiration (do not copy): {patterns}
Return {count} hooks as [{"text":"","category":"question|statement|story|stat|contrarian","pattern_id":""}].
```

**Heuristic fallback:** fill `{topic}` into stored pattern templates, rotate categories, score with the same function.

### 3.2 Script and Supporting Content ✅
**Input:** chosen hook, topic, tone, target length (seconds), creator tone profile.
**Output:**
```json
{
  "content": "full script text",
  "beats": [{"idx":0,"text":"Hook","importance":1.0}, {"idx":1,"text":"Problem","importance":0.8}],
  "supporting": {"title":"","caption":"","hashtags":[],"cta":""}
}
```
**Rules:**
- Word budget ≈ `length_sec × 2.5` (about 150 wpm).
- Structure: Hook → Problem → 2–3 value beats → CTA.
- Each beat is a single sentence-level idea (becomes an alignment unit).
- `importance` weights hook and key claims higher; used in clip scoring.

**Heuristic fallback:** outline template with the topic substituted and generic beats.

### 3.3 Transcription 🔧
**Input:** video or audio asset.
**Output:** `transcript_segments` with `start`, `end`, `text`, `words[{w,start,end}]`, optional `speaker`.

| Mode | Details |
|---|---|
| WhisperX (worker) | VAD → batched Whisper → forced alignment → optional diarization |
| Whisper API | Hosted; word timestamps via `timestamp_granularities=["word"]` |
| Seeded | Demo transcript attached on upload (current behavior) |

Segmenting rule: merge words into 5–15 s segments at sentence boundaries, so each segment is a meaningful unit for matching.

### 3.4 Embedding ⏳
- Embed each **script beat** and each **transcript segment** with the same model.
- Default model: a small sentence-transformer (384-dim) in the worker, or a hosted embedding API (1536-dim). Pick one and keep the `vector(N)` column consistent.
- Store in `script_beats.embedding` and `transcript_segments.embedding`.

### 3.5 Script ↔ Footage Alignment 🔧
**Goal:** for each beat, find the footage segment(s) that express it, and flag gaps.

**Embedding method (target):**
1. For each beat, compute cosine similarity against all segments of the asset.
2. Take the top 3 candidates.
3. Optional LLM rerank of the top 3 (only when the top-2 scores are within 0.05).
4. Apply thresholds:

| Score | Status |
|---|---|
| ≥ 0.65 | `matched` |
| 0.45–0.65 | `weak` |
| < 0.45 | `gap` |

Thresholds are configurable and should be tuned on the demo footage.

**Order constraint:** if the creator followed the script, matched segments should be roughly monotonic in time; penalize large backward jumps by 10% to reduce spurious matches.

**Heuristic method (current):** normalized keyword overlap (Jaccard on lowercased, stopword-stripped tokens) with the same thresholds scaled to that metric.

**Output:** rows in `alignments` plus a `gaps` list returned to the Studio UI.

### 3.6 Clip Scoring 🔧
**Candidate generation:** sliding windows over segments, length 20–60 s (target set by user), snapped to sentence boundaries.

**Score (0–1):**
```
score = 0.35 * alignment      // avg similarity to the most important matched beats
      + 0.20 * hook_strength  // strength of the first 3 s of the window
      + 0.20 * energy         // speech rate + loudness variance (from audio analysis)
      + 0.15 * length_fit     // closeness to target duration
      + 0.10 * completeness   // starts and ends on sentence boundaries
```
Weights live in config so they can be tuned.

**Selection:**
1. Score all windows.
2. Non-maximum suppression: drop windows overlapping > 40% with a higher-scored one.
3. Return the top N (default 5).

**Reason string** (shown to the user) is generated from the strongest components, for example:
> "Matches script beat 2 (pricing mistake), strong opening question, high speaker energy."

For `🔧 script-aware` mode the `alignment` term is real; if no script is attached, its weight is redistributed to the other terms.

**Without audio analysis** (early build): set `energy` from words-per-second as a proxy.

### 3.7 Edit Generation ✅ → EDL
**Input:** clip bounds and transcript words.
**Output:** EDL v1 (see [`EDL_FORMAT.md`](./EDL_FORMAT.md)).

| Operation | Method |
|---|---|
| Trim | Clip start/end, snapped to word boundaries |
| Silence removal | FFmpeg `silencedetect` (e.g. −30 dB, ≥ 0.6 s) → cut ranges as separate ops |
| Captions | Words → caption chunks (3–6 words), style preset |
| Crop 9:16 | Center crop by default; speaker-tracking crop ⏳ |
| Hook overlay | Selected hook text, first 2–3 s |
| CTA | End card text in the last 2 s |

Every item carries `source: "ai"`, `reason`, `status: "pending"`. The user accepts, rejects or edits, and each save creates a new version.

### 3.8 Platform Adaptation ✅
Takes the clip, EDL and presets (see [`PUBLISHING.md`](./PUBLISHING.md)); produces per-platform duration clamps, aspect, caption and hashtags. LLM rewrites captions to match each platform's voice; the fallback uses templates with the base caption.

### 3.9 Insights 🔧
1. SQL aggregates by hook category, platform, duration bucket (0–20, 20–40, 40–60, 60+ s) and posting hour.
2. Compute lift vs the creator's baseline: `lift = metric_group / metric_overall`.
3. Keep patterns with sample size ≥ 5 (show "low confidence" below that).
4. LLM turns the top findings into short narrative recommendations; fallback uses a template: *"{category} hooks on {platform} get {lift}× your average engagement."*

### 3.10 Ideation ⏳
Input: niche, top patterns, best topics from history. Output: 3–5 ideas, each with a rationale citing its evidence and a suggested hook category.

---

## 4. Agent Orchestration

```
Orchestrator.run(agent, input):
  start = now()
  row = agent_runs.insert({agent, input, status:"running"})
  try:
     output = agents[agent](input)          // with engine fallback inside
     agent_runs.update(row, {output, status:"ok", ended_at})
  except e:
     agent_runs.update(row, {status:"error", error:e.message})
     raise
```

Agents are called by routes or jobs; the orchestrator also advances project status when a stage completes.

---

## 5. Configuration

| Variable | Purpose | Default |
|---|---|---|
| `LLM_PROVIDER` | `openai`, `anthropic` or `none` | `openai` if key present |
| `OPENAI_API_KEY` | OpenAI access | unset → heuristic |
| `LLM_MODEL` | Model name | provider default |
| `LLM_TIMEOUT_MS` | Per-call timeout | 20000 |
| `ALIGN_MATCH_THRESHOLD` | Matched score | 0.65 |
| `ALIGN_WEAK_THRESHOLD` | Weak score | 0.45 |
| `CLIP_WEIGHTS` | JSON of score weights | see §3.6 |
| `TRANSCRIBE_MODE` | `whisperx`, `api`, `seed` | `seed` |

---

## 6. Quality and Evaluation

| Check | Method |
|---|---|
| Alignment accuracy | Hand-label 10–15 beat↔segment pairs on demo footage; target ≥ 80% correct top-1 |
| Clip usefulness | Team rates top 5 clips on the demo video (keep or discard); target ≥ 3 of 5 kept |
| Hook quality | Blind compare LLM vs heuristic hooks; track preference |
| Edit acceptance | Log accept/reject per op type; target ≥ 60% accepted |
| Fallback parity | Unit tests assert the same JSON schema from both engines |
| Latency | Record per-stage durations from `agent_runs` |

---

## 7. Safety, Privacy and Cost

- Send **transcript text**, not raw video, to external LLMs.
- Do not send other users' data; prompts include only the current workspace's content.
- Cap tokens per request; cache hook patterns and repeated prompts.
- Validate LLM JSON with a schema before saving; discard unknown fields.
- Strip PII markers if the creator opts out of external LLM use (`none` provider).

---

## 8. Known Limitations

- Embedding thresholds need tuning per domain and language.
- Speaker-tracking crop and diarization are post-MVP.
- Energy scoring is approximate without proper audio features.
- LLM output varies; fallbacks keep the demo stable but are less rich.
