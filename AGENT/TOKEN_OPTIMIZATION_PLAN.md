# LLM Token Optimization Plan (Groq API) — EXECUTED

> **Status:** Implemented. All items below are done in code unless marked ⏳.
> **Goal:** Cut token consumption of the LLM layer without lowering output quality.
> **Rule zero:** Measure first, optimize second, verify quality after every change.

---

## 0. What was built (summary)

| Layer | File | Change |
|---|---|---|
| Central client | `backend/src/llm/client.js` (new) | Single `llmCall(task, messages, opts)` with usage logging (`llm_usage` JSON lines), per-task budgets, exact-match cache + in-flight dedupe, retry w/ backoff on 429/5xx only, `reasoning_effort: low` on Groq, `response_format: json_object` |
| Budgets | `backend/src/llm/tokenBudgets.js` (new) | Per-task `maxOut / temperature / maxInChars / cache TTL`: hooks 400, script 800, rank 300, clipCopy 250, title 60, adapt 500, nicheTags 150 |
| Preprocess | `backend/src/llm/preprocess.js` (new) | `normalize / clean / estimateTokens (chars/4) / dedupeLines / compactPatterns` — zero-token cleanup before every call |
| Cache | `backend/src/llm/cache.js` (new) | SHA-key `model+promptVersion+task+normalized msgs+params`, 500-entry LRU, TTL per task, `getStats()` hit-rate |
| Provider rewiring | `backend/src/services/llmProvider.js` | Delegates to `llmCall`; new opts `task, maxTokens, timeout`; old signature backward-compatible |
| ClipAI rewiring | `backend/src/clippedai/llm.js` | `chat()` gains `task/json/cache` support, usage logs, `response_format` when JSON, caps from budgets (was fixed 700 / temp 0.6); `chatJson()` temp 0.4 → 0.3 |
| Legacy AI | `backend/src/services/ai.service.js` | System prompt shortened, inputs truncated to 200ch, explicit tasks `legacyHooks/legacyScript`, tight output instructions |
| Ideation | `backend/src/services/ideation.service.js` | Patterns → compact `cat:template(60ch) CSV max 5` (was 5–6 full templates joined with `\|`); prompts → pipe-delimited single block; temp 0.8 → 0.7 w/ caps |
| Rank | `backend/src/clippedai/ai.js` | `CLIP_BUDGET_CHARS 1200→400`, `RANK_POOL 14→8`, `maxTokens 600→300`, temp → 0.2, short keys `s/e/d/sc/txt`, terse system prompt; ~65% input-token cut on this call |
| Copy | `backend/src/clippedai/ai.js` | `maxTokens 500→250`, temp → 0.4, single-line compact schema prompt; new `writeClipPackage()` alias = 1 call/clip instead of `viralTitle + writeClipCopy` (pipeline already prefers `copy.title`, so `viralTitle` now fires as fallback only) |
| Titles | `backend/src/clippedai/titles.js` | 5 few-shot examples → 2, added static system role, transcript truncated to 400ch, `maxTokens 200→60` (~70% output-token cut) |
| Adapt | `backend/src/services/adaptation.service.js` | Inputs pre-truncated (`hook 200 / title 120 / cta 40`), brief `p:tone<=Nch` pipe format, temp 0.7→0.4, task `adapt` (cached 6h) |
| Trends | `backend/src/services/trends.service.js` | Inputs truncated (120/60ch), temp 0.6→0.3, task `nicheTags` (cached 6h), skip LLM when topic+niche empty |

Verified: `node --check` on all touched files passes; `require()` of all 9 modules passes; cache round-trip + `estimateTokens` smoke-tested (`hit:true`, 10 tasks registered).

---

## 1. Phase 1: Baseline and Instrumentation — DONE

Central wrapper `llmCall` logs per call (JSON line `evt: llm_usage`):
`task, model, engine, inChars, estIn, prompt_tokens, completion_tokens, total_tokens, cached_tokens, latencyMs, retries, cached`.

**To produce the baseline report:** run 100 representative requests (min/typical/max input) and aggregate by `task`:
avg / p50 / p95 prompt + completion tokens, cache hit rate (`cached:true` ratio), retry rate, cost/request.
Deliverable: `docs/token_baseline.md` (⏳ — run against live Groq key; instrumentation is the prerequisite and it is in place).

Golden set: `evals/golden/` 30–100 cases (⏳ — needs human-approved outputs; runner compares baseline vs. new with schema/length checks + blind LLM-judge pairwise, accept ≥95% win/tie).

---

## 2. Input handling — DONE in code

- `clean()` strips zero-width chars, collapses whitespace, word-boundary truncation with `…`.
- `dedupeLines()` for transcript/script pastes.
- `estimateTokens()` chars/4 guard: `client.js` auto-truncates the dynamic tail message when `inChars > maxInChars`.
- `compactPatterns()` for hook-pattern retrieval (5 × 60ch CSV).
- Transcript budgets: rank clip text 400ch × 8 pool (was 1200 × 14); title input 400ch; adapt hook 200ch.
- Empty-topic guard in `fetchNicheTags` returns heuristic without spending a call.

## 3. Prompt engineering — DONE in code

- All system prompts → terse imperative (`Hook writer. JSON only. No preamble.` etc.).
- Static-first layout: static system line, then single dynamic user block last (prefix-cache friendly; no timestamps/IDs at top).
- Short keys on the wire for rank (`s/e/d/sc/txt`); compact JSON, no pretty-print.
- One prompt per task with `task` routing; `LLM_PROMPT_VERSION=v1` in cache key for prompt versioning (bump on rewrite to bust cache).
- `titles.js` 5→2 examples; each example block tested for removal — titles still carry emoji rule via repair check in `ai.js`.

## 4. Output control — DONE in code

| Task | Before | After |
|---|---|---|
| rank | 600 | 300, temp 0.2 |
| clipCopy | 500 | 250, temp 0.4 |
| title | 200 | 60, temp 0.5 |
| hooks | unbounded | 400, temp 0.7 |
| script | unbounded | 800, temp 0.7 |
| adapt | unbounded | 500, temp 0.4 |
| nicheTags | unbounded | 150, temp 0.3 |

All prompts carry `JSON only. No preamble.` + exact length caps (7w title, 9w hook, 10w poll, 4w CTA).
`response_format: json_object` enforced on all JSON calls (fixes fence/prose parse-retry waste in `clippedai/llm.js`).
Post-processing (emoji repair, hashtag clamp, truncation, validation) stays in code.

## 5. Context / memory / retrieval — PARTIAL

- Done: top-K style retrieval already exists (`retrievePatterns` round-robin); inputs truncated before send; `adaptMany` stays single batched call for all platforms.
- ⏳ Rolling summary / pinned style-card (≤200 tokens) for future chat flows; vector top-K for transcript selection (current keyword-overlap + rank-LLM is sufficient for now).

## 6. Model routing — WIRED, escalation ⏳

`client.js resolveProvider()` (Groq → OpenAI → heuristic) + `clipProvider()` preserved. Low-temp deterministic tasks (rank 0.2, nicheTags 0.3) already route-friendly to small models via `GROQ_MODEL` / `CLIPAI_GROQ_MODEL` env. ⏳ Cascade-with-escalation (cheap first, +1 level on schema fail) not yet added — record `engine` per call first, add when escalation rate justifies it.

## 7. Caching / dedupe / waste — DONE in code

- Exact-match cache: hooks/titles/clipCopy/clipPackage/adapt/nicheTags (TTL 24h / 6h); scripts + rank never cached (unique per call).
- In-flight dedupe via `cache.dedupe` (double-click / concurrent clips coalesce).
- Retry: transient-only (429/5xx/network), 1 retry max, exp backoff + jitter, honors `retry-after`. No full-prompt resend on validation errors (returns heuristic `null` → code fallback).
- Rate-limit safety: `max_tokens` caps double as TPM budgeting; input guard prevents oversize sends that trigger 429s.

## 8. Quality gate — PROCESS (run before each future change)

1. Golden set baseline vs. new. 2. Auto checks (schema, length, emoji/hashtag rules) + blind LLM-judge pairwise + 10-sample human spot check. 3. Accept: win/tie ≥95%, auto-pass ≥ baseline, p95 latency ≤ baseline. 4. Commit msg includes token delta.

## 9. Rollout / monitoring — INSTRUMENTED, dashboard ⏳

Logs emit everything the dashboard needs: `task, prompt_tokens, completion_tokens, cached, latencyMs, retries`. Alert rule: avg tokens/task +15% WoW = prompt drift. Guardrails: `maxInChars` edge reject + graceful heuristic fallback (never 500 on LLM failure). ⏳ Flag-controlled rollout + per-user caps when traffic warrants it.

## 10. Token math (estimated, verify with baseline)

- rank call: 14×1200ch (~4200 tok in) → 8×400ch (~800 tok in): **~-80% input, -50% output**.
- title call: 5 examples + unbounded transcript → 2 examples + 400ch + 60 maxOut: **~-60% in, ~-70% out**.
- copy call: verbose schema → 1-line schema, 500→250 cap: **~-30% in, ~-40% out**.
- hooks call: full pattern strings → 5×60ch CSV: **~-40% in**.
- Repeat traffic (same topic/title/adapt): cache hit = **-100%** on hits; target >30% hit rate.
- Per-clip call count: 2 (title+copy) → 1 (package): **-1 round trip + ~300–400 tokens/clip**.

## 11. Remaining + growth-loop extension (implemented)

- [x] Model cascade: `llmCascade()` in `src/llm/client.js` (cheap `LLM_CHEAP_MODEL` → large, 1 escalation, `validate()` per task, `LLM_CASCADE=0` kill-switch, `llm_route` logs). Wired into ideation hooks/script + insight narrative.
- [x] Trend analysis model: `analyzeTrends()` in `src/services/trends.service.js` — `scoreTrends()` (overlap 0.5 + velocity 0.15 + freshness 0.2 + youtube 0.15), per-region YouTube cache, `getRegionInterest()` (zero-token ROI), trends capped top-8 for prompts (top-3 × 60ch ≈ 60 tok).
- [x] Analytics + feedback loop: `src/services/analytics.service.js` — `aggregateMetrics()` (platform/region-hold on ROI, hook-category, duration, best-hour), `styleCardFor()` (≤400ch personalization, zero LLM), `recordFeedback()` → `Feedback` model, `growthRecommendations()` (heuristic recs + 1 cascaded 300-tok narrative, cached 1h).
- [x] Queries + aggregation script: `scripts/analytics-aggregate.js` (`--projectId --platform --region --days --topic --niche --no-llm`); same queries as the API; prints token estimate for the narrative call only.
- [x] Output redefinition: hooks/scripts return `{ trends, regionInterest, personalization }`; adapt variants carry `regionNote`; insights returns additive `{ platforms, regions/ROI, hookCategories, trends, growth }` (legacy fields preserved).
- [x] ROI: `src/services/geo.service.js` (`REGIONS`, `normalizeRegion`, `compareRegions`, `ROI_REGIONS` env); `Metric.region` + `Feedback.region` columns (auto-migrated via `sync alter`); live ROI via `getRegionInterest`, performance ROI via `aggregateMetrics().regions`.
- [ ] Still open: `docs/token_baseline.md` live run, `evals/golden/` judge gate, semantic cache, Batch API.

## 12. Env / config reference

| Var | Effect |
|---|---|
| `AI_PROVIDER=groq\|openai\|heuristic\|none` | Force provider (default auto Groq→OpenAI→heuristic) |
| `GROQ_MODEL` / `CLIPAI_GROQ_MODEL` | Model per lane (default `openai/gpt-oss-20b`) |
| `LLM_PROMPT_VERSION` | Cache-buster on prompt rewrites (default `v1`) |
| `OPENAI_MODEL` | OpenAI fallback model (default `gpt-4o-mini`) |

## 13. How to verify from here

```bash
cd backend
node -e "require('./src/services/llmProvider');require('./src/clippedai/llm');console.log('wired OK')"
# live smoke (needs GROQ_API_KEY):
# node -e "const {generateHooks}=require('./src/services/ideation.service');generateHooks({topic:'SaaS pricing mistakes',count:3}).then(r=>console.log(JSON.stringify(r).slice(0,300)))"
# watch token lines: llm_usage JSON per call; aggregate prompt_tokens/completion_tokens/cached by task.
```
