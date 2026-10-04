"use client";

import { core, projectStore } from "@/lib/project";
import { nanoid } from "nanoid";

/**
 * Effect-track ordering + transition target resolution.
 *
 * Engine rule (verified in @openvideo/engine-pixi `updateActiveGlobalEffect`):
 * an Effect clip only affects clips on tracks BELOW it (higher track index).
 * The core appends new effect tracks at the BOTTOM, where they match nothing —
 * so filters silently do nothing. These helpers keep effect tracks on top
 * (standard adjustment-layer behavior) and link transitions to real clips
 * (the studio ignores transitions without fromClipId/toClipId).
 */

const isEffectTrack = (t: { type?: string }) => (t.type || "").toLowerCase() === "effect";

function desiredTrackOrder<T extends { id: string; type?: string }>(tracks: T[]): T[] {
  const effects = tracks.filter(isEffectTrack);
  const rest = tracks.filter((t) => !isEffectTrack(t));
  return [...effects, ...rest];
}

/**
 * Move every effect track above all non-effect tracks (stable for the rest).
 * No-op when the order is already correct.
 */
export async function moveEffectTracksToTop(): Promise<void> {
  const { tracks } = projectStore.getState();
  if (!tracks || tracks.length < 2) return;

  const desired = desiredTrackOrder(tracks);
  const currentIds = tracks.map((t) => t.id).join(",");
  const desiredIds = desired.map((t) => t.id).join(",");
  if (currentIds === desiredIds) return;

  // Apply sequentially so indices stay predictable.
  const working = [...tracks];
  for (let targetIndex = 0; targetIndex < desired.length; targetIndex++) {
    const wantedId = desired[targetIndex].id;
    const currentIndex = working.findIndex((t) => t.id === wantedId);
    if (currentIndex === -1 || currentIndex === targetIndex) continue;
    const [moved] = working.splice(currentIndex, 1);
    working.splice(targetIndex, 0, moved);
    try {
      await core.execute({
        id: nanoid(),
        type: "track.move",
        payload: { id: wantedId, newIndex: targetIndex },
      });
    } catch (error) {
      // Best effort — a failed move must never break clip adding.
      console.warn("[track-order] failed to move effect track:", error);
      return;
    }
  }
}

export interface TransitionTargets {
  fromClipId: string;
  toClipId: string;
  duration: number;
}

const VISUAL_TYPES = ["Video", "Image"];

function displayOf(clip: any) {
  return clip?.timing?.display || clip?.display;
}

/**
 * Resolve which two clips a click-added transition should join:
 * the visual clip under the playhead (or the selected one) + the clip
 * right before it on the same track. Returns null when there is nothing
 * sensible to attach to (caller should toast guidance).
 */
export function resolveTransitionTargets(atTime?: number): TransitionTargets | null {
  const state = projectStore.getState();
  const clips = Object.values(state.clips || {}) as any[];
  const t = typeof atTime === "number" ? atTime : (state.currentTime ?? 0);

  const visual = clips.filter((c) => VISUAL_TYPES.includes(c?.type));
  if (visual.length === 0) return null;

  const covering = visual.filter((c) => {
    const d = displayOf(c);
    return d && t >= d.from && t < d.to;
  });
  const byZ = (a: any, b: any) => (b.transform?.zIndex ?? 0) - (a.transform?.zIndex ?? 0);
  const selected = visual
    .filter((c) => (state.selectedIds || []).includes(c.id))
    .sort(byZ)[0];
  const toClip = covering.sort(byZ)[0] || selected;
  if (!toClip) return null;

  const toDisplay = displayOf(toClip);
  if (!toDisplay) return null;

  const track = (state.tracks || []).find((tr: any) => (tr.clipIds || []).includes(toClip.id));
  const siblings = track
    ? (track.clipIds || [])
        .map((id: string) => (state.clips as any)?.[id])
        .filter((c: any) => c && c.id !== toClip.id && VISUAL_TYPES.includes(c.type))
    : [];
  const prev = siblings
    .filter((c: any) => {
      const d = displayOf(c);
      return d && d.to <= toDisplay.from;
    })
    .sort((a: any, b: any) => displayOf(b).to - displayOf(a).to)[0];

  const toDuration =
    (toClip.timing?.duration ?? toDisplay.to - toDisplay.from) || 2_000_000;
  const duration = Math.max(300_000, Math.min(2_000_000, Math.floor(toDuration / 2)));

  return {
    fromClipId: (prev || toClip).id,
    toClipId: toClip.id,
    duration,
  };
}
