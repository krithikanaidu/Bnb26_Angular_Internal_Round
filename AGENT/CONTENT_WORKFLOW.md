# Content Workflow: CreatorAi

> The lifecycle of one piece of content: **idea → script → record → edit → repurpose → publish → learn.**
> Legend: ✅ exists today · 🔧 being upgraded · ⏳ planned

---

## 1. Lifecycle at a Glance

```
┌──────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌───────────┐  ┌───────────┐
│ idea │─▶│ scripted│─▶│ recorded │─▶│ editing │─▶│ review │─▶│ scheduled │─▶│ published │
└──────┘  └─────────┘  └──────────┘  └─────────┘  └────────┘  └───────────┘  └───────────┘
    ▲                                                                              │
    └───────────────────── insights feed the next idea ◀───────────────────────────┘
```

Each project (one content piece) carries a `status` from this enum. The Dashboard pipeline view groups projects by status.

---

## 2. Stages in Detail

### Stage 1: Idea (`idea`) ✅
| | |
|---|---|
| **Goal** | Capture a topic worth making |
| **User actions** | Create project (title, topic, niche); optionally pick a suggested idea ⏳ |
| **System actions** | Store project; ⏳ ideation agent proposes topics from past performance |
| **Exit trigger** | A script is saved |
| **Outputs** | Project row |
| **Screens** | Dashboard → New Project |

### Stage 2: Script (`scripted`) ✅
| | |
|---|---|
| **Goal** | Decide the message and the opening |
| **User actions** | Generate hooks; pick one; generate or write the script; edit inline; accept supporting copy |
| **System actions** | Hook and script agents; split script into beats ⏳; log `agent_runs` |
| **Exit trigger** | Script saved with a chosen hook |
| **Outputs** | Hooks, Script, beats, title, caption, hashtags, CTA |
| **Screens** | Scripts page |

### Stage 3: Record (`recorded`) ✅ / 🔧
| | |
|---|---|
| **Goal** | Get raw footage into the system and understood |
| **User actions** | Upload video/audio (and optional b-roll images) |
| **System actions** | Store in Supabase Storage; create Asset; transcribe ⏳ (seeded today); embed ⏳ |
| **Exit trigger** | At least one video asset has a transcript |
| **Outputs** | Asset, TranscriptSegments, embeddings |
| **Screens** | Assets page |

### Stage 4: Edit (`editing`) ✅ / 🔧
| | |
|---|---|
| **Goal** | Turn long footage into short, polished, editable clips |
| **User actions** | Run alignment; review matches and gaps; generate clips; accept/reject; adjust in/out; review AI ops; save versions; render |
| **System actions** | Alignment agent; clip agent; edit agent produces EDL v1; versioning; render job ⏳ |
| **Exit trigger** | At least one clip accepted with an EDL version, and the user requests review or approves |
| **Outputs** | Clips, EDL versions, rendered MP4s ⏳ |
| **Screens** | Studio |

Sub-flow inside Studio:
```
Align ─▶ see gaps ─▶ Generate clips ─▶ Accept/Reject ─▶ AI edit (EDL v1)
   ─▶ tweak ops ─▶ Save (v2…vN) ─▶ Render
```

### Stage 5: Review (`review`) ⏳
| | |
|---|---|
| **Goal** | Get a second pair of eyes before publishing |
| **User actions** | Reviewer (editor, manager, client) watches the draft, leaves time-coded comments; creator resolves them; approve |
| **System actions** | Store comments linked to clip, EDL version and timecode; notify |
| **Exit trigger** | All comments resolved and approval recorded, or review skipped (solo creators) |
| **Outputs** | `review_comments`, approval flag |
| **Screens** | Review panel inside Studio |

Solo creators can skip this stage; the transition `editing → scheduled` is allowed with a confirmation.

### Stage 6: Repurpose and Schedule (`scheduled`) ✅
| | |
|---|---|
| **Goal** | Adapt for each platform and queue posts |
| **User actions** | Choose platforms; preview variants; edit captions/hashtags; pick time or "now" |
| **System actions** | Adapt agent creates PlatformVariants from presets; creates PublishJobs; calendar entries ⏳ |
| **Exit trigger** | Scheduled time reached and publish succeeds |
| **Outputs** | PlatformVariants, PublishJobs, CalendarEntries |
| **Screens** | Publish page, Calendar ⏳ |

### Stage 7: Publish (`published`) ✅ / 🔧
| | |
|---|---|
| **Goal** | Post and track the results |
| **System actions** | Connector posts (real for one platform, simulated for others); status per platform; metrics collected (polled or seeded) |
| **Exit trigger** | At least one publish job succeeded |
| **Outputs** | Post IDs/URLs, Metric rows |
| **Screens** | Publish status, Dashboard |

### Stage 8: Learn (continuous) 🔧
| | |
|---|---|
| **Goal** | Turn results into the next decision |
| **System actions** | Aggregate metrics by hook pattern, platform and duration; compute lift; generate recommendations |
| **Outputs** | Insights, next-idea suggestions ⏳, revenue per content ⏳ |
| **Screens** | Dashboard insights, Insights page ⏳ |

---

## 3. Status Transition Rules

| From | Allowed to | Trigger |
|---|---|---|
| `idea` | `scripted` | Script saved |
| `scripted` | `recorded`, `idea` | Video asset with transcript; or revert |
| `recorded` | `editing`, `scripted` | First clip accepted; or revert |
| `editing` | `review`, `scheduled`, `recorded` | Request review; skip review (confirm); revert |
| `review` | `scheduled`, `editing` | Approved; or changes requested |
| `scheduled` | `published`, `editing` | Publish success; or unschedule |
| `published` | none | Terminal (create a new project to iterate) |

Rules:
1. Moves can be automatic (event-driven) or manual (user drags a card or clicks "Advance").
2. Invalid jumps return `409 INVALID_TRANSITION`.
3. Every transition is logged (`agent_runs` or an audit field) with who/what caused it.
4. A project can have multiple clips, and clips may be at different stages. Project status reflects the **furthest-behind active clip** while the project is `editing`/`review`; once any publish succeeds the project is `published`.

---

## 4. Roles ⏳

| Role | Can do |
|---|---|
| **Creator (owner)** | Everything |
| **Editor** | Edit EDL, comment, render; cannot publish |
| **Reviewer** | View and comment only |

MVP: single role (owner). Role model is documented here so the schema (`workspace_id`, future `memberships`) leaves room.

---

## 5. Automation Triggers

| Event | Automatic action |
|---|---|
| Asset uploaded (video/audio) | Queue `transcribe`, then `embed` |
| Transcript ready + script exists | Offer "Run alignment" (auto-run optional) |
| Alignment done | Show gaps; offer "Generate clips" |
| Clip accepted | Generate EDL v1 |
| EDL saved | Mark render as stale |
| Render complete | Enable "Adapt" |
| Variants created | Offer "Schedule" |
| Publish success | Start metrics sync; advance status |
| Metrics updated | Refresh insights |

---

## 6. Content Calendar ⏳

- View: month/week grid of `calendar_entries` (planned post date, platform, project).
- Create entry from a project or by clicking a date.
- Scheduled publish jobs show on the calendar automatically.
- Insights suggest "best posting windows" from historical performance.

---

## 7. Failure and Recovery

| Failure | Behavior |
|---|---|
| Upload interrupted | Asset marked `failed`; retry button |
| Transcription fails | Job retried up to 3 times; fall back to seeded transcript in demo mode |
| Render fails | Show the error; EDL stays editable; retry |
| Publish fails | Job `failed` with error; one-click retry or reschedule |
| Metrics unavailable | Show "no data yet"; seed data labeled as demo |

No failure may lose user edits: the EDL version history is the source of truth.

---

## 8. Mapping to UI

| Stage | Page | Key components |
|---|---|---|
| Idea | Dashboard | Pipeline board, New Project, idea suggestions ⏳ |
| Script | Scripts | Hook list, script editor, supporting copy |
| Record | Assets | Upload zone, asset grid, transcript viewer |
| Edit | Studio | Alignment view, clip list, timeline, version history |
| Review | Studio (panel) | Time-coded comments |
| Schedule/Publish | Publish | Platform picker, variant preview, scheduler |
| Learn | Dashboard / Insights | KPIs, pattern charts, recommendations |

---

## 9. Example: One Piece of Content

1. **Idea:** "SaaS pricing mistakes" created for Riya's workspace.
2. **Script:** 8 hooks generated; a contrarian hook chosen; 60 s script with 5 beats.
3. **Record:** 12-min talk uploaded; transcript ready in minutes.
4. **Edit:** Alignment shows beat 4 has no footage (gap). 5 clips suggested; 3 accepted; EDL v1 adds captions, 9:16 crop, hook overlay; Riya rejects a silence trim (v2) and renders.
5. **Review:** Sam comments at 00:14 "tighten this pause"; Riya fixes it (v3).
6. **Schedule:** Variants for Shorts, Reels, TikTok and X; scheduled across two days.
7. **Publish and learn:** Insights show contrarian hooks on Reels outperform; the next-idea suggestion proposes a "pricing myths" series.
