# EDL Format: Editable Edit Decision List

> The JSON contract between the AI, the timeline UI, the renderer and the version history.
> **Spec version:** `1.0` · Stored in `edl_versions.edl` (jsonb)

---

## 1. Why an EDL?

Most AI clippers return a baked video. CreatorAi returns a **description of the edit**:

- The **AI** writes it (and explains each decision).
- The **creator** can accept, reject or modify any item.
- The **timeline UI** renders it.
- The **renderer** (FFmpeg) turns it into an MP4.
- The **version history** stores every state, so nothing is lost.

---

## 2. Top-Level Structure

```json
{
  "spec": "1.0",
  "clip_id": "uuid",
  "source_asset_id": "uuid",
  "duration": 38.2,
  "frame": { "aspect": "9:16", "width": 1080, "height": 1920, "fps": 30 },
  "tracks": [],
  "captions": [],
  "overlays": [],
  "hook": {},
  "cta": {},
  "meta": {}
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `spec` | string | yes | Spec version |
| `clip_id` | uuid | yes | Owning clip |
| `source_asset_id` | uuid | yes | Raw footage asset |
| `duration` | number | yes | Output duration in seconds (computed from tracks) |
| `frame` | object | yes | Output canvas |
| `tracks` | array | yes | Video/audio segments (trim, cuts, crop, speed) |
| `captions` | array | yes | Timed caption items |
| `overlays` | array | no | Text, image and sticker layers |
| `hook` | object | no | Opening hook element |
| `cta` | object | no | Closing call-to-action |
| `meta` | object | no | Provenance and generation info |

All times are **seconds** (float) on the **output timeline** unless a field is named `src_*`, which refers to the **source asset timeline**.

---

## 3. Common Item Fields (Provenance and Control)

Every editable item in `tracks`, `captions`, `overlays`, `hook` and `cta` carries:

| Field | Type | Values | Purpose |
|---|---|---|---|
| `id` | string | unique within the EDL | Stable reference for accept/reject |
| `source` | enum | `ai`, `user` | Who created it |
| `status` | enum | `pending`, `accepted`, `rejected` | Review state |
| `reason` | string | free text | Why the AI made this decision (shown in UI) |
| `locked` | boolean | default false | Prevents AI regeneration from overwriting |

Rendering rules:
- `accepted` and `pending` items are rendered in **preview**.
- Only `accepted` items (plus `source: "user"` items) are rendered in **final export**, unless the user chooses "Include pending".
- `rejected` items are kept in JSON (so the UI can restore them) but never rendered.

---

## 4. `tracks`

Each track is an ordered list of segments.

```json
"tracks": [
  {
    "id": "t_video",
    "kind": "video",
    "segments": [
      {
        "id": "s1", "op": "trim",
        "src_start": 132.4, "src_end": 150.2,
        "start": 0.0, "end": 17.8,
        "crop": { "aspect": "9:16", "focus": "center", "x": 0.5, "y": 0.5, "zoom": 1.0 },
        "speed": 1.0,
        "source": "ai", "status": "accepted",
        "reason": "Matches script beat 2"
      },
      {
        "id": "s2", "op": "trim",
        "src_start": 151.1, "src_end": 170.3,
        "start": 17.8, "end": 37.0,
        "source": "ai", "status": "pending",
        "reason": "Silence of 0.9 s removed between segments"
      }
    ]
  },
  { "id": "t_audio", "kind": "audio", "segments": [], "gain_db": 0, "music": null }
]
```

| Segment field | Type | Description |
|---|---|---|
| `op` | enum | `trim` (include a source range) · `cut` (remove a range, optional alternative to trim) · `speed` |
| `src_start`, `src_end` | number | Range in source asset |
| `start`, `end` | number | Placement in output timeline |
| `crop` | object | `aspect`, `focus` (`center` \| `speaker` \| `manual`), normalized `x`, `y`, `zoom` |
| `speed` | number | 1.0 normal; allowed 0.5–2.0 |

Constraints:
- Segments in a track must not overlap in `start..end`.
- `end - start == (src_end - src_start) / speed` (the system recomputes and rejects mismatches).
- Gaps are allowed only if intentional (render as black/hold frame); the AI never creates gaps.

Silence removal is expressed as **multiple trim segments** with the silent range omitted, each tagged `reason: "silence removed"`, so the user can reject an individual cut.

---

## 5. `captions`

```json
"captions": [
  {
    "id": "c1",
    "start": 0.0, "end": 1.4,
    "text": "Most founders price too low",
    "words": [
      { "w": "Most", "start": 0.0, "end": 0.25 },
      { "w": "founders", "start": 0.25, "end": 0.7 }
    ],
    "style": "bold-karaoke",
    "position": "bottom",
    "source": "ai", "status": "accepted"
  }
]
```

| Field | Description |
|---|---|
| `text` | Caption text (editable) |
| `words` | Optional word timings for karaoke-style highlighting |
| `style` | Preset key: `clean`, `bold-karaoke`, `boxed`, `minimal` |
| `position` | `top`, `middle`, `bottom` |
| `style_override` | Optional `{ font, size, color, highlight, outline }` |

Global caption style can also be set in `meta.caption_style`; per-item `style` overrides it.

Chunking default: 3–6 words per caption, max 2 lines, max about 32 characters per line for 9:16.

---

## 6. `overlays`

```json
"overlays": [
  {
    "id": "o1", "type": "text",
    "start": 5.0, "end": 8.0,
    "text": "Mistake #2",
    "box": { "x": 0.5, "y": 0.2, "w": 0.8, "h": 0.1 },
    "style": { "font": "Inter", "size": 64, "color": "#FFFFFF", "bg": "#00000080" },
    "animation": "pop",
    "source": "user", "status": "accepted"
  },
  {
    "id": "o2", "type": "image",
    "start": 10.0, "end": 12.0, "asset_id": "uuid",
    "box": { "x": 0.5, "y": 0.5, "w": 0.4, "h": 0.4 },
    "source": "user", "status": "accepted"
  }
]
```

| `type` | Required fields |
|---|---|
| `text` | `text`, `box`, `style` |
| `image` | `asset_id`, `box` |
| `sticker` ⏳ | `key`, `box` |
| `progress_bar` ⏳ | `style` |

`box` uses **normalized coordinates** (0–1 relative to the frame, center-anchored) so the same overlay works across aspect ratios.

---

## 7. `hook`

The opening element designed to stop the scroll (first 1–3 seconds).

```json
"hook": {
  "id": "h1",
  "hook_id": "uuid",
  "pattern_id": "uuid",
  "text": "Most founders price too low. Here's why.",
  "start": 0.0, "end": 2.5,
  "style": { "preset": "big-center" },
  "source": "ai", "status": "pending",
  "reason": "Contrarian hook chosen from script; matches top-performing pattern"
}
```

`hook_id` and `pattern_id` link to the Hook and `hook_patterns` rows, which lets insights group performance by pattern.

---

## 8. `cta`

```json
"cta": {
  "id": "cta1",
  "text": "Follow for part 2",
  "start": 35.0, "end": 38.2,
  "style": { "preset": "end-card" },
  "source": "ai", "status": "accepted"
}
```

---

## 9. `meta`

```json
"meta": {
  "version": 3,
  "parent_version": 2,
  "created_by": "user",
  "generated_by": { "engine": "openai", "model": "…", "agent_run_id": "uuid" },
  "caption_style": "bold-karaoke",
  "notes": "Rejected silence trim s2"
}
```

---

## 10. Versioning Rules

1. Every save creates a **new immutable version** (`edl_versions` row); the previous one is never changed.
2. `version` increments per clip; `parent_version` records lineage.
3. Saves include `base_version`. If it is not the latest, the API returns `409` to prevent overwriting concurrent edits.
4. **Revert** = create a new version whose content equals an older one (`note: "Reverted to v2"`).
5. **AI regeneration** keeps `locked` items and user-created items, and replaces only unlocked `ai` items.
6. Accept/reject changes also create a new version (cheap, since EDLs are small).

---

## 11. Validation (backend, before save)

| Rule | Error |
|---|---|
| `spec` supported | `UNSUPPORTED_SPEC` |
| All `id`s unique | `DUPLICATE_ID` |
| Times non-negative and `start < end` | `INVALID_TIME` |
| Segments don't overlap within a track | `OVERLAP` |
| `src_*` within the source asset duration | `OUT_OF_RANGE` |
| Duration matches the sum of segments | `DURATION_MISMATCH` |
| `speed` in 0.5–2.0 | `INVALID_SPEED` |
| Overlay `asset_id` exists in the workspace | `ASSET_NOT_FOUND` |
| Enum values valid | `INVALID_ENUM` |

Use a JSON Schema (Ajv in Node) shared by frontend and backend.

---

## 12. Rendering Mapping (FFmpeg)

| EDL element | FFmpeg approach |
|---|---|
| `trim` segments | `-ss/-to` per segment, then `concat` (or `trim`/`atrim` + `concat` filter) |
| `crop` 9:16 | `crop=ih*9/16:ih:x:0` (+ `scale=1080:1920`) with `focus` offsets |
| `speed` | `setpts` and `atempo` |
| `captions` | Generate `.ass` subtitles (karaoke tags from `words`) → `subtitles` filter |
| `overlays` text | `drawtext` (or ASS for animation) |
| `overlays` image | `overlay` filter with `enable='between(t,s,e)'` |
| `hook`, `cta` | Same as text overlays with preset styles |
| Audio | `amix`/`volume` per track gain |

Render job input: `{ clip_id, version, include_pending, aspect }` → output asset saved to Storage and linked to the clip or variant.

---

## 13. Mapping to the Timeline UI

| UI element | EDL source |
|---|---|
| Video lane | `tracks[kind=video].segments` |
| Audio lane | `tracks[kind=audio]` |
| Caption lane | `captions` |
| Overlay lanes | `overlays` + `hook` + `cta` |
| AI badge | `source: "ai"` |
| Pending highlight | `status: "pending"` (accept/reject buttons) |
| Tooltip | `reason` |

The UI keeps the EDL as the single state object; the timeline SDK is a view over it. On drag, trim or resize, update the item and mark `source: "user"`.

---

## 14. Complete Example

```json
{
  "spec": "1.0",
  "clip_id": "c0a1…",
  "source_asset_id": "a9f3…",
  "duration": 37.0,
  "frame": { "aspect": "9:16", "width": 1080, "height": 1920, "fps": 30 },
  "tracks": [
    { "id": "t_video", "kind": "video", "segments": [
      { "id": "s1", "op": "trim", "src_start": 132.4, "src_end": 150.2, "start": 0, "end": 17.8,
        "crop": { "aspect": "9:16", "focus": "speaker", "x": 0.5, "y": 0.5, "zoom": 1.0 },
        "speed": 1.0, "source": "ai", "status": "accepted", "reason": "Matches script beat 2" },
      { "id": "s2", "op": "trim", "src_start": 151.1, "src_end": 170.3, "start": 17.8, "end": 37.0,
        "speed": 1.0, "source": "ai", "status": "rejected", "reason": "Silence removed (0.9 s)" }
    ]},
    { "id": "t_audio", "kind": "audio", "segments": [], "gain_db": 0, "music": null }
  ],
  "captions": [
    { "id": "c1", "start": 0.0, "end": 1.4, "text": "Most founders price too low",
      "style": "bold-karaoke", "position": "bottom", "source": "ai", "status": "accepted" }
  ],
  "overlays": [
    { "id": "o1", "type": "text", "start": 5.0, "end": 8.0, "text": "Mistake #2",
      "box": { "x": 0.5, "y": 0.2, "w": 0.8, "h": 0.1 },
      "style": { "font": "Inter", "size": 64, "color": "#FFFFFF" },
      "source": "user", "status": "accepted" }
  ],
  "hook": { "id": "h1", "text": "Most founders price too low. Here's why.", "start": 0, "end": 2.5,
            "style": { "preset": "big-center" }, "source": "ai", "status": "pending",
            "reason": "Contrarian hook matches top-performing pattern" },
  "cta": { "id": "cta1", "text": "Follow for part 2", "start": 34.0, "end": 37.0,
           "style": { "preset": "end-card" }, "source": "ai", "status": "accepted" },
  "meta": { "version": 3, "parent_version": 2, "created_by": "user",
            "generated_by": { "engine": "heuristic" }, "caption_style": "bold-karaoke" }
}
```

Note: in this example `s2` is rejected, so the final output would be shorter than `duration: 37.0`. The server recomputes `duration` and re-packs `start/end` for rendering, while the stored EDL keeps the rejected item in place.

---

## 15. Compatibility and Extensions

- New fields are additive; unknown fields are preserved but ignored.
- Breaking changes bump `spec` (e.g. `2.0`) with a migration function per version.
- Planned: `transitions`, `b-roll` track, `music` track with ducking, `speaker_crop` keyframes.
- Export adapters (post-MVP): EDL → FCPXML or CapCut draft for editors who prefer other tools.
