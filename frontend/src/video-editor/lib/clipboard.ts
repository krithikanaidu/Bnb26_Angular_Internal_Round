import { nanoid } from "nanoid";
import type { AnyClip } from "@openvideo/core";
import { core, projectStore } from "@/lib/project";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Visible timeline length of a clip — timing.duration is unreliable for
 *  display-only clips (engine defaults them to 5s) and trimmed media. */
export function getClipDisplayLengthUs(clip: AnyClip): number {
  const display = clip.timing?.display;
  if (display && Number.isFinite(display.from) && Number.isFinite(display.to)) {
    return Math.max(0, display.to - display.from);
  }
  return clip.timing?.duration ?? 0;
}

function retimeClips(clips: AnyClip[], anchorUs: number): AnyClip[] {
  const earliestFrom = Math.min(...clips.map((c) => c.timing?.display?.from ?? 0));
  return clips.map((clip) => {
    const newFrom = anchorUs + ((clip.timing?.display?.from ?? 0) - earliestFrom);
    return {
      ...clip,
      id: nanoid(),
      timing: {
        ...clip.timing,
        display: {
          ...clip.timing?.display,
          from: newFrom,
          to: newFrom + getClipDisplayLengthUs(clip),
        },
      },
    };
  });
}

/** Paste clips at a time (us), preserving their relative offsets. */
export function pasteClipsAt(clips: AnyClip[], atTimeUs: number): AnyClip[] {
  if (clips.length === 0) return [];
  return retimeClips(clone(clips), atTimeUs);
}

/** Duplicate clips so copies start right after the latest original ends. */
export function duplicateClips(clips: AnyClip[]): AnyClip[] {
  if (clips.length === 0) return [];
  const spanEnd = Math.max(...clips.map((c) => c.timing?.display?.to ?? 0));
  return retimeClips(clone(clips), spanEnd);
}

export async function addClipsAndSelect(newClips: AnyClip[]): Promise<void> {
  if (newClips.length === 0) return;
  await Promise.all(newClips.map((clip) => core.clip.add(clip)));
  projectStore.getState().select(newClips.map((c) => c.id));
}
