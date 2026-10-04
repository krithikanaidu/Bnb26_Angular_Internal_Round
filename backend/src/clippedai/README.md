# ClipAI — ClippedAI ported into CreatorAI (Node)

Faithful port of `ClippedAI-main/main.py` (AI YouTube-Shorts generator) as a
native backend pipeline. Same stages, same numbers, same subtitle style —
rebuilt for this stack (Express + ffmpeg) instead of Python + torch, so it
runs on `npm install` with zero API keys (heuristic fallbacks throughout,
exactly like `services/ai.service.js`).

## main.py → this folder

| ClippedAI (`main.py`) | Here | Notes |
|---|---|---|
| `transcribe_with_progress` (clipsai `Transcriber`/Whisper) | `transcribe.js` | OpenAI Whisper API (`verbose_json` + word timestamps) when `OPENAI_API_KEY` is set; evenly-chunked heuristic segments otherwise. Transcripts cached per job dir (`transcription.json`), mirroring `*_transcription.pkl`. |
| `ClipFinder().find_clips` (clipsai topic segments) | `score.js` `candidateWindows` | Sentence-aware sliding windows over word timestamps honoring min/max duration. |
| `calculate_engagement_score` | `score.js` `engagementScore` | Identical weights: word density 45% (`min(d/3,1)`), engagement-word ratio 30% (digits/`$`/`!`), duration balance 25% (`min(dur/75,1)`). |
| select top-N / extend shorts / trim longs | `score.js` `selectClips` | Same chain: top-2 always, rest need score ≥ 0.6; extend shorts to min, trim longs to max. |
| `MediaEditor.trim` | `pipeline.js` `renderClip` | Single-pass `-ss`/`-to` trim inside the render. |
| `resize()` + `resize_video` 9:16 (pyannote face tracking) | `pipeline.js` crop+scale | Deterministic center-crop `crop=min(iw,ih*9/16):min(ih,iw*16/9)` → `scale=1080:1920`. No face tracking (needs pyannote); same output geometry. |
| `create_animated_subtitles` (ASS, white + yellow numbers) | `subtitles.js` + `pipeline.js` | Same 25-char cues, 0.5s gap splits, same V4 styles block, Alignment 8, burn-in via libass `ass=` filter with `fontsdir` → bundled `fonts/` (Montserrat Extra Bold, copied from ClippedAI `fonts/`). |
| `get_viral_title` (Groq `llama-3.1-8b-instant`) | `titles.js` | Same prompt/examples/emoji rule; model updated to `openai/gpt-oss-20b` (the original was retired — override with `CLIPAI_GROQ_MODEL`). Falls back to OpenAI chat, then heuristic. |
| `safe_filename` | `titles.js` `safeFilename` | Same allow-list incl. emoji ranges, minus `<>:"/\|` which are illegal on Windows (main.py keeps `:` and fails Windows saves). |
| `input/` + `output/` folders | `media/clippedai/<jobId>/` | Uploads + per-clip outputs, served at `/media`. Ignored by git. |
| Interactive CLI prompts | `routes/clippedai.js` + frontend `ClipAI` page | Upload + options (clip count 1–12 like the `(1,2)…(11,12)` ranges) via REST; progress polled from the `ClipJob` row. |
| Transcription `.pkl` cache | `transcription.json` per job | Re-runs skip transcription. |

## API

- `POST /api/clippedai/jobs` — multipart `video` + `projectId?, maxClips?(1–12), minLen?, maxLen?, subtitles?(bool), portrait?(bool)` → `201 ClipJob` (queued)
- `GET /api/clippedai/jobs?projectId=` — latest 50
- `GET /api/clippedai/jobs/:id`
- `DELETE /api/clippedai/jobs/:id` — removes files + row
- Outputs: `/media/clippedai/<jobId>/<file>.mp4`

Rendered clips also persist as `Clip` rows (`status: 'rendered'`, `meta.jobId` + `meta.file`) so Studio → EDL → Publish flows pick them up unchanged.

## Env

```
GROQ_API_KEY=            # viral titles (else heuristic)
OPENAI_API_KEY=          # Whisper transcription (else heuristic segments)
CLIPAI_MIN_CLIP_SEC=45   # ClippedAI defaults, kept
CLIPAI_MAX_CLIP_SEC=120
CLIPAI_PRESET=veryfast
CLIPAI_CRF=20
CLIPAI_FFMPEG_PATH=      # optional system binary override
CLIPAI_FFPROBE_PATH=     # optional system binary override
CLIPAI_YTDLP_PATH=       # optional system yt-dlp override (bundled yt-dlp-exec otherwise)
CLIPAI_YT_MAX_MIN=120    # refuse YouTube videos longer than this (0 = unlimited)
```

Queue: in-process, 1 job at a time. For multi-worker scale-out, replace
`jobs.js` enqueue with BullMQ/Redis — the route + row contract stays the same.
