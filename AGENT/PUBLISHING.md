# Publishing: Platform Presets, Scheduling and Adaptation

> How one clip becomes platform-ready variants and gets posted.
> Legend: ✅ exists today · 🔧 being upgraded · ⏳ planned

---

## 1. Overview

```
Clip + EDL ─▶ Adapt (presets + LLM caption) ─▶ PlatformVariants
          ─▶ Preview/edit ─▶ PublishJob (now or scheduled)
          ─▶ Connector ─▶ Platform ─▶ status + metrics
```

Principles:
1. **One source clip, many variants.** Each variant stores its own caption, hashtags, aspect and duration.
2. **Presets are data, not code.** Rules live in a config object so they can be updated without redeploying logic.
3. **Honest modes.** Every publish job is labeled `real` or `simulated`. The UI never implies a simulated post went live.
4. **Edit before posting.** Nothing is posted until the user confirms.

---

## 2. Platform Presets ✅

> **Important:** platform limits change often. The values below are sensible **defaults for short-form content**. Verify them against each platform's current documentation before launch and keep them in one config file.

| Preset key | Platform | Aspect | Target / max duration | Caption limit | Hashtag guidance | Tone |
|---|---|---|---|---|---|---|
| `tiktok` | TikTok | 9:16 | Target 15–45 s, max 60 s (default cap) | 2,200 chars | 3–5, include 1 trend/niche tag | Casual, hook-first |
| `reels` | Instagram Reels | 9:16 | Target 15–45 s, max 90 s | 2,200 chars | 3–5 | Visual, aspirational, concise |
| `shorts` | YouTube Shorts | 9:16 | Target 20–50 s, max 60 s (default cap) | Title 100 chars + description | 2–3, add `#Shorts` | Searchable, keyword-rich title |
| `x` | X (Twitter) | 16:9, 1:1 or 9:16 | Max 140 s (default cap) | 280 chars | 0–2 | Short, punchy, conversational |
| `linkedin` ⏳ | LinkedIn | 1:1 or 4:5 (9:16 acceptable) | Target 30–90 s | 3,000 chars | 3–5 professional | Insightful, professional |

Preset schema:
```json
{
  "key": "reels",
  "label": "Instagram Reels",
  "aspect": "9:16",
  "resolution": { "w": 1080, "h": 1920 },
  "duration": { "min": 5, "target": 30, "max": 90 },
  "caption": { "max_chars": 2200, "title_max_chars": null },
  "hashtags": { "min": 3, "max": 5, "required": [] },
  "caption_style": "bold-karaoke",
  "safe_zone": { "top": 0.12, "bottom": 0.2 },
  "tone": "visual, aspirational, concise",
  "cta_default": "Save this for later"
}
```

`safe_zone` keeps captions and overlays away from UI chrome (profile name, buttons) on each platform.

---

## 3. Adaptation Rules ✅ / 🔧

Applied by the Adapt agent for each selected platform:

| Step | Rule |
|---|---|
| 1. Duration | If clip > `max`, propose the best sub-range (highest-scoring beats) or flag "too long" and let the user trim. If < `min`, warn. |
| 2. Aspect | Reframe to the preset aspect using the EDL `crop` (9:16 center/speaker, 1:1 center, 16:9 no crop). Re-render needed when aspect differs from the current render. |
| 3. Captions on-screen | Apply `caption_style`; reposition using `safe_zone`; limit characters per line. |
| 4. Post caption | LLM rewrites the base caption in the preset `tone`, within `max_chars` (fallback: template using title + CTA). |
| 5. Hashtags | Select from script/topic tags plus niche tags; clamp to `min..max`; add required tags (e.g. `#Shorts`). De-duplicate. |
| 6. Title (Shorts) | Max 100 chars, keyword near the start. |
| 7. CTA | Use the clip CTA or preset default. |
| 8. Validation | Run all limit checks; surface warnings, not silent truncation. |

Output (stored as `platform_variants`):
```json
{
  "clip_id": "…",
  "platform": "shorts",
  "aspect": "9:16",
  "duration": 38.2,
  "title": "Why most founders underprice (and how to fix it)",
  "caption": "…",
  "hashtags": ["#Shorts", "#saas", "#pricing"],
  "asset_id": "uuid-of-rendered-variant",
  "warnings": [],
  "status": "ready"
}
```

Variants with the same aspect and duration can **share one rendered file** to save render time.

---

## 4. Variant Preview and Editing 🔧

In the Publish page the user can, per platform:
- Edit caption, title and hashtags (live character counter)
- See warnings (too long, hashtag count, safe-zone overlap)
- Preview the video inside a platform-style frame with the safe zone shown
- Toggle platforms on or off
- Reset to the AI suggestion

Edits to caption or hashtags change only that variant; edits to the EDL require a re-render.

---

## 5. Scheduling ✅

| Mode | Behavior |
|---|---|
| **Now** | Create job with `scheduled_at = now`; picked up immediately |
| **Schedule** | User picks date/time (stored UTC, displayed in user's time zone) |
| **Staggered** ⏳ | "Spread across N days": system proposes times per platform |
| **Best time** ⏳ | Suggest windows from historical performance |

**Scheduler design (MVP):**
- A polling loop in the API (or worker) runs every 30–60 s.
- Query: `status = 'scheduled' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT n`.
- Mark `running` atomically (`UPDATE … WHERE status='scheduled' RETURNING`) to avoid double posting.
- Call the connector; set `published` or `failed`; store `external_id`/URL and `error`.
- Retries: up to 3 attempts with exponential backoff (1, 5, 15 min) for transient errors; no retry for validation or auth errors.

**Job states:** `queued → scheduled → running → published | failed | cancelled`.

Users can cancel or reschedule while the job is `scheduled`.

---

## 6. Connectors 🔧

Common interface:
```ts
interface Connector {
  platform: 'tiktok' | 'reels' | 'shorts' | 'x' | 'linkedin';
  mode: 'real' | 'simulated';
  validate(variant): Promise<Warning[]>;
  publish(variant, account): Promise<{ externalId: string; url?: string }>;
  fetchMetrics?(externalId, account): Promise<MetricSnapshot>;
}
```

| Connector | Mode | Approach |
|---|---|---|
| Scheduled-record only | `record` | **Current behavior.** Job is stored and tracked through draft → scheduled → published. Nothing is uploaded to the platform, and the UI says so |
| Aggregator (e.g. upload-post API) ⏳ | `real` | One API key posts to several networks; fastest way to get **one real platform** live |
| YouTube Data API ⏳ | `real` | Official upload; requires OAuth consent and quota awareness |
| Others (TikTok, Instagram, X, LinkedIn) | Post-MVP | Each needs developer app approval and OAuth |

MVP rule: **one real connector, the rest tracked as records only — never labeled as published.**

Account connection (`platform_accounts`): store `platform`, `handle`, `status` and a `token_ref` pointing to a secret, never the raw token in the DB or logs.

---

## 7. Metrics Collection 🔧

| Source | How |
|---|---|
| Real connector | Poll `fetchMetrics` at 1 h, 24 h, 72 h and 7 d after publishing |
| Manual | ⏳ | CSV import or manual entry |

Stored in `metrics`: `views`, `likes`, `comments`, `shares`, `watch_time`, `captured_at`, `source`.

**No synthetic metrics are generated.** If no connector has reported real numbers for a job,
Insights shows the job without performance figures rather than inventing a curve.

---

## 8. Compliance and Safety

- **Disclosure:** show AI-assistance labels where the target platform requires or encourages them; keep a per-variant `ai_disclosure` flag ⏳.
- **Copyright:** warn when uploaded audio/music is flagged by the user as third-party; the platform handles final enforcement.
- **Rate limits:** respect each API's quotas; queue and back off.
- **Content review:** a confirmation step before any real post.
- **Tokens:** least-privilege scopes, revocable from the UI.

---

## 9. Error Handling

| Error | UI message | Action |
|---|---|---|
| Duration over limit | "Clip exceeds {max}s for {platform}" | Offer auto-trim |
| Caption over limit | "Caption is {n}/{max} characters" | Offer shorten |
| Auth expired | "Reconnect {platform}" | Reconnect button |
| Rate limited | "Retrying at {time}" | Auto-retry |
| Platform rejection | Platform's message shown verbatim | Edit and retry |
| Network | "Temporary error" | Auto-retry (max 3) |

---

## 10. API Mapping

See [`API.md`](./API.md): `POST /content/adapt`, `GET/PATCH /variants`, `POST /content/publish`, `GET /content/publish`, `DELETE /publish/:id`, `GET/POST /platform-accounts`.

---

## 11. Extending: Adding a New Platform

1. Add a preset object to `config/platform-presets.js`.
2. Add the key to the `platform` enum (DB migration).
3. Implement a connector (or reuse the simulated one).
4. Add UI icon and label.
5. Add adaptation unit tests (duration clamp, caption limit, hashtag range).
